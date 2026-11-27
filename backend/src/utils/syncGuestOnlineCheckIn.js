/**
 * Check-in manual interno: al guardar un Guest, deja snapshot OnlineCheckIn COMPLETED
 * para esa estadía (misma fuente de verdad que el form público).
 */

const { buildIdentityKey, normalizeText } = require('../services/resolveClientIdentity');

function birthDateOrNull(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prisma
 * @param {object} guest — fila Guest persistida
 * @param {object} [body] — payload del form (campos de ficha / snapshot)
 * @param {object} [resolveMeta] — resultado resolveClientIdentity
 */
async function syncGuestOnlineCheckInCompleted(prisma, guest, body = {}, resolveMeta = null) {
  if (!guest?.id || !guest?.reservationId) return null;

  const identity = buildIdentityKey({
    documentType: body.documentType ?? guest.documentType,
    documentNumber: body.documentNumber ?? guest.documentNumber,
    documentIssuingCountry:
      body.documentIssuingCountry ?? guest.documentIssuingCountry
  });

  const data = {
    status: 'COMPLETED',
    completedAt: new Date(),
    clientId: guest.clientId || resolveMeta?.client?.id || null,
    firstName: normalizeText(guest.firstName),
    lastName: normalizeText(guest.lastName),
    email: normalizeText(body.email ?? guest.email),
    phone: normalizeText(body.phone ?? guest.phone),
    documentType: identity.documentType,
    documentNumber: identity.documentNumber,
    documentIssuingCountry: identity.documentIssuingCountry,
    documentNumberNormalized: identity.documentNumberNormalized,
    birthDate: birthDateOrNull(body.birthDate),
    country: normalizeText(body.country) || 'AR',
    province: normalizeText(body.province),
    city: normalizeText(body.city ?? guest.city),
    address: normalizeText(body.address ?? guest.address),
    dietVegetariano: Boolean(
      body.dietVegetariano !== undefined ? body.dietVegetariano : guest.dietVegetariano
    ),
    dietVegano: Boolean(body.dietVegano !== undefined ? body.dietVegano : guest.dietVegano),
    dietCeliaco: Boolean(body.dietCeliaco !== undefined ? body.dietCeliaco : guest.dietCeliaco),
    needsManualReview: Boolean(resolveMeta?.needsManualReview),
    identityConflictNote: resolveMeta?.identityConflictNote || null
  };

  const existing = await prisma.onlineCheckIn.findFirst({
    where: {
      reservationId: guest.reservationId,
      guestId: guest.id
    }
  });

  if (existing) {
    return prisma.onlineCheckIn.update({
      where: { id: existing.id },
      data: {
        ...data,
        sentAt: existing.sentAt || new Date()
      }
    });
  }

  return prisma.onlineCheckIn.create({
    data: {
      reservationId: guest.reservationId,
      guestId: guest.id,
      sentAt: new Date(),
      ...data
    }
  });
}

module.exports = {
  syncGuestOnlineCheckInCompleted
};
