const { civilFromDb, toDateOnlyUtc } = require('./calendarDates');

/**
 * Intervalos de temporada cerrados [start, end] en día civil YYYY-MM-DD.
 * Overlap real si comparten al menos un día (no half-open).
 */
function rangesOverlapInclusive(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && endA >= startB;
}

function toCivil(value) {
  return civilFromDb(value);
}

/**
 * Busca un bloque activo (no borrador) que se solape con [startDate, endDate].
 * Compara por día civil para evitar falsos positivos por timezone.
 */
async function findOverlappingActiveBlock(prisma, { hotelId, excludeId, startDate, endDate }) {
  const startCivil = toCivil(startDate);
  const endCivil = toCivil(endDate);
  if (!startCivil || !endCivil) return null;

  const candidates = await prisma.seasonBlock.findMany({
    where: {
      hotelId,
      isDraft: false,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isDraft: true
    }
  });

  return (
    candidates.find((other) =>
      rangesOverlapInclusive(startCivil, endCivil, toCivil(other.startDate), toCivil(other.endDate))
    ) || null
  );
}

/** DateTime a medianoche UTC del día civil, para persistir/comparar en Prisma. */
function civilToUtcDate(value) {
  const civil = toCivil(value);
  return civil ? toDateOnlyUtc(civil) : null;
}

module.exports = {
  rangesOverlapInclusive,
  toCivil,
  findOverlappingActiveBlock,
  civilToUtcDate
};
