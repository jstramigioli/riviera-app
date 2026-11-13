import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiPlus, FiFilter, FiCheck, FiSquare, FiX } from 'react-icons/fi';
import {
  getReservationsWithBalances,
  getAllPagos,
  updatePago,
  uploadPagoAdjuntos,
  deletePagoAdjunto,
  downloadPagoAdjunto,
} from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import PaymentForm from '../components/PaymentForm';
import styles from './CobrosPagos.module.css';

const ADJUNTO_FACTURA = 'FACTURA';
const ADJUNTO_COMPROBANTE = 'COMPROBANTE';

function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
}

function adjuntosOf(pago, tipo) {
  return (pago?.adjuntos || []).filter((a) => a.tipo === tipo);
}

const SECTIONS = {
  cuentas: 'cuentas',
  pagos: 'pagos',
  facturacion: 'facturacion',
};

const FACTURA_B_COLUMNS = [
  { key: 'codigo', label: 'Código' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'firstName', label: 'Nombre' },
  { key: 'lastName', label: 'Apellido' },
  { key: 'documentType', label: 'Tipo doc.' },
  { key: 'documentNumber', label: 'N° documento' },
  { key: 'address', label: 'Domicilio' },
  { key: 'email', label: 'Email' },
  { key: 'cardNumber', label: 'Tarjeta / N°' },
];

const FACTURA_A_COLUMNS = [
  { key: 'codigo', label: 'Código' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'businessName', label: 'Razón social' },
  { key: 'cuit', label: 'CUIT' },
  { key: 'commercialAddress', label: 'Dom. comercial' },
  { key: 'ivaCondition', label: 'Cond. IVA' },
  { key: 'email', label: 'Email' },
  { key: 'cardNumber', label: 'Tarjeta / N°' },
];

function facturaCellValue(pago, key) {
  if (key === 'codigo') return paymentCodeLabel(pago);
  // Solo día (sin hora): fecha de facturación, que puede diferir de la del pago.
  if (key === 'fecha') return formatDisplayDate(pago?.factura?.fecha || pago?.fecha);
  const raw = pago?.factura?.[key];
  if (raw == null || String(raw).trim() === '') return '';
  return String(raw);
}

const STATUS_COLORS = {
  PENDIENTE: '#e03131',
  PAGADO: '#2f9e44',
  A_FAVOR: '#f59f00',
};

const DEFAULT_STATUS_FILTERS = {
  PENDIENTE: true,
  PAGADO: false,
  A_FAVOR: false,
};

const EMPTY_PAY_FILTERS = {
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

/** Reservas actualmente alojadas (check-in hecho, aún en casa). */
const ALOJADAS_STATUS = 'INGRESADA';

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

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(value) {
  const iso = toDateInputValue(value);
  if (!iso) return '—';
  return iso.split('-').reverse().join('/');
}

function formatDisplayDateTime(value) {
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

function paymentCodeLabel(pago) {
  return pago?.codigo || (pago?.id != null ? `Nº ${pago.id}` : '—');
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

const CobrosPagos = () => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canFacturacion = can('facturacion');
  const { notify, noticeDialog } = useAppNotice();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  const sectionParam = searchParams.get('section');

  const initialSection =
    sectionParam === SECTIONS.facturacion && !canFacturacion
      ? SECTIONS.cuentas
      : SECTIONS[sectionParam]
        ? sectionParam
        : SECTIONS.cuentas;

  const [activeSection, setActiveSection] = useState(initialSection);
  const [reservationsWithBalances, setReservationsWithBalances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingPagoId, setUploadingPagoId] = useState(null);
  const [deletingAdjuntoId, setDeletingAdjuntoId] = useState(null);
  /** Pagos con comprobante subido en esta visita a Facturación (se ocultan al salir/recargar). */
  const [facturacionSessionDone, setFacturacionSessionDone] = useState(() => new Set());
  const [togglingRetiradoId, setTogglingRetiradoId] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  const [statusFilters, setStatusFilters] = useState(DEFAULT_STATUS_FILTERS);
  const [scopeFilter, setScopeFilter] = useState('alojadas'); // alojadas | todas
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [payFilters, setPayFilters] = useState(EMPTY_PAY_FILTERS);
  const [openPayColumn, setOpenPayColumn] = useState(null);
  const [payFilterMenuPos, setPayFilterMenuPos] = useState({ top: 0, left: 0 });
  const payFilterMenuRef = useRef(null);
  const payFilterBtnRefs = useRef({});

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
    if (!openPayColumn) return;
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!SECTIONS[sectionParam]) return;
    if (sectionParam === SECTIONS.facturacion && !canFacturacion) {
      if (activeSection !== SECTIONS.cuentas) setActiveSection(SECTIONS.cuentas);
      const next = new URLSearchParams(searchParams);
      next.set('section', SECTIONS.cuentas);
      setSearchParams(next, { replace: true });
      return;
    }
    if (sectionParam !== activeSection) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam, activeSection, canFacturacion, searchParams, setSearchParams]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [balancesData, paymentsData] = await Promise.all([
        getReservationsWithBalances(),
        getAllPagos().catch(() => []),
      ]);
      setReservationsWithBalances(balancesData || []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      const detail = (err?.message || '').replace(
        /^Error fetching reservations with balances:?\s*/,
        ''
      );
      setError(detail ? `Error al cargar los datos (${detail})` : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const selectSection = (section) => {
    if (section === SECTIONS.facturacion && !canFacturacion) return;
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  const facturacionSortMs = (pago) => {
    const raw = pago?.factura?.fecha || pago?.fecha;
    return raw ? new Date(raw).getTime() : 0;
  };

  const isFacturacionRowVisible = useCallback(
    (pago) => {
      const hasComprobante = adjuntosOf(pago, ADJUNTO_FACTURA).length > 0;
      if (!hasComprobante) return true;
      return facturacionSessionDone.has(pago.id);
    },
    [facturacionSessionDone]
  );

  useEffect(() => {
    if (activeSection !== SECTIONS.facturacion) {
      setFacturacionSessionDone(new Set());
    }
  }, [activeSection]);

  const facturacionPagosA = useMemo(
    () =>
      (payments || [])
        .filter((pago) => pago?.requiereFacturacion && pago?.factura?.tipo === 'A')
        .filter(isFacturacionRowVisible)
        .slice()
        .sort((a, b) => {
          const diff = facturacionSortMs(b) - facturacionSortMs(a);
          if (diff !== 0) return diff;
          return Number(b.id) - Number(a.id);
        }),
    [payments, isFacturacionRowVisible]
  );

  const facturacionPagosB = useMemo(
    () =>
      (payments || [])
        .filter((pago) => pago?.requiereFacturacion && pago?.factura?.tipo === 'B')
        .filter(isFacturacionRowVisible)
        .slice()
        .sort((a, b) => {
          const diff = facturacionSortMs(b) - facturacionSortMs(a);
          if (diff !== 0) return diff;
          return Number(b.id) - Number(a.id);
        }),
    [payments, isFacturacionRowVisible]
  );

  const handleCopyCell = async (value) => {
    const text = String(value || '').trim();
    if (!text || text === '—') return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Portapapeles no disponible');
      }
      await navigator.clipboard.writeText(text);
      notify({
        message: 'Copiado al portapapeles',
        type: 'success',
        autoDismiss: true,
      });
    } catch (err) {
      notify({
        title: 'No se pudo copiar',
        message: err?.message || 'Error al copiar',
        type: 'error',
      });
    }
  };

  const renderCopyCell = (value) => {
    const text = String(value || '').trim();
    if (!text || text === '—') {
      return <span className={styles.dashMuted}>—</span>;
    }
    return (
      <button
        type="button"
        className={styles.copyCell}
        onClick={() => handleCopyCell(text)}
        title="Clic para copiar"
      >
        {text}
      </button>
    );
  };

  const renderAdjuntoFileRow = (pago, file, { showCheck = false, canDelete = false } = {}) => {
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
        {showCheck ? (
          <span className={styles.fileDoneMark} aria-label="Subido" title="Subido">
            <FiCheck aria-hidden="true" />
          </span>
        ) : null}
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

  const renderFacturaPdfCell = (pago) => {
    const facturaFiles = adjuntosOf(pago, ADJUNTO_FACTURA);
    const busyUpload = uploadingPagoId === pago.id;
    if (facturaFiles.length > 0) {
      return (
        <div className={styles.fileList}>
          {facturaFiles.map((file) =>
            renderAdjuntoFileRow(pago, file, { showCheck: true, canDelete: true })
          )}
        </div>
      );
    }
    return (
      <label
        className={`${styles.dropzone} ${styles.dropzonePending} ${busyUpload ? styles.dropzoneBusy : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleUploadAdjuntos(pago, ADJUNTO_FACTURA, e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={busyUpload}
          onChange={(e) => {
            handleUploadAdjuntos(pago, ADJUNTO_FACTURA, e.target.files);
            e.target.value = '';
          }}
        />
        {busyUpload ? 'Subiendo…' : 'Subir comprobante'}
      </label>
    );
  };

  const renderFacturacionTable = (tipo, columns, rows) => (
    <div className={styles.billingBlock}>
      <div className={styles.panelHeader}>
        <h3>Factura {tipo}</h3>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th>Comprobante</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className={styles.emptyCell}>
                  No hay pagos pendientes de Factura {tipo}
                </td>
              </tr>
            ) : (
              rows.map((pago) => (
                <tr key={pago.id} className={styles.row}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.key === 'codigo' ? styles.idCell : styles.metaCell}>
                      {renderCopyCell(facturaCellValue(pago, col.key))}
                    </td>
                  ))}
                  <td className={styles.facturaCell}>{renderFacturaPdfCell(pago)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(Number(price) || 0);

  const toggleStatus = (status) => {
    setStatusFilters((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const filteredAccounts = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    const clientId = clientIdParam ? Number(clientIdParam) : null;

    return (reservationsWithBalances || []).filter((reservation) => {
      const payStatus = reservation.estadoPago || 'PENDIENTE';
      if (!statusFilters[payStatus]) return false;

      if (scopeFilter === 'alojadas' && reservation.status !== ALOJADAS_STATUS) {
        return false;
      }

      if (clientId != null && !Number.isNaN(clientId)) {
        const matchesClient =
          reservation.mainClient?.id === clientId ||
          Number(reservation.mainClientId) === clientId;
        if (!matchesClient) return false;
      }

      if (from || to) {
        const paymentDates = (reservation.pagos || [])
          .map((pago) => (pago.fecha ? new Date(pago.fecha) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()));
        const refDate =
          paymentDates.length > 0
            ? new Date(Math.max(...paymentDates.map((d) => d.getTime())))
            : new Date(reservation.updatedAt || reservation.createdAt);

        if (Number.isNaN(refDate.getTime())) return false;
        if (from && refDate < from) return false;
        if (to && refDate > to) return false;
      }

      return true;
    });
  }, [
    reservationsWithBalances,
    statusFilters,
    scopeFilter,
    dateFrom,
    dateTo,
    clientIdParam,
  ]);

  const paymentMethods = useMemo(() => {
    const methods = new Set();
    for (const pago of payments || []) {
      if (pago?.metodo) methods.add(pago.metodo);
    }
    if (payFilters.metodo) methods.add(payFilters.metodo);
    return Array.from(methods).sort((a, b) => a.localeCompare(b, 'es'));
  }, [payments, payFilters.metodo]);

  const hasActivePayFilters = useMemo(
    () =>
      Object.values(payFilters).some((value) => String(value || '').trim() !== '') ||
      Boolean(clientIdParam),
    [payFilters, clientIdParam]
  );

  const filteredPayments = useMemo(() => {
    const from = startOfDay(payFilters.fechaFrom);
    const to = endOfDay(payFilters.fechaTo);
    const clientId = clientIdParam ? Number(clientIdParam) : null;
    const codigoNeedle = payFilters.codigo.trim();
    const reservaNeedle = payFilters.reserva.trim().replace(/^#/, '');
    const clienteNeedle = payFilters.cliente.trim();
    const referenciaNeedle = payFilters.referencia.trim();
    const metodoNeedle = payFilters.metodo;
    const motivoNeedle = payFilters.motivo;
    const montoMin =
      payFilters.montoMin === '' ? null : Number(payFilters.montoMin);
    const montoMax =
      payFilters.montoMax === '' ? null : Number(payFilters.montoMax);

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

        if (metodoNeedle && pago.metodo !== metodoNeedle) {
          return false;
        }

        if (motivoNeedle && (pago.motivo || 'Pago') !== motivoNeedle) {
          return false;
        }

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
  }, [payments, payFilters, clientIdParam]);

  const mergePagoAdjuntos = (pagoId, nuevos) => {
    setPayments((prev) =>
      prev.map((pago) => {
        if (pago.id !== pagoId) return pago;
        const existing = Array.isArray(pago.adjuntos) ? pago.adjuntos : [];
        return { ...pago, adjuntos: [...existing, ...nuevos] };
      })
    );
  };

  const removePagoAdjuntoLocal = (pagoId, adjuntoId) => {
    setPayments((prev) =>
      prev.map((pago) => {
        if (pago.id !== pagoId) return pago;
        const existing = Array.isArray(pago.adjuntos) ? pago.adjuntos : [];
        return { ...pago, adjuntos: existing.filter((a) => a.id !== adjuntoId) };
      })
    );
  };

  const handleToggleRetirado = async (pago) => {
    if (!pago?.id || isTransferencia(pago.metodo) || togglingRetiradoId === pago.id) return;
    const next = !pago.retirado;
    setTogglingRetiradoId(pago.id);
    try {
      const updated = await updatePago(pago.id, { retirado: next });
      setPayments((prev) =>
        prev.map((row) =>
          row.id === pago.id
            ? { ...row, retirado: updated?.retirado ?? next, adjuntos: updated?.adjuntos ?? row.adjuntos }
            : row
        )
      );
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
      mergePagoAdjuntos(pago.id, list);
      if (tipo === ADJUNTO_FACTURA) {
        setFacturacionSessionDone((prev) => {
          const next = new Set(prev);
          next.add(pago.id);
          return next;
        });
      }
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
    if (adjunto.tipo === ADJUNTO_FACTURA && !canFacturacion) {
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
    });
    if (!ok) return;

    setDeletingAdjuntoId(adjunto.id);
    try {
      await deletePagoAdjunto(pago.id, adjunto.id);
      removePagoAdjuntoLocal(pago.id, adjunto.id);
      if (adjunto.tipo === ADJUNTO_FACTURA) {
        const remaining = adjuntosOf(
          {
            ...pago,
            adjuntos: (pago.adjuntos || []).filter((a) => a.id !== adjunto.id),
          },
          ADJUNTO_FACTURA
        );
        if (remaining.length === 0) {
          setFacturacionSessionDone((prev) => {
            const next = new Set(prev);
            next.delete(pago.id);
            return next;
          });
        }
      }
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

  const handleClientClick = (client) => {
    if (!client?.id) return;
    navigate(`/clients/${client.id}`);
  };

  const handleAddPayment = (reservation) => {
    setSelectedReservation(reservation || null);
    setShowPaymentForm(true);
  };

  const handleNewPayment = () => {
    setSelectedReservation(null);
    setShowPaymentForm(true);
  };

  const handleClosePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedReservation(null);
  };

  const handlePaymentSuccess = (nuevoPago) => {
    if (nuevoPago?.id != null) {
      notify({
        title: 'Pago registrado',
        message: `Nº ${nuevoPago.id} — anotalo en el papelito. Reserva #${nuevoPago.reservaId || selectedReservation?.id || '—'}.`,
        type: 'success',
      });
    }
    loadData();
  };

  if (loading) {
    return <div className={styles.loading}>Cargando datos...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <div className={styles.error}>{error}</div>
        <button type="button" onClick={loadData} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Estado de cuentas</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de estado de cuentas">
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.cuentas ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.cuentas)}
          >
            Cuentas pendientes
          </button>
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.pagos ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.pagos)}
          >
            Pagos
          </button>
          {canFacturacion ? (
            <button
              type="button"
              className={`${styles.sectionButton} ${activeSection === SECTIONS.facturacion ? styles.active : ''}`}
              onClick={() => selectSection(SECTIONS.facturacion)}
            >
              Facturación
            </button>
          ) : null}
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div
          className={`${styles.mainContentBody} ${
            activeSection === SECTIONS.facturacion ? styles.mainContentBodyWide : ''
          }`}
        >
          {activeSection === SECTIONS.cuentas && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Cuentas pendientes</h2>
              </div>

              <div className={styles.filters} aria-label="Filtros de cuentas">
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Alcance</span>
                  <label className={styles.check}>
                    <input
                      type="radio"
                      name="scope"
                      checked={scopeFilter === 'alojadas'}
                      onChange={() => setScopeFilter('alojadas')}
                    />
                    Alojadas ahora
                  </label>
                  <label className={styles.check}>
                    <input
                      type="radio"
                      name="scope"
                      checked={scopeFilter === 'todas'}
                      onChange={() => setScopeFilter('todas')}
                    />
                    Todas
                  </label>
                </div>

                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Saldo</span>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={statusFilters.PENDIENTE}
                      onChange={() => toggleStatus('PENDIENTE')}
                    />
                    Pendientes
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={statusFilters.PAGADO}
                      onChange={() => toggleStatus('PAGADO')}
                    />
                    Pagados
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={statusFilters.A_FAVOR}
                      onChange={() => toggleStatus('A_FAVOR')}
                    />
                    A favor
                  </label>
                </div>

                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Fechas</span>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      aria-label="Fecha desde"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      aria-label="Fecha hasta"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      className={styles.clearDates}
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                    >
                      Limpiar fechas
                    </button>
                  )}
                </div>

                {clientIdParam && (
                  <div className={styles.filterGroup}>
                    <span className={styles.meta}>Filtro cliente #{clientIdParam}</span>
                    <button
                      type="button"
                      className={styles.clearDates}
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete('clientId');
                        setSearchParams(next, { replace: true });
                      }}
                    >
                      Quitar filtro de cliente
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.panelHeader}>
                <h3>
                  {filteredAccounts.length} resultado
                  {filteredAccounts.length === 1 ? '' : 's'}
                </h3>
              </div>

              {filteredAccounts.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No hay cuentas con los filtros actuales</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Reserva</th>
                        <th>Estado</th>
                        <th>Códigos</th>
                        <th>Cliente</th>
                        <th>Cargos</th>
                        <th>Pagado</th>
                        <th>Saldo</th>
                        <th>Saldo estado</th>
                        <th>Último mov.</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((reservation) => {
                        const client = reservation.mainClient;
                        const clientName = client
                          ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                          : 'Sin cliente';
                        const statusColor =
                          STATUS_COLORS[reservation.estadoPago] || '#6b7280';
                        const paymentList = (reservation.pagos || [])
                          .slice()
                          .sort((a, b) => Number(a.id) - Number(b.id));
                        const lastPaymentDate =
                          paymentList.length > 0
                            ? paymentList.reduce((latest, pago) => {
                                const d = pago.fecha ? new Date(pago.fecha) : null;
                                if (!d || Number.isNaN(d.getTime())) return latest;
                                if (!latest || d > latest) return d;
                                return latest;
                              }, null)
                            : null;
                        const lastMove =
                          lastPaymentDate ||
                          (reservation.updatedAt
                            ? new Date(reservation.updatedAt)
                            : reservation.createdAt
                              ? new Date(reservation.createdAt)
                              : null);

                        return (
                          <tr key={reservation.id} className={styles.row}>
                            <td className={styles.idCell}>#{reservation.id}</td>
                            <td className={styles.metaCell}>{reservation.status || '—'}</td>
                            <td>
                              {paymentList.length > 0 ? (
                                <div
                                  className={styles.paymentIdList}
                                  title="Códigos de pago para papelitos"
                                >
                                  {paymentList.map((pago) => (
                                    <span key={pago.id} className={styles.paymentId}>
                                      {paymentCodeLabel(pago)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className={styles.meta}>Sin pagos</span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => handleClientClick(client)}
                                title="Ver cliente"
                              >
                                {clientName || 'Sin cliente'}
                              </button>
                              {client?.email && (
                                <div className={styles.meta}>{client.email}</div>
                              )}
                            </td>
                            <td>{formatPrice(reservation.totalCargos)}</td>
                            <td>{formatPrice(reservation.totalPagos)}</td>
                            <td className={styles.amountCell} style={{ color: statusColor }}>
                              {formatPrice(reservation.saldo)}
                            </td>
                            <td>
                              <span
                                className={styles.statusBadge}
                                style={{ backgroundColor: statusColor }}
                              >
                                {reservation.estadoPago}
                              </span>
                            </td>
                            <td className={styles.metaCell}>
                              {lastMove && !Number.isNaN(lastMove.getTime())
                                ? formatDisplayDate(lastMove)
                                : '—'}
                            </td>
                            <td>
                              <div className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.paymentButton}
                                  onClick={() => handleAddPayment(reservation)}
                                  title="Agregar pago"
                                >
                                  <FiPlus aria-hidden="true" />
                                  Agregar pago
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === SECTIONS.pagos && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Pagos</h2>
                <div className={styles.sectionActions}>
                  {hasActivePayFilters && (
                    <button
                      type="button"
                      className={styles.clearDates}
                      onClick={() => {
                        setPayFilters(EMPTY_PAY_FILTERS);
                        setOpenPayColumn(null);
                        if (clientIdParam) {
                          const next = new URLSearchParams(searchParams);
                          next.delete('clientId');
                          setSearchParams(next, { replace: true });
                        }
                      }}
                    >
                      Limpiar filtros
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.createButton}
                    onClick={handleNewPayment}
                    title="Crear nuevo pago"
                  >
                    <FiPlus aria-hidden="true" />
                    Pago
                  </button>
                </div>
              </div>

              {clientIdParam && (
                <div className={styles.filters} aria-label="Filtro de cliente por URL">
                  <div className={styles.filterGroup}>
                    <span className={styles.meta}>Filtro cliente #{clientIdParam}</span>
                    <button
                      type="button"
                      className={styles.clearDates}
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete('clientId');
                        setSearchParams(next, { replace: true });
                      }}
                    >
                      Quitar filtro de cliente
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {[
                        { key: 'codigo', label: 'Código' },
                        { key: 'fecha', label: 'Fecha' },
                        { key: 'reserva', label: 'Reserva' },
                        { key: 'cliente', label: 'Cliente' },
                        { key: 'monto', label: 'Monto' },
                        { key: 'metodo', label: 'Método' },
                        { key: 'motivo', label: 'Motivo' },
                        { key: 'referencia', label: 'Referencia' },
                      ].map(({ key, label }) => {
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className={styles.emptyCell}>
                          No hay pagos con los filtros actuales
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((pago) => {
                        const client = pago.reserva?.mainClient;
                        const clientName = client
                          ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                          : 'Sin cliente';
                        const amount =
                          pago.montoARS != null ? pago.montoARS : pago.monto;
                        const facturaFiles = adjuntosOf(pago, ADJUNTO_FACTURA);
                        const comprobanteFiles = adjuntosOf(pago, ADJUNTO_COMPROBANTE);
                        const transfer = isTransferencia(pago.metodo);
                        const busyUpload = uploadingPagoId === pago.id;

                        return (
                          <tr key={pago.id} className={styles.row}>
                            <td className={styles.idCell}>{paymentCodeLabel(pago)}</td>
                            <td className={styles.metaCell}>
                              {formatDisplayDateTime(pago.fecha)}
                            </td>
                            <td className={styles.idCell}>
                              #{pago.reservaId || pago.reserva?.id || '—'}
                            </td>
                            <td>
                              {client?.id ? (
                                <button
                                  type="button"
                                  className={styles.linkButton}
                                  onClick={() => handleClientClick(client)}
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
                                      showCheck: false,
                                      canDelete: canFacturacion,
                                    })
                                  )}
                                </div>
                              ) : (
                                <span className={styles.facturaPendiente}>Pendiente</span>
                              )}
                            </td>
                            <td className={styles.retiradoCell}>
                              {transfer ? (
                                comprobanteFiles.length > 0 ? (
                                  <div className={styles.fileList}>
                                    {comprobanteFiles.map((file) =>
                                      renderAdjuntoFileRow(pago, file, {
                                        showCheck: false,
                                        canDelete: true,
                                      })
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
                                  title={pago.retirado ? 'Retirado (clic para desmarcar)' : 'No retirado (clic para marcar)'}
                                  disabled={togglingRetiradoId === pago.id}
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeSection === SECTIONS.facturacion && canFacturacion && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Facturación</h2>
              </div>
              {renderFacturacionTable('A', FACTURA_A_COLUMNS, facturacionPagosA)}
              {renderFacturacionTable('B', FACTURA_B_COLUMNS, facturacionPagosB)}
            </section>
          )}
        </div>
      </div>

      {showPaymentForm && (
        <PaymentForm
          reservaId={selectedReservation?.id ?? null}
          onClose={handleClosePaymentForm}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {openPayColumn && (
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
      )}
      {noticeDialog}
      {confirmDialog}
    </div>
  );
};

export default CobrosPagos;
