import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiEdit2, FiFilter, FiSquare, FiTrash2, FiX } from 'react-icons/fi';
import {
  updateCobro,
  uploadCobroAdjuntos,
  deleteCobroAdjunto,
  downloadCobroAdjunto,
} from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { MOTIVO_DEVOLUCION } from '../constants/billing';
import { formatMoneyArs } from '../utils/formatMoney';
import styles from '../pages/Cobros.module.css';

export function isDevolucionCobro(cobro) {
  return String(cobro?.motivo || '') === MOTIVO_DEVOLUCION;
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
  moneda: '',
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
  moneda: ['moneda'],
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
  { key: 'moneda', label: 'Moneda' },
  { key: 'metodo', label: 'Método' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'referencia', label: 'Referencia' },
];

export function pagoMoneda(cobro) {
  return String(cobro?.moneda || 'ARS').toUpperCase();
}

export function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
}

export function adjuntosOf(cobro, tipo) {
  return (cobro?.adjuntos || []).filter((a) => a.tipo === tipo);
}

export function paymentCodeLabel(cobro) {
  return cobro?.codigo || (cobro?.id != null ? `Nº ${cobro.id}` : '—');
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
 * Tabla de historial de cobros (misma estructura que Estado de cuentas → Cobros).
 * Columnas: Código, Fecha, Reserva, Cliente, Monto, Moneda, Método, Motivo, Referencia, Factura, Retirado.
 */
export default function CobrosHistorialTable({
  payments = [],
  onPaymentsChange,
  payFilters: controlledFilters,
  onPayFiltersChange,
  enableColumnFilters = true,
  canDeleteFactura = false,
  clientIdFilter = null,
  emptyMessage = 'No hay cobros con los filtros actuales',
  onClientClick,
  onReservationClick,
  onEditCobro,
  onDeleteCobro,
  testId = 'cobros-historial-table',
}) {
  const { notify, noticeDialog } = useAppNotice();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [internalFilters, setInternalFilters] = useState(EMPTY_PAY_FILTERS);
  const payFilters = controlledFilters ?? internalFilters;
  const setPayFilters = onPayFiltersChange ?? setInternalFilters;
  const showRowActions = Boolean(onEditCobro || onDeleteCobro);

  const [openPayColumn, setOpenPayColumn] = useState(null);
  const [payFilterMenuPos, setPayFilterMenuPos] = useState({ top: 0, left: 0 });
  const payFilterMenuRef = useRef(null);
  const payFilterBtnRefs = useRef({});
  const [uploadingCobroId, setUploadingCobroId] = useState(null);
  const [deletingAdjuntoId, setDeletingAdjuntoId] = useState(null);
  const [togglingRetiradoId, setTogglingRetiradoId] = useState(null);
  const [deletingCobroId, setDeletingCobroId] = useState(null);

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
    for (const cobro of payments || []) {
      if (cobro?.metodo) methods.add(cobro.metodo);
    }
    if (payFilters.metodo) methods.add(payFilters.metodo);
    return Array.from(methods).sort((a, b) => a.localeCompare(b, 'es'));
  }, [payments, payFilters.metodo]);

  const paymentCurrencies = useMemo(() => {
    const currencies = new Set();
    for (const cobro of payments || []) {
      currencies.add(pagoMoneda(cobro));
    }
    if (payFilters.moneda) currencies.add(String(payFilters.moneda).toUpperCase());
    return Array.from(currencies).sort((a, b) => a.localeCompare(b, 'es'));
  }, [payments, payFilters.moneda]);

  const filteredCobros = useMemo(() => {
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
    const monedaNeedle = String(payFilters.moneda || '').trim().toUpperCase();
    const montoMin =
      payFilters.montoMin === '' || payFilters.montoMin == null
        ? null
        : Number(payFilters.montoMin);
    const montoMax =
      payFilters.montoMax === '' || payFilters.montoMax == null
        ? null
        : Number(payFilters.montoMax);

    return (payments || [])
      .filter((cobro) => {
        if (clientId != null && !Number.isNaN(clientId)) {
          const matchesClient =
            cobro.reserva?.mainClient?.id === clientId ||
            Number(cobro.reserva?.mainClientId) === clientId;
          if (!matchesClient) return false;
        }

        if (codigoNeedle && !includesNormalized(paymentCodeLabel(cobro), codigoNeedle)) {
          return false;
        }

        if (from || to) {
          const refDate = cobro.fecha ? new Date(cobro.fecha) : null;
          if (!refDate || Number.isNaN(refDate.getTime())) return false;
          if (from && refDate < from) return false;
          if (to && refDate > to) return false;
        }

        if (reservaNeedle) {
          const reservaId = String(cobro.reservaId || cobro.reserva?.id || '');
          if (!includesNormalized(reservaId, reservaNeedle)) return false;
        }

        if (clienteNeedle) {
          const client = cobro.reserva?.mainClient;
          const clientName = client
            ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
            : 'Sin cliente';
          if (!includesNormalized(clientName, clienteNeedle)) return false;
        }

        const amount = Number(cobro.montoARS != null ? cobro.montoARS : cobro.monto) || 0;
        if (montoMin != null && !Number.isNaN(montoMin) && amount < montoMin) {
          return false;
        }
        if (montoMax != null && !Number.isNaN(montoMax) && amount > montoMax) {
          return false;
        }

        if (monedaNeedle && pagoMoneda(cobro) !== monedaNeedle) return false;
        if (metodoNeedle && cobro.metodo !== metodoNeedle) return false;
        if (motivoNeedle && (cobro.motivo || 'Cobro') !== motivoNeedle) return false;

        if (referenciaNeedle) {
          const refText = `${cobro.referencia || ''} ${cobro.empresa || ''}`.trim();
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

  const patchCobro = (cobroId, updater) => {
    if (!onPaymentsChange) return;
    onPaymentsChange((prev) =>
      (prev || []).map((cobro) => {
        if (cobro.id !== cobroId) return cobro;
        return typeof updater === 'function' ? updater(cobro) : { ...cobro, ...updater };
      })
    );
  };

  const handleToggleRetirado = async (cobro) => {
    if (
      !cobro?.id ||
      isTransferencia(cobro.metodo) ||
      isDevolucionCobro(cobro) ||
      togglingRetiradoId === cobro.id
    ) {
      return;
    }
    const next = !cobro.retirado;
    setTogglingRetiradoId(cobro.id);
    try {
      const updated = await updateCobro(cobro.id, { retirado: next });
      patchCobro(cobro.id, {
        retirado: updated?.retirado ?? next,
        adjuntos: updated?.adjuntos ?? cobro.adjuntos,
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

  const handleUploadAdjuntos = async (cobro, tipo, fileList) => {
    if (!cobro?.id || !fileList?.length) return;
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
    setUploadingCobroId(cobro.id);
    try {
      const created = await uploadCobroAdjuntos(cobro.id, tipo, files);
      const list = Array.isArray(created) ? created : [created];
      patchCobro(cobro.id, (row) => ({
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
      setUploadingCobroId(null);
    }
  };

  const handleDownloadAdjunto = async (cobro, adjunto) => {
    try {
      await downloadCobroAdjunto(cobro.id, adjunto.id, adjunto.originalName);
    } catch (err) {
      notify({
        title: 'No se pudo descargar',
        message: err?.message || 'Error al descargar',
        type: 'error',
      });
    }
  };

  const handleDeleteAdjunto = async (cobro, adjunto) => {
    if (!cobro?.id || !adjunto?.id) return;
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
      await deleteCobroAdjunto(cobro.id, adjunto.id);
      patchCobro(cobro.id, (row) => ({
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

  const handleDeleteCobroClick = async (cobro) => {
    if (!onDeleteCobro || !cobro?.id || deletingCobroId === cobro.id) return;
    const ok = await confirm({
      title: 'Eliminar cobro',
      message: `¿Eliminar el cobro ${paymentCodeLabel(cobro)}?`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    setDeletingCobroId(cobro.id);
    try {
      await onDeleteCobro(cobro);
    } catch (err) {
      notify({
        title: 'No se pudo eliminar',
        message: err?.message || 'Error al eliminar el cobro',
        type: 'error',
      });
    } finally {
      setDeletingCobroId(null);
    }
  };

  const renderAdjuntoFileRow = (cobro, file, { canDelete = false } = {}) => {
    const busyDelete = deletingAdjuntoId === file.id;
    return (
      <div key={file.id} className={styles.fileRow}>
        <button
          type="button"
          className={styles.fileLink}
          onClick={() => handleDownloadAdjunto(cobro, file)}
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
            onClick={() => handleDeleteAdjunto(cobro, file)}
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
            {filteredCobros.length === 0 ? (
              <tr>
                <td colSpan={showRowActions ? 12 : 11} className={styles.emptyCell}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredCobros.map((cobro) => {
                const client = cobro.reserva?.mainClient;
                const clientName = client
                  ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                  : 'Sin cliente';
                const amount = cobro.montoARS != null ? cobro.montoARS : cobro.monto;
                const moneda = pagoMoneda(cobro);
                const facturaFiles = adjuntosOf(cobro, ADJUNTO_FACTURA);
                const comprobanteFiles = adjuntosOf(cobro, ADJUNTO_COMPROBANTE);
                const transfer = isTransferencia(cobro.metodo);
                const devolucion = isDevolucionCobro(cobro);
                const busyUpload = uploadingCobroId === cobro.id;
                const codeLabel = paymentCodeLabel(cobro);
                const busyDeleteCobro = deletingCobroId === cobro.id;
                const reservaId = cobro.reservaId || cobro.reserva?.id || null;

                return (
                  <tr key={cobro.id} className={styles.row} data-testid={`cobro-row-${cobro.id}`}>
                    <td className={styles.idCell}>{codeLabel}</td>
                    <td className={styles.metaCell}>
                      {formatDisplayDateTime(cobro.fecha)}
                    </td>
                    <td className={styles.idCell}>
                      {reservaId != null && onReservationClick ? (
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => onReservationClick(reservaId, cobro)}
                          title="Ver reserva"
                          data-testid={`cobro-reserva-link-${cobro.id}`}
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
                    <td className={styles.amountCell}>{formatMoneyArs(amount)}</td>
                    <td className={styles.metaCell} data-testid={`cobro-moneda-${cobro.id}`}>
                      {moneda}
                    </td>
                    <td className={styles.metaCell}>{cobro.metodo || '—'}</td>
                    <td className={styles.metaCell}>{cobro.motivo || 'Cobro'}</td>
                    <td className={styles.metaCell}>
                      {cobro.referencia || cobro.empresa || '—'}
                    </td>
                    <td className={styles.facturaCell}>
                      {!cobro.requiereFacturacion ? (
                        <span className={styles.dashMuted}>—</span>
                      ) : facturaFiles.length > 0 ? (
                        <div className={styles.fileList}>
                          {facturaFiles.map((file) =>
                            renderAdjuntoFileRow(cobro, file, {
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
                          data-testid={`cobro-retirado-na-${cobro.id}`}
                        >
                          —
                        </span>
                      ) : transfer ? (
                        comprobanteFiles.length > 0 ? (
                          <div className={styles.fileList}>
                            {comprobanteFiles.map((file) =>
                              renderAdjuntoFileRow(cobro, file, { canDelete: true })
                            )}
                            <label className={`${styles.dropzone} ${styles.dropzoneCompact}`}>
                              <input
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                                multiple
                                disabled={busyUpload}
                                onChange={(e) => {
                                  handleUploadAdjuntos(
                                    cobro,
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
                                cobro,
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
                                  cobro,
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
                          className={`${styles.retiradoToggle} ${cobro.retirado ? styles.retiradoOn : styles.retiradoOff}`}
                          aria-pressed={Boolean(cobro.retirado)}
                          aria-label={cobro.retirado ? 'Marcado como retirado' : 'No retirado'}
                          title={
                            cobro.retirado
                              ? 'Retirado (clic para desmarcar)'
                              : 'No retirado (clic para marcar)'
                          }
                          disabled={togglingRetiradoId === cobro.id}
                          data-testid={`cobro-retirado-toggle-${cobro.id}`}
                          onClick={() => handleToggleRetirado(cobro)}
                        >
                          {cobro.retirado ? (
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
                          {onEditCobro ? (
                            <button
                              type="button"
                              className={styles.pagoIconBtn}
                              onClick={() => onEditCobro(cobro)}
                              title="Editar"
                              aria-label="Editar cobro"
                              data-testid={`cobro-edit-${cobro.id}`}
                            >
                              <FiEdit2 aria-hidden="true" />
                            </button>
                          ) : null}
                          {onDeleteCobro ? (
                            <button
                              type="button"
                              className={`${styles.pagoIconBtn} ${styles.pagoIconBtnDanger}`}
                              onClick={() => handleDeleteCobroClick(cobro)}
                              title="Eliminar"
                              aria-label="Eliminar cobro"
                              data-testid={`cobro-delete-${cobro.id}`}
                              disabled={busyDeleteCobro}
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
          {openPayColumn === 'moneda' && (
            <select
              className={styles.columnFilter}
              aria-label="Filtrar por moneda"
              autoFocus
              value={payFilters.moneda}
              onChange={(e) => setPayFilter('moneda', e.target.value)}
              data-testid="pay-filter-moneda"
            >
              <option value="">Todas</option>
              {paymentCurrencies.map((moneda) => (
                <option key={moneda} value={moneda}>
                  {moneda}
                </option>
              ))}
            </select>
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
              <option value="Cobro">Cobro</option>
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
