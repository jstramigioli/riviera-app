/**
 * Motor canónico de precios — SeasonBlock + SeasonPrice + BlockServiceSelection.
 * Usado por admin (preview) y por cotización/consulta/reserva.
 * Precios inteligentes (DynamicPricing) NO forman parte de este path.
 * Sin redondeo: el precio final es base + ajuste de servicio.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CURRENCY = 'ARS';

/**
 * Precio final de una noche: base → % servicio (sin redondeo).
 */
function calculateFinalPrice(basePrice, percentageAdjustment = 0) {
  let finalPrice = Number(basePrice) || 0;
  const adjustment = Number(percentageAdjustment) || 0;

  if (adjustment !== 0) {
    finalPrice = Math.round(finalPrice * (1 + adjustment / 100));
  }

  return {
    basePrice: Number(basePrice) || 0,
    percentageAdjustment: adjustment,
    calculatedPrice: finalPrice,
    roundedPrice: finalPrice, // alias histórico (sin redondeo)
    finalPrice,
    wasRounded: false,
    currency: CURRENCY
  };
}

function toDateOnlyString(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dateOnlyUTC(date) {
  const s = toDateOnlyString(date);
  return s ? new Date(`${s}T12:00:00.000Z`) : null;
}

function blockCoversDate(block, date) {
  const day = toDateOnlyString(date);
  const start = toDateOnlyString(block.startDate);
  const end = toDateOnlyString(block.endDate);
  if (!day || !start || !end) return false;
  return day >= start && day <= end;
}

/**
 * Bloques confirmados (no borrador) que intersectan el rango.
 */
async function findActiveSeasonBlocks(hotelId, startDate, endDate) {
  const start = dateOnlyUTC(startDate);
  const end = dateOnlyUTC(endDate);

  return prisma.seasonBlock.findMany({
    where: {
      hotelId,
      isDraft: false,
      startDate: { lte: end },
      endDate: { gte: start }
    },
    include: {
      seasonPrices: true,
      blockServiceSelections: {
        include: { serviceType: true }
      }
    },
    orderBy: { startDate: 'asc' }
  });
}

/**
 * Precio de una noche concreta para roomType + serviceType.
 */
function priceForNight(block, roomTypeId, serviceTypeId) {
  const seasonPrice = block.seasonPrices.find(
    (p) => p.roomTypeId === Number(roomTypeId) && p.serviceTypeId === serviceTypeId
  );
  if (!seasonPrice) return null;

  const selection = block.blockServiceSelections.find(
    (s) => s.serviceTypeId === serviceTypeId && s.isEnabled
  );
  const percentageAdjustment = selection?.percentageAdjustment ?? 0;

  return {
    ...calculateFinalPrice(seasonPrice.basePrice, percentageAdjustment),
    seasonBlockId: block.id,
    seasonBlockName: block.name,
    roomTypeId: Number(roomTypeId),
    serviceTypeId
  };
}

/**
 * Cotización noche a noche (path canónico de Consulta).
 */
async function getCanonicalNightlyRates({
  hotelId,
  roomTypeId,
  serviceTypeId,
  startDate,
  endDate
}) {
  const seasonBlocks = await findActiveSeasonBlocks(hotelId, startDate, endDate);

  const start = dateOnlyUTC(startDate);
  const end = dateOnlyUTC(endDate);
  const rates = [];
  const missingDates = [];

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const coveringBlock = seasonBlocks.find((block) => blockCoversDate(block, d));
    if (!coveringBlock) {
      missingDates.push(toDateOnlyString(d));
      continue;
    }

    const priced = priceForNight(coveringBlock, roomTypeId, serviceTypeId);
    if (!priced) {
      missingDates.push(toDateOnlyString(d));
      continue;
    }

    rates.push({
      date: new Date(d),
      dateString: toDateOnlyString(d),
      baseRate: priced.basePrice,
      dynamicRate: priced.finalPrice, // alias histórico; NO implica dynamic pricing
      serviceRate: priced.finalPrice,
      finalRate: priced.finalPrice,
      percentageAdjustment: priced.percentageAdjustment,
      wasRounded: false,
      seasonBlockId: priced.seasonBlockId,
      seasonBlockName: priced.seasonBlockName,
      hotelId,
      roomTypeId: Number(roomTypeId),
      serviceTypeId,
      currency: CURRENCY
    });
  }

  const totalAmount = rates.reduce((sum, r) => sum + r.finalRate, 0);
  const numberOfNights = rates.length;

  return {
    rates,
    missingDates,
    totalAmount,
    numberOfNights,
    averageRatePerNight: numberOfNights > 0 ? totalAmount / numberOfNights : 0,
    seasonBlocks,
    currency: CURRENCY
  };
}

/**
 * Precio preliminar (disponibilidad): mismo motor, una noche / un bloque.
 */
async function getCanonicalRoomTypePrice({ hotelId, roomTypeId, serviceTypeId, block }) {
  if (!block) return 0;

  if (serviceTypeId) {
    const priced = priceForNight(block, roomTypeId, serviceTypeId);
    return priced ? priced.finalPrice : 0;
  }

  // Sin servicio: mínimo entre precios del roomType en el bloque (preview de disponibilidad)
  const candidates = block.seasonPrices.filter((p) => p.roomTypeId === Number(roomTypeId));
  if (candidates.length === 0) return 0;

  let min = Infinity;
  for (const price of candidates) {
    const selection = block.blockServiceSelections?.find(
      (s) => s.serviceTypeId === price.serviceTypeId && s.isEnabled
    );
    const result = calculateFinalPrice(
      price.basePrice,
      selection?.percentageAdjustment ?? 0
    );
    min = Math.min(min, result.finalPrice);
  }
  return min === Infinity ? 0 : min;
}

module.exports = {
  CURRENCY,
  calculateFinalPrice,
  toDateOnlyString,
  dateOnlyUTC,
  blockCoversDate,
  findActiveSeasonBlocks,
  priceForNight,
  getCanonicalNightlyRates,
  getCanonicalRoomTypePrice
};
