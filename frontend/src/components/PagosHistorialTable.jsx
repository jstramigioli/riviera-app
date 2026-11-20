import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiEdit2, FiFilter, FiSquare, FiTrash2, FiX } from 'react-icons/fi';
import {
  updatePago,
  uploadPagoAdjuntos,
  deletePagoAdjunto,
  downloadPagoAdjunto,
} from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { MOTIVO_DEVOLUCION } from '../constants/billing';
import styles from '../pages/CobrosPagos.module.css';

export function isDevolucionPago(pago) {
  return String(pago?.motivo || '') === MOTIVO_DEVOLUCION;
}

export const ADJUNTO_FACTURA = 'FACTURA';
export const ADJUNTO_COMPROBANTE = 'COMPROBANTE';

export const EMPTY_PAY_FILTERS = {
  codigo: '',
  fechaFrom: '',
  fechaTo: '',
  reserva: '',
  cliente: '',
  montoMin: '',
  montoMax: '',
  metodo: '',
  motivo: '',
  referencia: '',
};

const PAY_COLUMN_KEYS = {
  codigo: ['codigo'],
  fecha: ['fechaFrom', 'fechaTo'],
  reserva: ['reserva'],
  cliente: ['cliente'],
  monto: ['montoMin', 'montoMax'],
  metodo: ['metodo'],
  motivo: ['motivo'],
  referencia: ['referencia'],
};

const PAY_COLUMNS = [
  { key: 'codigo', label: 'Código' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'reserva', label: 'Reserva' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'monto', label: 'Monto' },
  { key: 'metodo', label: 'Método' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'referencia', label: 'Referencia' },
];

export function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
}

export function adjuntosOf(pago, tipo) {
  return (pago?.adjuntos || []).filter((a) => a.tipo === tipo);
}

export function paymentCodeLabel(pago) {
  return pago?.codigo || (pago?.id != null ? `Nº ${pago.id}` : '—');
}

function foldAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesNormalized(haystack, needle) {
  if (!needle) return true;
  return foldAccents(haystack).includes(foldAccents(String(needle).trim()));
}

export function formatDisplayDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(Number(price) || 0);
}

function startOfDay(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Tabla de historial de pagos (misma estructura que Estado de cuentas → Pagos).
 * Columnas: Código, Fecha, Reserva, Cliente, Monto, Método, Motivo, Referencia, Factura, Retirado.
 */
export default function PagosHistorialTable({
  payments = [],
  onPaymentsChange,
  payFilters: controlledFilters,
  onPayFiltersChange,
  enableColumnFilters = true,
  canDeleteFactura = false,
  clientIdFilter = null,
  emptyMessage = 'No hay pagos con los filtros actuales',
  onClientClick,
  onReservationClick,
  onEditPago,
  onDeletePago,
  testId = 'pagos-historial-table',
}) {
  const { notify, noticeDialog } = useAppNotice();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [internalFilters, setInternalFilters] = useState(EMPTY_PAY_FILTERS);
  const payFilters = controlledFilters ?? internalFilters;
  const setPayFilters = onPayFiltersChange ?? setInternalFilters;
  const showRowActions = Boolean(onEditPago || onDeletePago);

  const [openPayColumn, setOpenPayColumn] = useState(null);
  const [payFilterMenuPos, setPayFilterMenuPos] = useState({ top: 0, left: 0 });
  const payFilterMenuRef = useRef(null);
  const payFilterBtnRefs = useRef({});
  const [uploadingPagoId, setUploadingPagoId] = useState(null);
  const [deletingAdjuntoId, setDeletingAdjuntoId] = useState(null);
  const [togglingRetiradoId, setTogglingRetiradoId] = useState(null);
  const [deletingPagoId, setDeletingPagoId] = useState(null);

  const setPayFilter = (key, value) => {
    setPayFilters((prev) => ({ ...prev, [key]: value }));
  };

  const isPayColumnActive = useCallback(
    (column) =>
      (PAY_COLUMN_KEYS[column] || []).some(
        (key) => String(payFilters[key] || '').trim() !== ''
      ),
    [payFilters]
  );

  const syncPayFilterMenuPos = useCallback((column) => {
    const btn = payFilterBtnRefs.current[column];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPayFilterMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const togglePayColumn = (column) => {
    setOpenPayColumn((prev) => {
      if (prev === column) return null;
      syncPayFilterMenuPos(column);
      return column;
    });
  };

  useEffect(() => {
    if (!openPayColumn) return undefined;
    syncPayFilterMenuPos(openPayColumn);
    const onPointerDown = (e) => {
      const btn = payFilterBtnRefs.current[openPayColumn];
      if (payFilterMenuRef.current?.contains(e.target)) return;
      if (btn?.contains(e.target)) return;
      setOpenPayColumn(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenPayColumn(null);
    };
    const onReposition = () => syncPayFilterMenuPos(openPayColumn);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [openPayColumn, syncPayFilterMenuPos]);

  const paymentMethods = useMemo(() => {
    const methods = new Set();
    for (const pago of payments || []) {
      if (pago?.metodo) methods.add(pago.metodo);
    }
    if (payFilters.metodo) methods.add(payFilters.metodo);
    return Array.from(methods).sort((a, b) => a.localeCompare(b, 'es'));
  }, [payments, payFilters.metodo]);

  const filteredPayments = useMemo(() => {
    const from = startOfDay(payFilters.fechaFrom);
    const to = endOfDay(payFilters.fechaTo);
    const clientId = clientIdFilter != null ? Number(clientIdFilter) : null;
    const codigoNeedle = String(payFilters.codigo || '').trim();
    const reservaNeedle = String(payFilters.reserva || '')
      .trim()
      .replace(/^#/, '');
    const clienteNeedle = String(payFilters.cliente || '').trim();
    const referenciaNeedle = String(payFilters.referencia || '').trim();
    const metodoNeedle = payFilters.metodo;
    const motivoNeedle = payFilters.motivo;
    const montoMin =
      payFilters.montoMin === '' || payFilters.montoMin == null
        ? null
        : Number(payFilters.montoMin);
    const montoMax =
      payFilters.montoMax === '' || payFilters.montoMax == null
        ? null
        : Number(payFilters.montoMax);

    return (payments || [])
      .filter((pago) => {
        if (clientId != null && !Number.isNaN(clientId)) {
          const matchesClient =
            pago.reserva?.mainClient?.id === clientId ||
            Number(pago.reserva?.mainClientId) === clientId;
          if (!matchesClient) return false;
        }

        if (codigoNeedle && !includesNormalized(paymentCodeLabel(pago), codigoNeedle)) {
          return false;
        }

        if (from || to) {
          const refDate = pago.fecha ? new Date(pago.fecha) : null;
          if (!refDate || Number.isNaN(refDate.getTime())) return false;
          if (from && refDate < from) return false;
          if (to && refDate > to) return false;
        }

        if (reservaNeedle) {
          const reservaId = String(pago.reservaId || pago.reserva?.id || '');
          if (!includesNormalized(reservaId, reservaNeedle)) return false;
        }

        if (clienteNeedle) {
          const client = pago.reserva?.mainClient;
          const clientName = client
            ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
            : 'Sin cliente';
          if (!includesNormalized(clientName, clienteNeedle)) return false;
        }

        const amount = Number(pago.montoARS != null ? pago.montoARS : pago.monto) || 0;
        if (montoMin != null && !Number.isNaN(montoMin) && amount < montoMin) {
          return false;
        }
        if (montoMax != null && !Number.isNaN(montoMax) && amount > montoMax) {
          return false;
        }

        if (metodoNeedle && pago.metodo !== metodoNeedle) return false;
        if (motivoNeedle && (pago.motivo || 'Pago') !== motivoNeedle) return false;

        if (referenciaNeedle) {
          const refText = `${pago.referencia || ''} ${pago.empresa || ''}`.trim();
          if (!includesNormalized(refText, referenciaNeedle)) return false;
        }

        return true;
      })
      .slice()
      .sort((a, b) => {
        const da = a.fecha ? new Date(a.fecha).getTime() : 0;
        const db = b.fecha ? new Date(b.fecha).getTime() : 0;
        if (db !== da) return db - da;
        return Number(b.id) - Number(a.id);
      });
  }, [payments, payFilters, clientIdFilter]);

  const patchPago = (pagoId, updater) => {
    if (!onPaymentsChange) return;
    onPaymentsChange((prev) =>
      (prev || []).map((pago) => {
        if (pago.id !== pagoId) return pago;
        return typeof updater === 'function' ? updater(pago) : { ...pago, ...updater };
      })
    );
  };

  const handleToggleRetirado = async (pago) => {
    if (
      !pago?.id ||
      isTransferencia(pago.metodo) ||
      isDevolucionPago(pago) ||
      togglingRetiradoId === pago.id
    ) {
      return;
    }
    const next = !pago.retirado;
    setTogglingRetiradoId(pago.id);
    try {
      const updated = await updatePago(pago.id, { retirado: next });
      patchPago(pago.id, {
        retirado: updated?.retirado ?? next,
        adjuntos: updated?.adjuntos ?? pago.adjuntos,
      });
    } catch (err) {
      notify({
        title: 'No se pudo actualizar',
        message: err?.message || 'Error al marcar retirado',
        type: 'error',
      });
    } finally {
      setTogglingRetiradoId(null);
    }
  };

  const handleUploadAdjuntos = async (pago, tipo, fileList) => {
    if (!pago?.id || !fileList?.length) return;
    const files = Array.from(fileList);
    const acceptPdfOnly = tipo === ADJUNTO_FACTURA;
    const invalid = files.filter((file) => {
      const mime = file.type || '';
      if (acceptPdfOnly) return mime !== 'application/pdf';
      return !['application/pdf', 'image/jpeg', 'image/png'].includes(mime);
    });
    if (invalid.length) {
      notify({
        title: 'Archivo no permitido',
        message: acceptPdfOnly
          ? 'Solo PDF para comprobantes de facturación'
          : 'Solo JPG, PNG o PDF para comprobantes',
        type: 'error',
      });
      return;
    }
    setUploadingPagoId(pago.id);
    try {
      const created = await uploadPagoAdjuntos(pago.id, tipo, files);
      const list = Array.isArray(created) ? created : [created];
      patchPago(pago.id, (row) => ({
        ...row,
        adjuntos: [...(Array.isArray(row.adjuntos) ? row.adjuntos : []), ...list],
      }));
    } catch (err) {
      notify({
        title: 'No se pudo subir',
        message: err?.message || 'Error al subir archivos',
        type: 'error',
      });
    } finally {
      setUploadingPagoId(null);
    }
  };

  const handleDownloadAdjunto = async (pago, adjunto) => {
    try {
      await downloadPagoAdjunto(pago.id, adjunto.id, adjunto.originalName);
    } catch (err) {
      notify({
        title: 'No se pudo descargar',
        message: err?.message || 'Error al descargar',
        type: 'error',
      });
    }
  };

  const handleDeleteAdjunto = async (pago, adjunto) => {
    if (!pago?.id || !adjunto?.id) return;
    if (adjunto.tipo === ADJUNTO_FACTURA && !canDeleteFactura) {
      notify({
        title: 'Sin permiso',
        message: 'Solo administración puede eliminar comprobantes de facturación',
        type: 'error',
      });
      return;
    }
    const ok = await confirm({
      title: 'Eliminar comprobante',
      message: `¿Eliminar «${adjunto.originalName || 'archivo'}»?`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    setDeletingAdjuntoId(adjunto.id);
    try {
      await deletePagoAdjunto(pago.id, adjunto.id);
      patchPago(pago.id, (row) => ({
        ...row,
        adjuntos: (row.adjuntos || []).filter((a) => a.id !== adjunto.id),
      }));
    } catch (err) {
      notify({
        title: 'No se pudo eliminar',
        message: err?.message || 'Error al eliminar',
        type: 'error',
      });
    } finally {
      setDeletingAdjuntoId(null);
    }
  };

  const handleDeletePagoClick = async (pago) => {
    if (!onDeletePago || !pago?.id || deletingPagoId === pago.id) return;
    const ok = await confirm({
      title: 'Eliminar pago',
      message: `¿Eliminar el pago ${paymentCodeLabel(pago)}?`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    setDeletingPagoId(pago.id);
    try {
      await onDeletePago(pago);
    } catch (err) {
      notify({
        title: 'No se pudo eliminar',
        message: err?.message || 'Error al eliminar el pago',
        type: 'error',
      });
    } finally {
      setDeletingPagoId(null);
    }
  };

  const renderAdjuntoFileRow = (pago, file, { canDelete = false } = {}) => {
    const busyDelete = deletingAdjuntoId === file.id;
    return (
      <div key={file.id} className={styles.fileRow}>
        <button
          type="button"
          className={styles.fileLink}
          onClick={() => handleDownloadAdjunto(pago, file)}
          title="Descargar"
        >
          {file.originalName || `Archivo ${file.id}`}
        </button>
        {canDelete ? (
          <button
            type="button"
            className={styles.fileDeleteBtn}
            aria-label="Eliminar comprobante"
            title="Eliminar"
            disabled={busyDelete}
            onClick={() => handleDeleteAdjunto(pago, file)}
          >
            <FiX aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className={styles.tableContainer}>
        <table className={styles.table} data-testid={testId}>
          <thead>
            <tr>
              {PAY_COLUMNS.map(({ key, label }) => {
                if (!enableColumnFilters) {
                  return <th key={key}>{label}</th>;
                }
                const isOpen = openPayColumn === key;
                const isActive = isPayColumnActive(key);
                return (
                  <th key={key} className={styles.columnHeader}>
                    <div className={styles.columnHeaderInner}>
                      <span>{label}</span>
                      <button
                        type="button"
                        ref={(el) => {
                          payFilterBtnRefs.current[key] = el;
                        }}
                        className={`${styles.filterBtn} ${isOpen ? styles.filterBtnOpen : ''} ${isActive ? styles.filterBtnActive : ''}`}
                        aria-label={`Filtrar ${label}`}
                        aria-expanded={isOpen}
                        aria-haspopup="dialog"
                        onClick={() => togglePayColumn(key)}
                      >
                        <FiFilter size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </th>
                );
              })}
              <th>Factura</th>
              <th>Retirado</th>
              {showRowActions ? <th className={styles.actionsHeader}>Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={showRowActions ? 11 : 10} className={styles.emptyCell}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredPayments.map((pago) => {
                const client = pago.reserva?.mainClient;
                const clientName = client
                  ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                  : 'Sin cliente';
                const amount = pago.montoARS != null ? pago.montoARS : pago.monto;
                const facturaFiles = adjuntosOf(pago, ADJUNTO_FACTURA);
                const comprobanteFiles = adjuntosOf(pago, ADJUNTO_COMPROBANTE);
                const transfer = isTransferencia(pago.metodo);
                const devolucion = isDevolucionPago(pago);
                const busyUpload = uploadingPagoId === pago.id;
                const codeLabel = paymentCodeLabel(pago);
                const busyDeletePago = deletingPagoId === pago.id;
                const reservaId = pago.reservaId || pago.reserva?.id || null;

                return (
                  <tr key={pago.id} className={styles.row} data-testid={`pago-row-${pago.id}`}>
                    <td className={styles.idCell}>{codeLabel}</td>
                    <td className={styles.metaCell}>
                      {formatDisplayDateTime(pago.fecha)}
                    </td>
                    <td className={styles.idCell}>
                      {reservaId != null && onReservationClick ? (
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => onReservationClick(reservaId, pago)}
                          title="Ver reserva"
                          data-testid={`pago-reserva-link-${pago.id}`}
                        >
                          #{reservaId}
                        </button>
                      ) : reservaId != null ? (
                        `#${reservaId}`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {client?.id && onClientClick ? (
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => onClientClick(client)}
                          title="Ver cliente"
                        >
                          {clientName || 'Sin cliente'}
                        </button>
                      ) : (
                        <span>{clientName || 'Sin cliente'}</span>
                      )}
                    </td>
                    <td className={styles.amountCell}>{formatPrice(amount)}</td>
                    <td className={styles.metaCell}>{pago.metodo || '—'}</td>
                    <td className={styles.metaCell}>{pago.motivo || 'Pago'}</td>
                    <td className={styles.metaCell}>
                      {pago.referencia || pago.empresa || '—'}
                    </td>
                    <td className={styles.facturaCell}>
                      {!pago.requiereFacturacion ? (
                        <span className={styles.dashMuted}>—</span>
                      ) : facturaFiles.length > 0 ? (
                        <div className={styles.fileList}>
                          {facturaFiles.map((file) =>
                            renderAdjuntoFileRow(pago, file, {
                              canDelete: canDeleteFactura,
                            })
                          )}
                        </div>
                      ) : (
                        <span className={styles.facturaPendiente}>Pendiente</span>
                      )}
                    </td>
                    <td className={styles.retiradoCell}>
                      {devolucion ? (
                        <span
                          className={styles.dashMuted}
                          title="Las devoluciones no se retiran de caja"
                          data-testid={`pago-retirado-na-${pago.id}`}
                        >
                          —
                        </span>
                      ) : transfer ? (
                        comprobanteFiles.length > 0 ? (
                          <div className={styles.fileList}>
                            {comprobanteFiles.map((file) =>
                              renderAdjuntoFileRow(pago, file, { canDelete: true })
                            )}
                            <label className={`${styles.dropzone} ${styles.dropzoneCompact}`}>
                              <input
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                                multiple
                                disabled={busyUpload}
                                onChange={(e) => {
                                  handleUploadAdjuntos(
                                    pago,
                                    ADJUNTO_COMPROBANTE,
                                    e.target.files
                                  );
                                  e.target.value = '';
                                }}
                              />
                              {busyUpload ? 'Subiendo…' : '+ archivo'}
                            </label>
                          </div>
                        ) : (
                          <label
                            className={`${styles.dropzone} ${styles.dropzonePending} ${busyUpload ? styles.dropzoneBusy : ''}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleUploadAdjuntos(
                                pago,
                                ADJUNTO_COMPROBANTE,
                                e.dataTransfer.files
                              );
                            }}
                          >
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                              multiple
                              disabled={busyUpload}
                              onChange={(e) => {
                                handleUploadAdjuntos(
                                  pago,
                                  ADJUNTO_COMPROBANTE,
                                  e.target.files
                                );
                                e.target.value = '';
                              }}
                            />
                            {busyUpload ? 'Subiendo…' : 'Agregar comprobante'}
                          </label>
                        )
                      ) : (
                        <button
                          type="button"
                          className={`${styles.retiradoToggle} ${pago.retirado ? styles.retiradoOn : styles.retiradoOff}`}
                          aria-pressed={Boolean(pago.retirado)}
                          aria-label={pago.retirado ? 'Marcado como retirado' : 'No retirado'}
                          title={
                            pago.retirado
                              ? 'Retirado (clic para desmarcar)'
                              : 'No retirado (clic para marcar)'
                          }
                          disabled={togglingRetiradoId === pago.id}
                          data-testid={`pago-retirado-toggle-${pago.id}`}
                          onClick={() => handleToggleRetirado(pago)}
                        >
                          {pago.retirado ? (
                            <FiCheck aria-hidden="true" />
                          ) : (
                            <FiSquare aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </td>
                    {showRowActions ? (
                      <td className={styles.pagoActionsCell}>
                        <div className={styles.pagoRowActions}>
                          {onEditPago ? (
                            <button
                              type="button"
                              className={styles.pagoIconBtn}
                              onClick={() => onEditPago(pago)}
                              title="Editar"
                              aria-label="Editar pago"
                              data-testid={`pago-edit-${pago.id}`}
                            >
                              <FiEdit2 aria-hidden="true" />
                            </button>
                          ) : null}
                          {onDeletePago ? (
                            <button
                              type="button"
                              className={`${styles.pagoIconBtn} ${styles.pagoIconBtnDanger}`}
                              onClick={() => handleDeletePagoClick(pago)}
                              title="Eliminar"
                              aria-label="Eliminar pago"
                              data-testid={`pago-delete-${pago.id}`}
                              disabled={busyDeletePago}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {enableColumnFilters && openPayColumn ? (
        <div
          ref={payFilterMenuRef}
          className={styles.filterMenu}
          role="dialog"
          aria-label={`Filtro ${openPayColumn}`}
          style={{ top: payFilterMenuPos.top, left: payFilterMenuPos.left }}
        >
          {openPayColumn === 'codigo' && (
            <input
              type="search"
              className={styles.columnFilter}
              aria-label="Filtrar por código"
              placeholder="Buscar…"
              autoFocus
              value={payFilters.codigo}
              onChange={(e) => setPayFilter('codigo', e.target.value)}
            />
          )}
          {openPayColumn === 'fecha' && (
            <div className={styles.columnFilterStack}>
              <label className={styles.columnFilterRow}>
                <span className={styles.columnFilterLabel}>Desde</span>
                <input
                  type="date"
                  className={styles.columnFilter}
                  aria-label="Fecha desde"
                  value={payFilters.fechaFrom}
                  onChange={(e) => setPayFilter('fechaFrom', e.target.value)}
                />
              </label>
              <label className={styles.columnFilterRow}>
                <span className={styles.columnFilterLabel}>Hasta</span>
                <input
                  type="date"
                  className={styles.columnFilter}
                  aria-label="Fecha hasta"
                  value={payFilters.fechaTo}
                  min={payFilters.fechaFrom || undefined}
                  onChange={(e) => setPayFilter('fechaTo', e.target.value)}
                />
              </label>
            </div>
          )}
          {openPayColumn === 'reserva' && (
            <input
              type="search"
              className={styles.columnFilter}
              aria-label="Filtrar por reserva"
              placeholder="# reserva"
              autoFocus
              value={payFilters.reserva}
              onChange={(e) => setPayFilter('reserva', e.target.value)}
            />
          )}
          {openPayColumn === 'cliente' && (
            <input
              type="search"
              className={styles.columnFilter}
              aria-label="Buscar cliente"
              placeholder="Buscar cliente…"
              autoFocus
              value={payFilters.cliente}
              onChange={(e) => setPayFilter('cliente', e.target.value)}
            />
          )}
          {openPayColumn === 'monto' && (
            <div className={styles.columnFilterStack}>
              <input
                type="number"
                className={styles.columnFilter}
                aria-label="Monto mínimo"
                placeholder="Mín"
                autoFocus
                value={payFilters.montoMin}
                onChange={(e) => setPayFilter('montoMin', e.target.value)}
              />
              <input
                type="number"
                className={styles.columnFilter}
                aria-label="Monto máximo"
                placeholder="Máx"
                value={payFilters.montoMax}
                onChange={(e) => setPayFilter('montoMax', e.target.value)}
              />
            </div>
          )}
          {openPayColumn === 'metodo' && (
            <select
              className={styles.columnFilter}
              aria-label="Filtrar por método de pago"
              autoFocus
              value={payFilters.metodo}
              onChange={(e) => setPayFilter('metodo', e.target.value)}
            >
              <option value="">Todos</option>
              {paymentMethods.map((metodo) => (
                <option key={metodo} value={metodo}>
                  {metodo}
                </option>
              ))}
            </select>
          )}
          {openPayColumn === 'motivo' && (
            <select
              className={styles.columnFilter}
              aria-label="Filtrar por motivo"
              autoFocus
              value={payFilters.motivo}
              onChange={(e) => setPayFilter('motivo', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="Pago">Pago</option>
              <option value="Seña">Seña</option>
              <option value="Devolución">Devolución</option>
            </select>
          )}
          {openPayColumn === 'referencia' && (
            <input
              type="search"
              className={styles.columnFilter}
              aria-label="Filtrar por referencia"
              placeholder="Buscar…"
              autoFocus
              value={payFilters.referencia}
              onChange={(e) => setPayFilter('referencia', e.target.value)}
            />
          )}
        </div>
      ) : null}

      {noticeDialog}
      {confirmDialog}
    </>
  );
}
