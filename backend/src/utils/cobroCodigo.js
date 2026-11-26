/**
 * Códigos de cobro: A000…A999, luego B000…B999, etc.
 * Secuencia 0-based → letra (A=0) + 3 dígitos.
 */

const CODIGO_RE = /^([A-Z])(\d{3})$/;

function formatCobroCodigo(sequenceIndex) {
  if (!Number.isInteger(sequenceIndex) || sequenceIndex < 0) {
    throw new Error('Índice de código de cobro inválido');
  }
  const letterIndex = Math.floor(sequenceIndex / 1000);
  if (letterIndex > 25) {
    throw new Error('Se agotaron los códigos de cobro (A000–Z999)');
  }
  const letter = String.fromCharCode(65 + letterIndex);
  const num = sequenceIndex % 1000;
  return `${letter}${String(num).padStart(3, '0')}`;
}

function parseCobroCodigo(codigo) {
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
async function allocateNextCobroCodigo(db) {
  // `codigo` es NOT NULL; no filtrar con `{ not: null }` (Prisma 6 lo rechaza).
  const last = await db.cobro.findFirst({
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  const nextIndex = last?.codigo
    ? (parseCobroCodigo(last.codigo) ?? -1) + 1
    : 0;

  return formatCobroCodigo(nextIndex);
}

function isCodigoConflict(error) {
  if (!error || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (!target) return true;
  return (Array.isArray(target) ? target : [String(target)]).some((t) =>
    String(t).includes('codigo')
  );
}

/**
 * `allocateNextCobroCodigo` toma max+1: dos cobros simultáneos pueden calcular el mismo código
 * y el segundo falla por UNIQUE (P2002). Reintenta la transacción completa (que vuelve a leer el
 * máximo) en ese caso; cualquier otro error se propaga igual.
 * @template T
 * @param {() => Promise<T>} runTransaction
 * @param {number} [attempts]
 * @returns {Promise<T>}
 */
async function withCobroCodigoRetry(runTransaction, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await runTransaction();
    } catch (error) {
      if (!isCodigoConflict(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

module.exports = {
  formatCobroCodigo,
  parseCobroCodigo,
  allocateNextCobroCodigo,
  withCobroCodigoRetry,
  isCodigoConflict,
  CODIGO_RE,
};
