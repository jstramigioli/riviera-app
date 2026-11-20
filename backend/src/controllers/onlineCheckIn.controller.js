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

function clientPrefill(client = {}, reservation = {}) {
  return {
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    email: client.email || '',
    phone: client.phone || '',
    documentType: client.documentType || 'DNI',
    documentNumber: client.documentNumber || '',
    country: client.country || 'AR',
    province: client.province || '',
    city: client.city || '',
    address: getAddressFromNotes(client.notes),
    wantsPromotions: Boolean(client.wantsPromotions),
    vehiclePlate: reservation.vehiclePlate || client.vehiclePlate || ''
  };
}

function normalizeDocumentType(value) {
  const cleaned = normalizeText(value) || 'DNI';
  return CLIENT_DOCUMENT_TYPES.includes(cleaned) ? cleaned : 'DNI';
}

async function getLatestCheckIn(reservationId) {
  return prisma.onlineCheckIn.findFirst({
    where: { reservationId },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Staff: estado del check-in de una reserva.
 */
async function getReservationCheckIn(req, res) {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return res.status(400).json({ error: 'ID de reserva inválido' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { mainClient: true }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const checkIn = await getLatestCheckIn(reservationId);
    const checkInUrl = checkIn ? buildCheckInUrl(checkIn.token) : null;

    return res.json({
      reservationId,
      vehiclePlate: reservation.vehiclePlate || null,
      checkIn: checkIn
        ? {
            id: checkIn.id,
            status: checkIn.status,
            sentAt: checkIn.sentAt,
            completedAt: checkIn.completedAt,
            expiresAt: checkIn.expiresAt,
            vehiclePlate: checkIn.vehiclePlate,
            checkInUrl
          }
        : null
    });
  } catch (error) {
    console.error('getReservationCheckIn', error);
    return res.status(500).json({ error: 'Error al obtener check-in' });
  }
}

/**
 * Staff: generar/renovar token y enviar (o preparar mailto) al cliente.
 */
async function sendReservationCheckIn(req, res) {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return res.status(400).json({ error: 'ID de reserva inválido' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { mainClient: true }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const client = reservation.mainClient;
    const to = normalizeText(req.body?.to) || normalizeText(client?.email);
    if (!to) {
      return res.status(400).json({
        error: 'La reserva no tiene email de cliente. Cargá un email o indicá uno en el envío.'
      });
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(process.env.CHECKIN_TOKEN_DAYS || DEFAULT_EXPIRY_DAYS));

    const checkIn = await prisma.onlineCheckIn.create({
      data: {
        reservationId,
        token,
        status: 'SENT',
        sentAt: new Date(),
        expiresAt,
        firstName: client?.firstName || null,
        lastName: client?.lastName || null,
        email: to,
        phone: client?.phone || null,
        documentType: client?.documentType || null,
        documentNumber: client?.documentNumber || null,
        country: client?.country || null,
        province: client?.province || null,
        city: client?.city || null,
        vehiclePlate: reservation.vehiclePlate || client?.vehiclePlate || null
      }
    });

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

    return res.status(201).json({
      checkIn: {
        id: checkIn.id,
        status: checkIn.status,
        sentAt: checkIn.sentAt,
        expiresAt: checkIn.expiresAt,
        checkInUrl
      },
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
 * Público: obtener formulario prellenado por token.
 */
async function getPublicCheckIn(req, res) {
  try {
    const token = normalizeTokenParam(req.params.token);
    if (!isWellFormedToken(token)) {
      return res.status(400).json({
        error: 'Link incompleto o corrupto. Pedí un link nuevo desde la reserva.'
      });
    }

    const checkIn = await prisma.onlineCheckIn.findUnique({
      where: { token },
      include: {
        reservation: {
          include: {
            mainClient: true,
            segments: {
              orderBy: { startDate: 'asc' },
              take: 1
            }
          }
        }
      }
    });

    if (!checkIn) {
      return res.status(404).json({ error: 'Link de check-in inválido' });
    }

    if (checkIn.expiresAt && checkIn.expiresAt < new Date()) {
      if (checkIn.status !== 'EXPIRED') {
        await prisma.onlineCheckIn.update({
          where: { id: checkIn.id },
          data: { status: 'EXPIRED' }
        });
      }
      return res.status(410).json({ error: 'Este link de check-in expiró' });
    }

    const reservation = checkIn.reservation;
    const client = reservation.mainClient || {};
    const prefill = clientPrefill(client, reservation);
    // Prefer already submitted / snapshotted values when present
    const fields = {
      ...prefill,
      firstName: checkIn.firstName || prefill.firstName,
      lastName: checkIn.lastName || prefill.lastName,
      email: checkIn.email || prefill.email,
      phone: checkIn.phone || prefill.phone,
      documentType: checkIn.documentType || prefill.documentType,
      documentNumber: checkIn.documentNumber || prefill.documentNumber,
      country: checkIn.country || prefill.country || 'AR',
      province: checkIn.province || prefill.province,
      city: checkIn.city || prefill.city,
      address: checkIn.address || prefill.address,
      wantsPromotions: prefill.wantsPromotions,
      vehiclePlate: checkIn.vehiclePlate || prefill.vehiclePlate
    };

    const segment = reservation.segments?.[0];

    return res.json({
      status: checkIn.status,
      completed: checkIn.status === 'COMPLETED',
      reservation: {
        id: reservation.id,
        checkIn: segment?.startDate || null,
        checkOut: segment?.endDate || null
      },
      fields
    });
  } catch (error) {
    console.error('getPublicCheckIn', error);
    return res.status(500).json({ error: 'Error al cargar check-in' });
  }
}

/**
 * Público: enviar respuestas; actualiza cliente (incl. patente) + patente de reserva + snapshot.
 */
async function submitPublicCheckIn(req, res) {
  try {
    const token = normalizeTokenParam(req.params.token);
    if (!isWellFormedToken(token)) {
      return res.status(400).json({
        error: 'Link incompleto o corrupto. Pedí un link nuevo desde la reserva.'
      });
    }

    const checkIn = await prisma.onlineCheckIn.findUnique({
      where: { token },
      include: { reservation: true }
    });

    if (!checkIn) {
      return res.status(404).json({ error: 'Link de check-in inválido' });
    }
    if (checkIn.expiresAt && checkIn.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Este link de check-in expiró' });
    }

    const body = req.body || {};
    const firstName = normalizeText(body.firstName);
    const lastName = normalizeText(body.lastName);
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
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

    const reservationId = checkIn.reservationId;
    const mainClientId = checkIn.reservation.mainClientId;

    const result = await prisma.$transaction(async (tx) => {
      const existingClient = await tx.client.findUnique({
        where: { id: mainClientId },
        select: { notes: true }
      });
      const notes = createNotesWithAddress(existingClient?.notes, address);

      await tx.client.update({
        where: { id: mainClientId },
        data: {
          firstName,
          lastName,
          email,
          phone,
          documentType,
          documentNumber,
          country,
          province,
          city,
          wantsPromotions,
          notes,
          vehiclePlate
        }
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: { vehiclePlate }
      });

      return tx.onlineCheckIn.update({
        where: { id: checkIn.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          firstName,
          lastName,
          email,
          phone,
          documentType,
          documentNumber,
          country,
          province,
          city,
          address,
          vehiclePlate
        }
      });
    });

    return res.json({
      ok: true,
      status: result.status,
      completedAt: result.completedAt,
      vehiclePlate: result.vehiclePlate
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
  submitPublicCheckIn
};
