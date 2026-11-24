import { useEffect } from 'react';
import { FiEdit2, FiX } from 'react-icons/fi';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { formatMoneyArs } from '../utils/formatMoney';
import {
  cobroClient,
  cobroClientDisplayName,
  cobroReservations,
  formatDisplayDateTime,
  pagoMoneda,
  paymentCodeLabel,
} from '../utils/cobroDisplay';
import ReservationIdChip from './ReservationIdChip';
import styles from './CobroDetailModal.module.css';

function Field({ label, children }) {
  return (
    <>
      <p className={styles.label}>{label}</p>
      <div className={styles.value}>{children}</div>
    </>
  );
}

/**
 * Modal de detalle de un cobro (caja / Estado de cuentas).
 * Código clickable en la tabla abre este modal; Editar abre CobroForm en modo edición.
 */
export default function CobroDetailModal({
  cobro,
  onClose,
  onEdit,
  onClientClick,
  onReservationClick,
}) {
  const overlayDismiss = useOverlayDismiss(onClose);

  useEffect(() => {
    if (!cobro) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [cobro, onClose]);

  if (!cobro) return null;

  const code = paymentCodeLabel(cobro);
  const client = cobroClient(cobro);
  const clientName = cobroClientDisplayName(cobro);
  const reservas = cobroReservations(cobro);
  const amount = cobro.montoARS != null ? cobro.montoARS : cobro.monto;
  const moneda = pagoMoneda(cobro);
  const imputaciones = Array.isArray(cobro.imputaciones) ? cobro.imputaciones : [];
  const showImputaciones = imputaciones.length > 1;

  return (
    <div
      className={styles.overlay}
      {...overlayDismiss}
      role="presentation"
      data-testid="cobro-detail-modal"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cobro-detail-title"
      >
        <div className={styles.header}>
          <h2 id="cobro-detail-title" className={styles.title}>
            Cobro {code}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.grid}>
            <Field label="Código">{code}</Field>
            <Field label="Fecha">{formatDisplayDateTime(cobro.fecha)}</Field>
            <Field label="Cliente">
              {client?.id && onClientClick ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => onClientClick(client)}
                >
                  {clientName}
                </button>
              ) : (
                clientName
              )}
            </Field>
            <Field label="Reserva">
              {reservas.length > 0 ? (
                <div className={styles.chips}>
                  {reservas.map((r) => (
                    <ReservationIdChip
                      key={r.id}
                      id={r.id}
                      source={r.source}
                      status={r.status}
                      onClick={
                        onReservationClick
                          ? () => onReservationClick(r.id, cobro)
                          : null
                      }
                      title="Ver reserva"
                      data-testid={`cobro-detail-reserva-${r.id}`}
                    />
                  ))}
                </div>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Monto">{formatMoneyArs(amount)}</Field>
            <Field label="Moneda">{moneda}</Field>
            <Field label="Método">{cobro.metodo || '—'}</Field>
            <Field label="Motivo">{cobro.motivo || 'Cobro'}</Field>
            <Field label="Comprobante">
              {cobro.referencia || cobro.empresa || '—'}
            </Field>
            {cobro.notas ? <Field label="Notas">{cobro.notas}</Field> : null}
          </div>

          {showImputaciones ? (
            <div>
              <p className={styles.label}>Imputaciones</p>
              <ul className={styles.imputaciones}>
                {imputaciones.map((imp) => {
                  const reserva =
                    imp.reserva || imp.account?.reservation || null;
                  const reservaId = reserva?.id ?? imp.reservaId;
                  const label =
                    reservaId != null
                      ? `#${reservaId}`
                      : imp.account?.kind === 'EXTERNAL'
                        ? imp.account.label || `Externa #${imp.account.id}`
                        : `Cuenta #${imp.accountId}`;
                  return (
                    <li key={imp.id || `${imp.accountId}-${imp.ordenIndex}`} className={styles.imputacionRow}>
                      <span>{label}</span>
                      <strong>{formatMoneyArs(imp.montoARS)}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cerrar
          </button>
          {onEdit ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => onEdit(cobro)}
              data-testid="cobro-detail-edit"
            >
              <FiEdit2 aria-hidden="true" />
              Editar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
