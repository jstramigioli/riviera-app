const crypto = require('crypto');
const prisma = require('../utils/prisma');
const {
  buildCheckInUrl,
  buildMailto,
  sendCheckInEmail
} = require('../services/checkInMail');
const { getAddressFromNotes } = require('../utils/clientAddressNotes');
const {
  assertSlot,
  saveDocumentPhoto,
  prismaFieldsForSlot
} = require('../utils/clientDocumentPhoto');
const {
  saveCheckInDocumentPhoto,
  prismaCheckInFieldsForSlot,
  absolutePath: checkInPhotoAbsolutePath,
  readAllMeta: readCheckInPhotoMeta
} = require('../utils/checkInDocumentPhoto');
const { ensureHolderAsGuest } = require('../utils/guestHelpers');
const {
  buildIdentityKey,
  resolveClientIdentity
} = require('../services/resolveClientIdentity');
const fs = require('fs');

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

/** Form externo: siempre vacío (sin precarga de ficha Client). */
function emptyPersonalFields() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    documentType: 'DNI',
    documentNumber: '',
    documentIssuingCountry: 'AR',
    birthDate: '',
    country: 'AR',
    province: '',
    city: '',
    address: '',
    wantsPromotions: false,
    dietVegetariano: false,
    dietVegano: false,
    dietCeliaco: false
  };
}

/** Snapshot de esta estadía (OnlineCheckIn), no de la ficha Client. */
function snapshotFields(checkIn) {
  if (!checkIn) return emptyPersonalFields();
  const hasSnapshot = Boolean(
    checkIn.firstName ||
      checkIn.lastName ||
      checkIn.documentNumber ||
      checkIn.completedAt ||
      checkIn.documentFrontUploadedAt
  );
  if (!hasSnapshot) return emptyPersonalFields();
  return {
    firstName: checkIn.firstName || '',
    lastName: checkIn.lastName || '',
    email: checkIn.email || '',
    phone: checkIn.phone || '',
    documentType: checkIn.documentType || 'DNI',
    documentNumber: checkIn.documentNumber || '',
    documentIssuingCountry: checkIn.documentIssuingCountry || 'AR',
    birthDate: birthDateToInputValue(checkIn.birthDate),
    country: checkIn.country || 'AR',
    province: checkIn.province || '',
    city: checkIn.city || '',
    address: checkIn.address || '',
    wantsPromotions: false,
    dietVegetariano: Boolean(checkIn.dietVegetariano),
    dietVegano: Boolean(checkIn.dietVegano),
    dietCeliaco: Boolean(checkIn.dietCeliaco)
  };
}

/** Prefill staff (interno): ficha Client + guest. */
function clientPrefill(client = {}, reservation = {}, guest = {}) {
  return {
    firstName: client.firstName || guest.firstName || '',
    lastName: client.lastName || guest.lastName || '',
    email: client.email || guest.email || '',
    phone: client.phone || guest.phone || '',
    documentType: client.documentType || guest.documentType || 'DNI',
    documentNumber: client.documentNumber || guest.documentNumber || '',
    documentIssuingCountry:
      client.documentIssuingCountry || guest.documentIssuingCountry || client.country || 'AR',
    birthDate: birthDateToInputValue(client.birthDate),
    country: client.country || 'AR',
    province: client.province || '',
    city: client.city || guest.city || '',
    address: getAddressFromNotes(client.notes) || guest.address || '',
    wantsPromotions: Boolean(client.wantsPromotions),
    dietVegetariano: Boolean(guest.dietVegetariano),
    dietVegano: Boolean(guest.dietVegano),
    dietCeliaco: Boolean(guest.dietCeliaco)
  };
}

const PUBLIC_SEGMENTS_INCLUDE = {
  orderBy: { startDate: 'asc' },
  include: {
    room: { include: { roomType: true } },
    roomType: true,
    virtualRoom: { include: { roomType: true } }
  }
};

function serializePublicSegments(segments = []) {
  return segments.map((seg) => {
    const roomTypeName =
      seg.roomType?.name ||
      seg.room?.roomType?.name ||
      seg.virtualRoom?.roomType?.name ||
      null;
    return {
      id: seg.id,
      startDate: seg.startDate,
      endDate: seg.endDate,
      guestCount: seg.guestCount,
      serviceType: seg.serviceType || null,
      reservationType: seg.reservationType || null,
      services: Array.isArray(seg.services) ? seg.services : undefined,
      isActive: seg.isActive !== false,
      isVirtual: Boolean(seg.isVirtual),
      // Sin nº de habitación: solo tipo.
      roomType: roomTypeName ? { name: roomTypeName } : null,
      room: roomTypeName ? { roomType: { name: roomTypeName } } : null
    };
  });
}

function reservationVehicleCount(reservation) {
  const fromReservation = Number(reservation?.vehicleCount) || 0;
  const fromSegments = Math.max(
    0,
    ...(reservation?.segments || []).map((s) => Number(s?.vehicleCount) || 0)
  );
  return Math.max(fromReservation, fromSegments);
}

function serializePublicReservation(reservation) {
  const segments = serializePublicSegments(reservation.segments || []);
  const first = segments[0];
  const last = segments[segments.length - 1];
  const vehicleCount = reservationVehicleCount(reservation);
  return {
    id: reservation.id,
    checkIn: first?.startDate || null,
    checkOut: last?.endDate || null,
    requiredGuests: reservation.requiredGuests || null,
    days: reservation.days || null,
    vehiclePlate: reservation.vehiclePlate || null,
    vehicleCount,
    vehicleType: reservation.vehicleType || null,
    trailerCount: Number(reservation.trailerCount) || 0,
    segments,
    mainClient: reservation.mainClient
      ? {
          firstName: reservation.mainClient.firstName || '',
          lastName: reservation.mainClient.lastName || ''
        }
      : null
  };
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
    documentIssuingCountry:
      checkIn?.documentIssuingCountry || prefill.documentIssuingCountry || 'AR',
    birthDate: birthDateToInputValue(checkIn?.birthDate) || prefill.birthDate,
    country: checkIn?.country || prefill.country || 'AR',
    province: checkIn?.province || prefill.province,
    city: checkIn?.city || prefill.city,
    address: checkIn?.address || prefill.address,
    wantsPromotions: prefill.wantsPromotions
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
      segments: PUBLIC_SEGMENTS_INCLUDE,
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
          segments: PUBLIC_SEGMENTS_INCLUDE,
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
          dietVegetariano: Boolean(guest.dietVegetariano),
          dietVegano: Boolean(guest.dietVegano),
          dietCeliaco: Boolean(guest.dietCeliaco)
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

/**
 * @param {'public'|'staff'} mode — public: form vacío / solo snapshot de estadía; staff: prefill ficha.
 */
function serializeGuestCheckIn(guest, checkIn, reservation, tokenExpired, mode = 'staff') {
  const client = guest.client || {};
  const fields =
    mode === 'public'
      ? snapshotFields(checkIn)
      : mergeFields(checkIn, clientPrefill(client, reservation, guest));
  const status = checkIn?.status || 'PENDING';
  const visual = displayStatus(checkIn, tokenExpired);
  const labelName =
    mode === 'public'
      ? [guest.firstName, guest.lastName].filter(Boolean).join(' ') ||
        (checkIn?.firstName ? `${checkIn.firstName} ${checkIn.lastName || ''}`.trim() : '') ||
        `Huésped ${guest.id}`
      : [guest.firstName, guest.lastName].filter(Boolean).join(' ') || fields.firstName;
  return {
    guestId: guest.id,
    clientId: guest.clientId || checkIn?.clientId || null,
    isHolder: Number(guest.clientId) === Number(reservation.mainClientId),
    name: labelName,
    status,
    displayStatus: visual,
    sentAt: checkIn?.sentAt || null,
    completedAt: checkIn?.completedAt || null,
    validatedAt: checkIn?.validatedAt || null,
    needsManualReview: Boolean(checkIn?.needsManualReview),
    identityConflictNote: checkIn?.identityConflictNote || null,
    fields,
    documentPhotos: {
      frontUploaded: Boolean(checkIn?.documentFrontUploadedAt || checkIn?.documentPhotoFrontStoredName),
      backUploaded: Boolean(checkIn?.documentBackUploadedAt || checkIn?.documentPhotoBackStoredName)
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
          segments: PUBLIC_SEGMENTS_INCLUDE
        }
      });
      if (refreshed) {
        reservation.guests = refreshed.guests;
        reservation.segments = refreshed.segments;
        reservation.mainClient = refreshed.mainClient;
        reservation.vehiclePlate = refreshed.vehiclePlate;
      }
    }

    await ensureGuestCheckInRows(reservation);
    const checkIns = await prisma.onlineCheckIn.findMany({
      where: { reservationId: reservation.id, guestId: { not: null } }
    });
    const byGuest = new Map(checkIns.map((c) => [c.guestId, c]));
    const guests = (reservation.guests || []).map((guest) =>
      serializeGuestCheckIn(guest, byGuest.get(guest.id), reservation, false, 'public')
    );
    const progress = progressFromGuests(guests);
    const guestIdParam = req.query.guestId != null ? Number(req.query.guestId) : null;
    const selected =
      guestIdParam && Number.isFinite(guestIdParam)
        ? guests.find((g) => g.guestId === guestIdParam) || null
        : null;
    const plate = normalizePlate(reservation.vehiclePlate);
    const publicReservation = serializePublicReservation(reservation);
    const needsVehicleCard = publicReservation.vehicleCount >= 1;

    return res.json({
      status: aggregateStatus(guests, true),
      completed: progress.total > 0 && progress.completed === progress.total,
      progress,
      reservation: publicReservation,
      vehicle: needsVehicleCard
        ? {
            plate: plate || '',
            completed: Boolean(plate),
            displayStatus: plate ? 'completo' : 'pendiente',
            vehicleType: publicReservation.vehicleType || null,
            required: true
          }
        : null,
      guests,
      // Compat: si hay un solo huésped, exponer fields en raíz (forms viejos / 1 huésped).
      // Público: fields vacíos salvo snapshot de esta estadía (nunca precarga de Client).
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

/**
 * Público: guardar patente a nivel reserva (ficha vehículo, no por pasajero).
 */
async function submitPublicCheckInVehicle(req, res) {
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

    if (reservationVehicleCount(access.reservation) < 1) {
      return res.status(400).json({
        error: 'Esta reserva no requiere vehículo'
      });
    }

    const vehiclePlate = normalizePlate(req.body?.vehiclePlate ?? req.body?.plate);
    const updated = await prisma.reservation.update({
      where: { id: access.reservation.id },
      data: { vehiclePlate }
    });

    return res.json({
      ok: true,
      vehicle: {
        plate: updated.vehiclePlate || '',
        completed: Boolean(updated.vehiclePlate),
        displayStatus: updated.vehiclePlate ? 'completo' : 'pendiente',
        vehicleType: updated.vehicleType || access.reservation.vehicleType || null,
        required: true
      }
    });
  } catch (error) {
    console.error('submitPublicCheckInVehicle', error);
    return res.status(500).json({ error: 'Error al guardar el vehículo' });
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
 * Público: subir foto frente/dorso del huésped (siempre nueva en este check-in).
 * Snapshot en OnlineCheckIn + copia actual en ficha Client (si ya hay vínculo).
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
      // Permitir re-edición: reabrir a SENT al subir fotos nuevas de esta estadía
      await prisma.onlineCheckIn.update({
        where: { id: checkIn.id },
        data: {
          status: 'SENT',
          completedAt: null,
          documentFrontUploadedAt: null,
          documentBackUploadedAt: null,
          ...prismaCheckInFieldsForSlot('front', null),
          ...prismaCheckInFieldsForSlot('back', null)
        }
      });
      checkIn.status = 'SENT';
      checkIn.documentFrontUploadedAt = null;
      checkIn.documentBackUploadedAt = null;
    }

    const stayPhoto = saveCheckInDocumentPhoto(checkIn.id, req.file, checked.slot);
    if (stayPhoto.error) {
      return res.status(400).json({ error: stayPhoto.error });
    }

    const now = new Date();
    const checkInPhotoField =
      checked.slot === 'front' ? { documentFrontUploadedAt: now } : { documentBackUploadedAt: now };

    let clientId = guest.clientId || checkIn.clientId || null;
    // Si ya hay client vinculado, actualizar ficha actual; el snapshot de estadía queda aparte.
    if (clientId) {
      const clientPhoto = saveDocumentPhoto(clientId, req.file, checked.slot);
      if (!clientPhoto.error) {
        await prisma.client.update({
          where: { id: clientId },
          data: prismaFieldsForSlot(checked.slot, clientPhoto.meta)
        });
      }
    }

    await prisma.onlineCheckIn.update({
      where: { id: checkIn.id },
      data: {
        ...checkInPhotoField,
        ...prismaCheckInFieldsForSlot(checked.slot, stayPhoto.meta),
        clientId: clientId || undefined,
        status: checkIn.status === 'PENDING' ? 'SENT' : checkIn.status
      }
    });

    return res.status(201).json({
      ok: true,
      guestId: guest.id,
      slot: checked.slot,
      originalName: stayPhoto.meta.originalName,
      mimeType: stayPhoto.meta.mimeType,
      sizeBytes: stayPhoto.meta.sizeBytes,
      updatedAt: stayPhoto.meta.updatedAt,
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
    const identity = buildIdentityKey({
      documentType: body.documentType,
      documentNumber: body.documentNumber,
      documentIssuingCountry: body.documentIssuingCountry || body.issuingCountry
    });
    const documentType = identity.documentType;
    const documentNumber = identity.documentNumber;
    const documentIssuingCountry = identity.documentIssuingCountry;
    const documentNumberNormalized = identity.documentNumberNormalized;
    const country = normalizeText(body.country) || 'AR';
    const province = normalizeText(body.province);
    const city = normalizeText(body.city);
    const address = normalizeText(body.address);
    const wantsPromotions = Boolean(body.wantsPromotions);
    const dietVegetariano = Boolean(body.dietVegetariano);
    const dietVegano = Boolean(body.dietVegano);
    const dietCeliaco = Boolean(body.dietCeliaco);
    const markValidated = Boolean(body.validated);

    if (!documentNumberNormalized) {
      return res.status(400).json({ error: 'El número de documento es obligatorio' });
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const resolution = await resolveClientIdentity(
          tx,
          {
            firstName,
            lastName,
            email,
            phone,
            documentType,
            documentNumber,
            documentIssuingCountry,
            birthDate,
            country,
            province,
            city,
            address,
            wantsPromotions
          },
          { preferredClientId: guest.clientId || checkIn.clientId || null }
        );

        const clientId = resolution.client.id;

        await tx.guest.update({
          where: { id: guest.id },
          data: {
            firstName,
            lastName,
            email,
            phone,
            documentType,
            documentNumber,
            documentIssuingCountry,
            city,
            address,
            clientId,
            dietVegetariano,
            dietVegano,
            dietCeliaco
          }
        });

        return {
          checkIn: await tx.onlineCheckIn.update({
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
              documentIssuingCountry,
              documentNumberNormalized,
              birthDate,
              country,
              province,
              city,
              address,
              dietVegetariano,
              dietVegano,
              dietCeliaco,
              needsManualReview: resolution.needsManualReview,
              identityConflictNote: resolution.identityConflictNote
            }
          }),
          resolution
        };
      });
    } catch (txError) {
      if (txError.status === 400) {
        return res.status(400).json({ error: txError.message });
      }
      if (txError.code === 'P2002') {
        return res.status(409).json({
          error: 'Ya existe un cliente con ese tipo, país emisor y número de documento'
        });
      }
      throw txError;
    }

    // Sincronizar fotos de estadía → ficha Client actual (sin mutar el snapshot).
    try {
      const clientId = result.resolution.client.id;
      const stayMeta = readCheckInPhotoMeta(checkIn.id);
      for (const slot of ['front', 'back']) {
        const meta = stayMeta[slot];
        if (!meta?.storedName) continue;
        const src = checkInPhotoAbsolutePath(checkIn.id, meta.storedName);
        if (!fs.existsSync(src)) continue;
        const buffer = fs.readFileSync(src);
        const fakeFile = {
          buffer,
          mimetype: meta.mimeType || 'image/jpeg',
          size: meta.sizeBytes || buffer.length,
          originalname: meta.originalName || meta.storedName
        };
        const saved = saveDocumentPhoto(clientId, fakeFile, slot);
        if (!saved.error) {
          await prisma.client.update({
            where: { id: clientId },
            data: prismaFieldsForSlot(slot, saved.meta)
          });
        }
      }
    } catch (syncErr) {
      console.warn('sync check-in photos to client', syncErr.message);
    }

    const all = await prisma.onlineCheckIn.findMany({
      where: { reservationId: reservation.id, guestId: { not: null } }
    });
    const completed = all.filter((c) => c.status === 'COMPLETED').length;

    return res.json({
      ok: true,
      guestId: guest.id,
      status: result.checkIn.status,
      completedAt: result.checkIn.completedAt,
      needsManualReview: result.resolution.needsManualReview,
      identityConflictNote: result.resolution.identityConflictNote,
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
  submitPublicCheckIn,
  submitPublicCheckInVehicle
};
