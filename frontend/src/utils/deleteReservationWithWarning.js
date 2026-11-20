import { deleteReservation } from '../services/api';

/**
 * Borra reserva; si hay pagos/cargos pide confirmación extra (modal in-app).
 * @param {number|string} id
 * @param {(opts: {title?: string, message: string, confirmText?: string}) => Promise<boolean>} confirmFn
 */
export async function deleteReservationWithWarning(id, confirmFn) {
  try {
    await deleteReservation(id);
    return true;
  } catch (err) {
    if (!err?.requiresConfirm) throw err;
    const financial = err.financial || {};
    const ok = await confirmFn({
      title: 'Eliminar cuenta con movimientos',
      message:
        err.message ||
        `La reserva tiene ${financial.cargos || 0} cargo(s) y ${financial.pagos || 0} pago(s). Al eliminar se borrará la cuenta y esos movimientos.`,
      confirmText: 'Eliminar igual'
    });
    if (!ok) return false;
    await deleteReservation(id, { confirmFinancialWipe: true });
    return true;
  }
}
