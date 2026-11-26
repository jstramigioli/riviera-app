/**
 * Beneficio gastronómico «Almuerzo sin cargo».
 *
 * - Se genera al cancelar una cena incluida (REGIMEN) de una reserva.
 * - No es saldo monetario ni equivale a platos: es un cupón para una comanda
 *   de Minutas en la que todo queda sin cargo salvo las bebidas.
 * - Estado: DISPONIBLE → UTILIZADO (con su comanda) o ANULADO (con motivo).
 * - reconcileBeneficios() lo mantiene coherente con la reserva y la cena:
 *   check-out (Finalizada) lo anula y se restaura si se revierte; si la fecha
 *   sale de la estadía o se reactiva la cena, se anula; un UTILIZADO no cambia.
 *   La anulación MANUAL solo se revierte a mano.
 */

/** Grupos de producto que siempre generan cargo aunque se aplique el beneficio. */
const GRUPOS_CON_CARGO = new Set(['BEBIDAS']);

const RESERVA_INACTIVA = new Set(['CANCELADA', 'NO_PRESENTADA']);

class BeneficioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Estado que debería tener un beneficio según su cena y la reserva.
 * Devuelve los cambios a aplicar ({ estado, motivoAnulacion }) o null.
 */
function decidirEstado(beneficio, prestacion, reservationStatus) {
  if (beneficio.estado === 'UTILIZADO') return null;

  let motivo = null;
  if (!prestacion || !prestacion.vigente || RESERVA_INACTIVA.has(reservationStatus)) {
    motivo = 'FUERA_DE_ESTADIA';
  } else if (prestacion.estado !== 'CANCELADA') {
    motivo = 'CENA_REACTIVADA';
  } else if (reservationStatus === 'FINALIZADA') {
    motivo = 'CHECKOUT';
  }

  if (beneficio.estado === 'DISPONIBLE') {
    return motivo ? { estado: 'ANULADO', motivoAnulacion: motivo } : null;
  }
  // ANULADO
  if (beneficio.motivoAnulacion === 'MANUAL') return null;
  if (!motivo) return { estado: 'DISPONIBLE', motivoAnulacion: null };
  if (motivo !== beneficio.motivoAnulacion) return { estado: 'ANULADO', motivoAnulacion: motivo };
  return null;
}

function cambiosAData(cambio) {
  return cambio.estado === 'DISPONIBLE'
    ? { estado: 'DISPONIBLE', motivoAnulacion: null, anuladoAt: null }
    : { estado: 'ANULADO', motivoAnulacion: cambio.motivoAnulacion, anuladoAt: new Date() };
}

/** Aplica decidirEstado a todos los beneficios de la reserva. Devuelve cuántos cambiaron. */
async function reconcileBeneficios(db, reservationId) {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      status: true,
      beneficiosGastronomicos: {
        include: { prestacion: { select: { estado: true, vigente: true } } }
      }
    }
  });
  if (!reservation) return 0;
  let changed = 0;
  for (const b of reservation.beneficiosGastronomicos) {
    const cambio = decidirEstado(b, b.prestacion, reservation.status);
    if (!cambio) continue;
    await db.beneficioGastronomico.update({ where: { id: b.id }, data: cambiosAData(cambio) });
    changed += 1;
  }
  return changed;
}

/** Crea el beneficio de una cena incluida cancelada (si no existe). */
async function ensureBeneficioParaCena(db, prestacion) {
  if (prestacion.origen !== 'REGIMEN' || prestacion.tipo !== 'CENA' || !prestacion.reservationId) {
    return null;
  }
  const existing = await db.beneficioGastronomico.findUnique({
    where: { prestacionId: prestacion.id }
  });
  if (existing) return existing;
  return db.beneficioGastronomico.create({
    data: { reservationId: prestacion.reservationId, prestacionId: prestacion.id }
  });
}

/** ¿La línea queda sin cargo cuando se aplica el beneficio? (todo salvo bebidas) */
function lineaBonificable(line) {
  return !GRUPOS_CON_CARGO.has(line.category);
}

/**
 * Valida que el beneficio se pueda usar en esta comanda y marca las líneas
 * bonificadas. No consume el beneficio (eso se hace en la transacción).
 */
async function prepararBeneficio(db, { beneficioId, ambito, reservationId, lines }) {
  if (ambito !== 'MINUTAS') {
    throw new BeneficioError('El almuerzo sin cargo se aplica solo en comandas de Minutas');
  }
  if (!reservationId) {
    throw new BeneficioError('El almuerzo sin cargo se aplica solo a cuentas de reserva');
  }
  const beneficio = await db.beneficioGastronomico.findUnique({ where: { id: beneficioId } });
  if (!beneficio || beneficio.reservationId !== reservationId) {
    throw new BeneficioError('El beneficio no corresponde a esta reserva');
  }
  if (beneficio.estado !== 'DISPONIBLE') {
    throw new BeneficioError('El almuerzo sin cargo no está disponible', 409);
  }
  const marcadas = lines.map((l) => ({ ...l, bonificado: lineaBonificable(l) }));
  if (!marcadas.some((l) => l.bonificado)) {
    throw new BeneficioError('Agregá al menos un producto que no sea bebida para usar el almuerzo sin cargo');
  }
  return { beneficio, lines: marcadas };
}

/** Marca el beneficio como utilizado en la comanda (falla si otro lo usó antes). */
async function consumirBeneficio(tx, beneficioId, comandaId) {
  const { count } = await tx.beneficioGastronomico.updateMany({
    where: { id: beneficioId, estado: 'DISPONIBLE' },
    data: { estado: 'UTILIZADO', comandaId, utilizadoAt: new Date() }
  });
  if (count === 0) throw new BeneficioError('El almuerzo sin cargo ya no está disponible', 409);
}

/**
 * Al anular la comanda, el beneficio vuelve a estar disponible (y se
 * reconcilia: si la reserva ya hizo check-out, queda anulado).
 */
async function liberarBeneficioDeComanda(tx, comandaId) {
  const beneficio = await tx.beneficioGastronomico.findUnique({ where: { comandaId } });
  if (!beneficio) return null;
  await tx.beneficioGastronomico.update({
    where: { id: beneficio.id },
    data: { estado: 'DISPONIBLE', comandaId: null, utilizadoAt: null }
  });
  await reconcileBeneficios(tx, beneficio.reservationId);
  return beneficio;
}

async function anularBeneficioManual(db, id, { notas } = {}) {
  const b = await db.beneficioGastronomico.findUnique({ where: { id } });
  if (!b) throw new BeneficioError('Beneficio no encontrado', 404);
  if (b.estado === 'UTILIZADO') {
    throw new BeneficioError('El beneficio ya se usó; para revertirlo anulá su comanda');
  }
  if (b.estado === 'ANULADO' && b.motivoAnulacion === 'MANUAL') return b;
  return db.beneficioGastronomico.update({
    where: { id },
    data: {
      estado: 'ANULADO',
      motivoAnulacion: 'MANUAL',
      anuladoAt: new Date(),
      notas: notas != null ? String(notas).trim().slice(0, 300) || null : b.notas
    }
  });
}

/** Deshace una anulación manual; queda disponible si la cena y la reserva lo permiten. */
async function restaurarBeneficioManual(db, id) {
  const b = await db.beneficioGastronomico.findUnique({ where: { id } });
  if (!b) throw new BeneficioError('Beneficio no encontrado', 404);
  if (!(b.estado === 'ANULADO' && b.motivoAnulacion === 'MANUAL')) return b;
  await db.beneficioGastronomico.update({
    where: { id },
    data: { estado: 'DISPONIBLE', motivoAnulacion: null, anuladoAt: null }
  });
  await reconcileBeneficios(db, b.reservationId);
  return db.beneficioGastronomico.findUnique({ where: { id } });
}

module.exports = {
  GRUPOS_CON_CARGO,
  BeneficioError,
  decidirEstado,
  reconcileBeneficios,
  ensureBeneficioParaCena,
  lineaBonificable,
  prepararBeneficio,
  consumirBeneficio,
  liberarBeneficioDeComanda,
  anularBeneficioManual,
  restaurarBeneficioManual
};
