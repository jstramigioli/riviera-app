const crypto = require('crypto');
const prisma = require('../utils/prisma');
const {
  buildCheckInUrl,
  buildMailto,
  sendCheckInEmail
} = require('../services/checkInMail');
const {
  getAddressFromNotes,
  createNotesWithAddress
} = require('../utils/clientAddressNotes');
const {
  assertSlot,
  saveDocumentPhoto,
  prismaFieldsForSlot
} = require('../utils/clientDocumentPhoto');
const { ensureHolderAsGuest } = require('../utils/guestHelpers');

const CLIENT_DOCUMENT_TYPES = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];

// 16 bytes → 32 hex chars: enough entropy, menos chance de truncarse al copiar en chat/UI
const TOKEN_BYTES = 16;
const DEFAULT_EXPIRY_DAYS = 30;

function normalizeTokenParam(raw) {
  if (raw == null) return '';
  let token = String(raw).trim();
  try {
    token = decodeURIComponent(token);
  } catch {
    // keep raw trimmed token
  }
  return token;
}

function isWellFormedToken(token) {
  // Acepta tokens viejos (48 hex) y nuevos (32 hex)
  return /^[a-f0-9]{32,64}$/i.test(token);
}

function normalizePlate(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().toUpperCase().replace(/\s+/g, '');
  return cleaned || null;
}

function normalizeText(value) {
  if (value == null) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

/** Serializa Date/ISO a YYYY-MM-DD para input type="date". */
function birthDateToInputValue(value) {
  if (!value) return '';
  const raw = String(value);
  const ymd = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1];
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD o ISO → Date a mediodía local; vacío → null. Lanza si inválido. */
function parseBirthDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0, 0);
    if (Number.isNaN(d.getTime())) throw new Error('invalid birthDate');
    return d;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('invalid birthDate');
  return d;
}

function clientPrefill(client = {}, reservation = {}, guest = {}) {
  return {
    firstName: client.firstName || guest.firstName || '',
    lastName: client.lastName || guest.lastName || '',
    email: client.email || guest.email || '',
    phone: client.phone || guest.phone || '',
    documentType: client.documentType || guest.documentType || 'DNI',
    documentNumber: client.documentNumber || guest.documentNumber || '',
    birthDate: birthDateToInputValue(client.birthDate),
    country: client.country || 'AR',
    province: client.province || '',
    city: client.city || guest.city || '',
    address: getAddressFromNotes(client.notes) || guest.address || '',
    wantsPromotions: Boolean(client.wantsPromotions),
    vehiclePlate: reservation.vehiclePlate || client.vehiclePlate || ''
  };
}

function normalizeDocumentType(value) {
  const cleaned = normalizeText(value) || 'DNI';
  return CLIENT_DOCUMENT_TYPES.includes(cleaned) ? cleaned : 'DNI';
}

function mergeFields(checkIn, prefill) {
  return {
    ...prefill,
    firstName: checkIn?.firstName || prefill.firstName,
    lastName: checkIn?.lastName || prefill.lastName,
    email: checkIn?.email || prefill.email,
    phone: checkIn?.phone || prefill.phone,
    documentType: checkIn?.documentType || prefill.documentType,
    documentNumber: checkIn?.documentNumber || prefill.documentNumber,
    birthDate: birthDateToInputValue(checkIn?.birthDate) || prefill.birthDate,
    country: checkIn?.country || prefill.country || 'AR',
    province: checkIn?.province || prefill.province,
    city: checkIn?.city || prefill.city,
    address: checkIn?.address || prefill.address,
    wantsPromotions: prefill.wantsPromotions,
    vehiclePlate: checkIn?.vehiclePlate || prefill.vehiclePlate
  };
}

/** Visual de card: completo / incompleto / pendiente / expirado. */
function displayStatus(checkIn, tokenExpired = false) {
  if (!checkIn) return 'pendiente';
  if (checkIn.status === 'COMPLETED') return 'completo';
  if (checkIn.status === 'EXPIRED' || tokenExpired) return 'expirado';
  const started =
    Boolean(checkIn.documentFrontUploadedAt) ||
    Boolean(checkIn.documentBackUploadedAt) ||
    Boolean(checkIn.firstName && checkIn.lastName && checkIn.completedAt == null && checkIn.address);
  if (started) return 'incompleto';
  return 'pendiente';
}

function expiryDateFromNow() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(process.env.CHECKIN_TOKEN_DAYS || DEFAULT_EXPIRY_DAYS));
  return expiresAt;
}

/**
 * Resuelve acceso por token de reserva (nuevo) o fila OnlineCheckIn legacy.
 */
async function resolveAccessByToken(token) {
  const byReservation = await prisma.reservation.findFirst({
    where: { checkInToken: token },
    include: {
      mainClient: true,
      guests: { include: { client: true }, orderBy: { id: 'asc' } },
      segments: { orderBy: { startDate: 'asc' }, take: 1 },
      onlineCheckIns: true
    }
  });
  if (byReservation) {
    return {
      reservation: byReservation,
      expiresAt: byReservation.checkInTokenExpiresAt,
      sentAt: byReservation.checkInTokenSentAt,
      legacyCheckIn: null
    };
  }

  const legacy = await prisma.onlineCheckIn.findUnique({
    where: { token },
    include: {
      reservation: {
        include: {
          mainClient: true,
          guests: { include: { client: true }, orderBy: { id: 'asc' } },
          segments: { orderBy: { startDate: 'asc' }, take: 1 },
          onlineCheckIns: true
        }
      }
    }
  });
  if (!legacy?.reservation) return null;

  // Migración lazy del token legacy a la reserva
  if (!legacy.reservation.checkInToken) {
    try {
      await prisma.reservation.update({
        where: { id: legacy.reservationId },
        data: {
          checkInToken: legacy.token,
          checkInTokenSentAt: legacy.sentAt,
          checkInTokenExpiresAt: legacy.expiresAt
        }
      });
      legacy.reservation.checkInToken = legacy.token;
      legacy.reservation.checkInTokenSentAt = legacy.sentAt;
      legacy.reservation.checkInTokenExpiresAt = legacy.expiresAt;
    } catch (err) {
      console.warn('lazy migrate checkInToken', err.message);
    }
  }

  return {
    reservation: legacy.reservation,
    expiresAt: legacy.reservation.checkInTokenExpiresAt || legacy.expiresAt,
    sentAt: legacy.reservation.checkInTokenSentAt || legacy.sentAt,
    legacyCheckIn: legacy
  };
}

function isExpired(expiresAt) {
  return Boolean(expiresAt && expiresAt < new Date());
}

/**
 * Asegura una fila OnlineCheckIn por cada Guest de la reserva.
 */
async function ensureGuestCheckInRows(reservation, { markSent = false } = {}) {
  const guests = reservation.guests || [];
  if (!guests.length) return [];

  // Si ya hay link activo, los huéspedes nuevos entran como SENT.
  const shouldMarkSent =
    markSent ||
    (Boolean(reservation.checkInToken) && !isExpired(reservation.checkInTokenExpiresAt));

  const existing = await prisma.onlineCheckIn.findMany({
    where: {
      reservationId: reservation.id,
      guestId: { in: guests.map((g) => g.id) }
    }
  });
  const byGuest = new Map(existing.filter((c) => c.guestId != null).map((c) => [c.guestId, c]));
  const now = new Date();
  const expiresAt = reservation.checkInTokenExpiresAt || null;

  const results = [];
  for (const guest of guests) {
    let row = byGuest.get(guest.id);
    if (!row) {
      row = await prisma.onlineCheckIn.create({
        data: {
          reservationId: reservation.id,
          guestId: guest.id,
          clientId: guest.clientId || null,
          status: shouldMarkSent ? 'SENT' : 'PENDING',
          sentAt: shouldMarkSent ? now : null,
          expiresAt,
          firstName: guest.firstName || null,
          lastName: guest.lastName || null,
          email: guest.email || guest.client?.email || null,
          phone: guest.phone || guest.client?.phone || null,
          documentType: guest.documentType || guest.client?.documentType || null,
          documentNumber: guest.documentNumber || guest.client?.documentNumber || null,
          birthDate: guest.client?.birthDate || null,
          country: guest.client?.country || null,
          province: guest.client?.province || null,
          city: guest.city || guest.client?.city || null,
          address: guest.address || null,
          vehiclePlate: reservation.vehiclePlate || guest.client?.vehiclePlate || null
        }
      });
    } else if (shouldMarkSent && row.status !== 'COMPLETED' && row.status !== 'EXPIRED') {
      row = await prisma.onlineCheckIn.update({
        where: { id: row.id },
        data: {
          status: 'SENT',
          sentAt: row.sentAt || now,
          expiresAt: expiresAt || row.expiresAt,
          clientId: row.clientId || guest.clientId || null
        }
      });
    }
    results.push(row);
  }
  return results;
}

function serializeGuestCheckIn(guest, checkIn, reservation, tokenExpired) {
  const client = guest.client || {};
  const prefill = clientPrefill(client, reservation, guest);
  const fields = mergeFields(checkIn, prefill);
  const status = checkIn?.status || 'PENDING';
  const visual = displayStatus(checkIn, tokenExpired);
  return {
    guestId: guest.id,
    clientId: guest.clientId || checkIn?.clientId || null,
    isHolder: Number(guest.clientId) === Number(reservation.mainClientId),
    name: [guest.firstName, guest.lastName].filter(Boolean).join(' ') || fields.firstName,
    status,
    displayStatus: visual,
    sentAt: checkIn?.sentAt || null,
    completedAt: checkIn?.completedAt || null,
    validatedAt: checkIn?.validatedAt || null,
    fields,
    documentPhotos: {
      frontUploaded: Boolean(checkIn?.documentFrontUploadedAt),
      backUploaded: Boolean(checkIn?.documentBackUploadedAt)
    },
    completed: status === 'COMPLETED'
  };
}

function progressFromGuests(guestPayloads) {
  const total = guestPayloads.length;
  const completed = guestPayloads.filter((g) => g.completed || g.displayStatus === 'completo').length;
  return { completed, total, label: `${completed}/${total}` };
}

function aggregateStatus(guestPayloads, hasToken) {
  if (!guestPayloads.length) return hasToken ? 'SENT' : null;
  if (guestPayloads.every((g) => g.status === 'COMPLETED')) return 'COMPLETED';
  if (guestPayloads.some((g) => g.status === 'SENT' || g.status === 'COMPLETED')) return 'SENT';
  if (guestPayloads.some((g) => g.status === 'EXPIRED')) return 'EXPIRED';
  return 'PENDING';
}

/**
 * Staff: estado del check-in de una reserva (progreso N/M + por huésped).
 */
async function getReservationCheckIn(req, res) {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return res.status(400).json({ error: 'ID de reserva inválido' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        mainClient: true,
        guests: { include: { client: true }, orderBy: { id: 'asc' } },
        onlineCheckIns: true
      }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (reservation.guests?.length) {
      await ensureGuestCheckInRows(reservation);
      const refreshed = await prisma.onlineCheckIn.findMany({
        where: { reservationId, guestId: { not: null } }
      });
      reservation.onlineCheckIns = refreshed;
    }

    const tokenExpired = isExpired(reservation.checkInTokenExpiresAt);
    const byGuest = new Map(
      (reservation.onlineCheckIns || [])
        .filter((c) => c.guestId != null)
        .map((c) => [c.guestId, c])
    );
    const guests = (reservation.guests || []).map((guest) =>
      serializeGuestCheckIn(guest, byGuest.get(guest.id), reservation, tokenExpired)
    );
    const progress = progressFromGuests(guests);
    const checkInUrl = reservation.checkInToken
      ? buildCheckInUrl(reservation.checkInToken)
      : null;
    const status = aggregateStatus(guests, Boolean(reservation.checkInToken));

    return res.json({
      reservationId,
      vehiclePlate: reservation.vehiclePlate || null,
      progress,
      guests,
      checkIn: reservation.checkInToken || guests.length
        ? {
            id: null,
            status: status || 'PENDING',
            sentAt: reservation.checkInTokenSentAt,
            completedAt: progress.completed === progress.total && progress.total > 0
              ? guests.map((g) => g.completedAt).filter(Boolean).sort().slice(-1)[0] || null
              : null,
            expiresAt: reservation.checkInTokenExpiresAt,
            vehiclePlate: reservation.vehiclePlate,
            checkInUrl,
            progress
          }
        : null
    });
  } catch (error) {
    console.error('getReservationCheckIn', error);
    return res.status(500).json({ error: 'Error al obtener check-in' });
  }
}

/**
 * Staff: generar/renovar token de reserva y asegurar filas por huésped.
 */
async function sendReservationCheckIn(req, res) {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return res.status(400).json({ error: 'ID de reserva inválido' });
    }

    let reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        mainClient: true,
        guests: { include: { client: true }, orderBy: { id: 'asc' } }
      }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Si no hay huéspedes, incorporar al responsable (misma vía Guest↔Reservation).
    if (!reservation.guests?.length) {
      await ensureHolderAsGuest(prisma, reservationId, reservation.mainClientId);
      reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          mainClient: true,
          guests: { include: { client: true }, orderBy: { id: 'asc' } }
        }
      });
    }

    if (!reservation.guests?.length) {
      return res.status(400).json({
        error: 'La reserva no tiene huéspedes. Agregá al menos uno antes de enviar el check-in.'
      });
    }

    const client = reservation.mainClient;
    const to = normalizeText(req.body?.to) || normalizeText(client?.email);
    if (!to) {
      return res.status(400).json({
        error: 'La reserva no tiene email de cliente. Cargá un email o indicá uno en el envío.'
      });
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = expiryDateFromNow();
    const sentAt = new Date();

    reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkInToken: token,
        checkInTokenSentAt: sentAt,
        checkInTokenExpiresAt: expiresAt
      },
      include: {
        mainClient: true,
        guests: { include: { client: true }, orderBy: { id: 'asc' } }
      }
    });

    await ensureGuestCheckInRows(reservation, { markSent: true });

    const checkInUrl = buildCheckInUrl(token);
    const guestName = [client?.firstName, client?.lastName].filter(Boolean).join(' ');
    const mailtoUrl = buildMailto({
      to,
      guestName,
      checkInUrl,
      reservationId
    });

    let mailResult = { emailed: false, reason: 'not_attempted' };
    try {
      mailResult = await sendCheckInEmail({
        to,
        guestName,
        checkInUrl,
        reservationId
      });
    } catch (mailError) {
      console.error('sendCheckInEmail failed', mailError);
      mailResult = { emailed: false, reason: 'smtp_error', detail: mailError.message };
    }

    const guestRows = await prisma.onlineCheckIn.findMany({
      where: { reservationId, guestId: { not: null } }
    });
    const byGuest = new Map(guestRows.map((c) => [c.guestId, c]));
    const guests = reservation.guests.map((g) =>
      serializeGuestCheckIn(g, byGuest.get(g.id), reservation, false)
    );
    const progress = progressFromGuests(guests);

    return res.status(201).json({
      checkIn: {
        id: null,
        status: aggregateStatus(guests, true),
        sentAt,
        expiresAt,
        checkInUrl,
        progress
      },
      progress,
      guests,
      to,
      checkInUrl,
      mailtoUrl,
      emailed: Boolean(mailResult.emailed),
      mailReason: mailResult.reason || null
    });
  } catch (error) {
    console.error('sendReservationCheckIn', error);
    return res.status(500).json({ error: 'Error al enviar check-in' });
  }
}

/**
 * Público: lista de huéspedes + estados (o form data por guestId query).
 */
async function getPublicCheckIn(req, res) {
  try {
    const token = normalizeTokenParam(req.params.token);
    if (!isWellFormedToken(token)) {
      return res.status(400).json({
        error: 'Link incompleto o corrupto. Pedí un link nuevo desde la reserva.'
      });
    }

    const access = await resolveAccessByToken(token);
    if (!access) {
      return res.status(404).json({ error: 'Link de check-in inválido' });
    }

    const { reservation, expiresAt } = access;
    if (isExpired(expiresAt)) {
      await prisma.onlineCheckIn.updateMany({
        where: {
          reservationId: reservation.id,
          guestId: { not: null },
          status: { not: 'COMPLETED' }
        },
        data: { status: 'EXPIRED' }
      });
      return res.status(410).json({ error: 'Este link de check-in expiró' });
    }

    if (!reservation.guests?.length) {
      await ensureHolderAsGuest(prisma, reservation.id, reservation.mainClientId);
      const refreshed = await prisma.reservation.findUnique({
        where: { id: reservation.id },
        include: {
          mainClient: true,
          guests: { include: { client: true }, orderBy: { id: 'asc' } },
          segments: { orderBy: { startDate: 'asc' }, take: 1 }
        }
      });
      if (refreshed) {
        reservation.guests = refreshed.guests;
        reservation.segments = refreshed.segments;
      }
    }

    await ensureGuestCheckInRows(reservation);
    const checkIns = await prisma.onlineCheckIn.findMany({
      where: { reservationId: reservation.id, guestId: { not: null } }
    });
    const byGuest = new Map(checkIns.map((c) => [c.guestId, c]));
    const guests = (reservation.guests || []).map((guest) =>
      serializeGuestCheckIn(guest, byGuest.get(guest.id), reservation, false)
    );
    const progress = progressFromGuests(guests);
    const segment = reservation.segments?.[0];
    const guestIdParam = req.query.guestId != null ? Number(req.query.guestId) : null;
    const selected =
      guestIdParam && Number.isFinite(guestIdParam)
        ? guests.find((g) => g.guestId === guestIdParam) || null
        : null;

    return res.json({
      status: aggregateStatus(guests, true),
      completed: progress.total > 0 && progress.completed === progress.total,
      progress,
      reservation: {
        id: reservation.id,
        checkIn: segment?.startDate || null,
        checkOut: segment?.endDate || null
      },
      guests,
      // Compat: si hay un solo huésped, exponer fields en raíz (forms viejos / 1 huésped).
      fields: selected?.fields || (guests.length === 1 ? guests[0].fields : null),
      documentPhotos:
        selected?.documentPhotos ||
        (guests.length === 1 ? guests[0].documentPhotos : { frontUploaded: false, backUploaded: false }),
      selectedGuestId: selected?.guestId || (guests.length === 1 ? guests[0].guestId : null)
    });
  } catch (error) {
    console.error('getPublicCheckIn', error);
    return res.status(500).json({ error: 'Error al cargar check-in' });
  }
}

async function resolveGuestCheckInForAccess(access, guestIdRaw) {
  const guestId = Number(guestIdRaw);
  if (!Number.isFinite(guestId)) {
    return { error: 'guestId inválido', status: 400 };
  }
  const reservation = access.reservation;
  const guest = (reservation.guests || []).find((g) => g.id === guestId);
  if (!guest) {
    return { error: 'Huésped no encontrado en esta reserva', status: 404 };
  }
  await ensureGuestCheckInRows(reservation);
  const checkIn = await prisma.onlineCheckIn.findFirst({
    where: { reservationId: reservation.id, guestId }
  });
  if (!checkIn) {
    return { error: 'Registro de check-in no encontrado', status: 404 };
  }
  return { guest, checkIn, reservation };
}

/**
 * Asegura Client para el huésped (upsert mínimo) y lo vincula.
 */
async function ensureClientForGuest(tx, guest, data) {
  if (guest.clientId) {
    return guest.clientId;
  }
  const created = await tx.client.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      documentType: data.documentType || 'DNI',
      documentNumber: data.documentNumber,
      birthDate: data.birthDate || null,
      country: data.country || 'AR',
      province: data.province || null,
      city: data.city || null,
      notes: createNotesWithAddress(null, data.address),
      vehiclePlate: data.vehiclePlate || null,
      wantsPromotions: Boolean(data.wantsPromotions)
    }
  });
  await tx.guest.update({
    where: { id: guest.id },
    data: { clientId: created.id }
  });
  return created.id;
}

/**
 * Público: subir foto frente/dorso del huésped (siempre nueva en este check-in).
 */
async function uploadPublicCheckInDocumentPhoto(req, res) {
  try {
    const token = normalizeTokenParam(req.params.token);
    if (!isWellFormedToken(token)) {
      return res.status(400).json({
        error: 'Link incompleto o corrupto. Pedí un link nuevo desde la reserva.'
      });
    }

    const checked = assertSlot(req.params.slot);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo requerido' });
    }

    const access = await resolveAccessByToken(token);
    if (!access) {
      return res.status(404).json({ error: 'Link de check-in inválido' });
    }
    if (isExpired(access.expiresAt)) {
      return res.status(410).json({ error: 'Este link de check-in expiró' });
    }

    const guestIdRaw = req.body?.guestId ?? req.query?.guestId;
    let guestId = guestIdRaw;
    if (guestId == null && access.reservation.guests?.length === 1) {
      guestId = access.reservation.guests[0].id;
    }
    const resolved = await resolveGuestCheckInForAccess(access, guestId);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { guest, checkIn, reservation } = resolved;

    if (checkIn.status === 'COMPLETED') {
      // Permitir re-edición: reabrir a SENT al subir fotos nuevas
      await prisma.onlineCheckIn.update({
        where: { id: checkIn.id },
        data: {
          status: 'SENT',
          completedAt: null,
          documentFrontUploadedAt: null,
          documentBackUploadedAt: null
        }
      });
      checkIn.status = 'SENT';
      checkIn.documentFrontUploadedAt = null;
      checkIn.documentBackUploadedAt = null;
    }

    let clientId = guest.clientId || checkIn.clientId;
    if (!clientId) {
      clientId = await prisma.$transaction(async (tx) =>
        ensureClientForGuest(tx, guest, {
          firstName: guest.firstName || 'Huésped',
          lastName: guest.lastName || String(guest.id),
          email: guest.email || null,
          phone: guest.phone || null,
          documentType: guest.documentType || 'DNI',
          documentNumber: guest.documentNumber || null,
          city: guest.city || null,
          address: guest.address || null
        })
      );
      await prisma.onlineCheckIn.update({
        where: { id: checkIn.id },
        data: { clientId }
      });
    }

    const result = saveDocumentPhoto(clientId, req.file, checked.slot);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const now = new Date();
    const checkInPhotoField =
      checked.slot === 'front' ? { documentFrontUploadedAt: now } : { documentBackUploadedAt: now };

    await prisma.$transaction([
      prisma.client.update({
        where: { id: clientId },
        data: prismaFieldsForSlot(checked.slot, result.meta)
      }),
      prisma.onlineCheckIn.update({
        where: { id: checkIn.id },
        data: {
          ...checkInPhotoField,
          clientId,
          status: checkIn.status === 'PENDING' ? 'SENT' : checkIn.status
        }
      })
    ]);

    return res.status(201).json({
      ok: true,
      guestId: guest.id,
      slot: checked.slot,
      originalName: result.meta.originalName,
      mimeType: result.meta.mimeType,
      sizeBytes: result.meta.sizeBytes,
      updatedAt: result.meta.updatedAt,
      reservationId: reservation.id
    });
  } catch (error) {
    console.error('uploadPublicCheckInDocumentPhoto', error);
    return res.status(500).json({ error: 'Error al subir la foto del documento' });
  }
}

/**
 * Público / staff vía mismo link: guardar check-in de un huésped.
 */
async function submitPublicCheckIn(req, res) {
  try {
    const token = normalizeTokenParam(req.params.token);
    if (!isWellFormedToken(token)) {
      return res.status(400).json({
        error: 'Link incompleto o corrupto. Pedí un link nuevo desde la reserva.'
      });
    }

    const access = await resolveAccessByToken(token);
    if (!access) {
      return res.status(404).json({ error: 'Link de check-in inválido' });
    }
    if (isExpired(access.expiresAt)) {
      return res.status(410).json({ error: 'Este link de check-in expiró' });
    }

    const body = req.body || {};
    let guestId = body.guestId;
    if (guestId == null && access.reservation.guests?.length === 1) {
      guestId = access.reservation.guests[0].id;
    }
    const resolved = await resolveGuestCheckInForAccess(access, guestId);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { guest, checkIn, reservation } = resolved;

    const firstName = normalizeText(body.firstName);
    const lastName = normalizeText(body.lastName);
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
    }

    let birthDate;
    try {
      birthDate = parseBirthDate(body.birthDate);
    } catch {
      return res.status(400).json({ error: 'Fecha de nacimiento inválida' });
    }
    if (!birthDate) {
      return res.status(400).json({ error: 'La fecha de nacimiento es obligatoria' });
    }

    // Releer flags de fotos (por si se reabrió)
    const fresh = await prisma.onlineCheckIn.findUnique({ where: { id: checkIn.id } });
    if (!fresh?.documentFrontUploadedAt || !fresh?.documentBackUploadedAt) {
      return res.status(400).json({
        error: 'Debés subir la foto del frente y del dorso del documento'
      });
    }

    const email = normalizeText(body.email);
    const phone = normalizeText(body.phone);
    const documentType = normalizeDocumentType(body.documentType);
    const documentNumber = normalizeText(body.documentNumber);
    const country = normalizeText(body.country) || 'AR';
    const province = normalizeText(body.province);
    const city = normalizeText(body.city);
    const address = normalizeText(body.address);
    const wantsPromotions = Boolean(body.wantsPromotions);
    const vehiclePlate = normalizePlate(body.vehiclePlate);
    const markValidated = Boolean(body.validated);

    const result = await prisma.$transaction(async (tx) => {
      const clientId = await ensureClientForGuest(tx, guest, {
        firstName,
        lastName,
        email,
        phone,
        documentType,
        documentNumber,
        birthDate,
        country,
        province,
        city,
        address,
        vehiclePlate,
        wantsPromotions
      });

      const existingClient = await tx.client.findUnique({
        where: { id: clientId },
        select: { notes: true }
      });
      const notes = createNotesWithAddress(existingClient?.notes, address);

      await tx.client.update({
        where: { id: clientId },
        data: {
          firstName,
          lastName,
          email,
          phone,
          documentType,
          documentNumber,
          birthDate,
          country,
          province,
          city,
          wantsPromotions,
          notes,
          vehiclePlate
        }
      });

      await tx.guest.update({
        where: { id: guest.id },
        data: {
          firstName,
          lastName,
          email,
          phone,
          documentType,
          documentNumber,
          city,
          address,
          clientId
        }
      });

      if (vehiclePlate) {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { vehiclePlate }
        });
      }

      return tx.onlineCheckIn.update({
        where: { id: checkIn.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          validatedAt: markValidated ? new Date() : checkIn.validatedAt,
          clientId,
          firstName,
          lastName,
          email,
          phone,
          documentType,
          documentNumber,
          birthDate,
          country,
          province,
          city,
          address,
          vehiclePlate
        }
      });
    });

    const all = await prisma.onlineCheckIn.findMany({
      where: { reservationId: reservation.id, guestId: { not: null } }
    });
    const completed = all.filter((c) => c.status === 'COMPLETED').length;

    return res.json({
      ok: true,
      guestId: guest.id,
      status: result.status,
      completedAt: result.completedAt,
      vehiclePlate: result.vehiclePlate,
      progress: { completed, total: all.length, label: `${completed}/${all.length}` }
    });
  } catch (error) {
    console.error('submitPublicCheckIn', error);
    return res.status(500).json({ error: 'Error al guardar check-in' });
  }
}

module.exports = {
  getReservationCheckIn,
  sendReservationCheckIn,
  getPublicCheckIn,
  uploadPublicCheckInDocumentPhoto,
  submitPublicCheckIn
};
