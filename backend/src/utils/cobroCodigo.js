/**
 * Códigos de cobro (papelitos / Estado de cuentas): A000…Z999 (26.000 códigos) y, agotados esos,
 * AA000…ZZ999 (676.000 más). Los códigos existentes no cambian.
 * Secuencia 0-based: 1 letra → letra*1000 + nro; 2 letras → 26000 + (l1*26 + l2)*1000 + nro.
 */

const CODIGO_RE = /^([A-Z]{1,2})([0-9]{3})$/;
const SINGLE_LETTER_SPAN = 26 * 1000;
const MAX_INDEX = SINGLE_LETTER_SPAN + 26 * 26 * 1000 - 1;

function formatCobroCodigo(sequenceIndex) {
  if (!Number.isInteger(sequenceIndex) || sequenceIndex < 0) {
    throw new Error('Índice de código de cobro inválido');
  }
  if (sequenceIndex > MAX_INDEX) {
    throw new Error('Se agotaron los códigos de cobro (A000–ZZ999)');
  }
  const num = String(sequenceIndex % 1000).padStart(3, '0');
  if (sequenceIndex < SINGLE_LETTER_SPAN) {
    return String.fromCharCode(65 + Math.floor(sequenceIndex / 1000)) + num;
  }
  const pair = Math.floor((sequenceIndex - SINGLE_LETTER_SPAN) / 1000);
  return (
    String.fromCharCode(65 + Math.floor(pair / 26)) + String.fromCharCode(65 + (pair % 26)) + num
  );
}

function parseCobroCodigo(codigo) {
  if (!codigo || typeof codigo !== 'string') return null;
  const match = CODIGO_RE.exec(codigo.trim().toUpperCase());
  if (!match) return null;
  const letters = match[1];
  const num = parseInt(match[2], 10);
  if (letters.length === 1) return (letters.charCodeAt(0) - 65) * 1000 + num;
  const pair = (letters.charCodeAt(0) - 65) * 26 + (letters.charCodeAt(1) - 65);
  return SINGLE_LETTER_SPAN + pair * 1000 + num;
}

/**
 * Obtiene el siguiente código libre a partir del máximo existente (incluye cobros anulados).
 * Orden por largo y luego alfabético: «AA000» va después de «Z999» (en orden de texto no).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
async function allocateNextCobroCodigo(db) {
  const rows = await db.$queryRaw`
    SELECT "codigo" FROM "Cobro"
    WHERE "codigo" ~ '^[A-Z]{1,2}[0-9]{3}$'
    ORDER BY length("codigo") DESC, "codigo" DESC
    LIMIT 1`;
  const last = Array.isArray(rows) && rows[0] ? rows[0].codigo : null;
  const nextIndex = last ? (parseCobroCodigo(last) ?? -1) + 1 : 0;
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
