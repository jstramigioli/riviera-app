/**
 * Códigos de pago: A000…A999, luego B000…B999, etc.
 * Secuencia 0-based → letra (A=0) + 3 dígitos.
 */

const CODIGO_RE = /^([A-Z])(\d{3})$/;

function formatPagoCodigo(sequenceIndex) {
  if (!Number.isInteger(sequenceIndex) || sequenceIndex < 0) {
    throw new Error('Índice de código de pago inválido');
  }
  const letterIndex = Math.floor(sequenceIndex / 1000);
  if (letterIndex > 25) {
    throw new Error('Se agotaron los códigos de pago (A000–Z999)');
  }
  const letter = String.fromCharCode(65 + letterIndex);
  const num = sequenceIndex % 1000;
  return `${letter}${String(num).padStart(3, '0')}`;
}

function parsePagoCodigo(codigo) {
  if (!codigo || typeof codigo !== 'string') return null;
  const match = CODIGO_RE.exec(codigo.trim().toUpperCase());
  if (!match) return null;
  const letterIndex = match[1].charCodeAt(0) - 65;
  const num = parseInt(match[2], 10);
  return letterIndex * 1000 + num;
}

/**
 * Obtiene el siguiente código libre a partir del máximo existente.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
async function allocateNextPagoCodigo(db) {
  const last = await db.pago.findFirst({
    where: { codigo: { not: null } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  const nextIndex = last?.codigo != null
    ? (parsePagoCodigo(last.codigo) ?? -1) + 1
    : 0;

  return formatPagoCodigo(nextIndex);
}

module.exports = {
  formatPagoCodigo,
  parsePagoCodigo,
  allocateNextPagoCodigo,
  CODIGO_RE,
};
