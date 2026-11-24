import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheck, FiFilter, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import {
  getAccountsWithBalances,
  getAllCobros,
  deleteCobro,
  uploadCobroAdjuntos,
  deleteCobroAdjunto,
  downloadCobroAdjunto,
  createExternalAccount,
} from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import CobroForm from '../components/CobroForm';
import CobrosHistorialTable, {
  EMPTY_PAY_FILTERS,
  ADJUNTO_FACTURA,
  adjuntosOf,
  paymentCodeLabel,
} from '../components/CobrosHistorialTable';
import ReservationIdChip from '../components/ReservationIdChip';
import TablePager from '../components/TablePager';
import { formatMoneyArs } from '../utils/formatMoney';
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageRange,
  pageSlice,
  totalPagesFor,
} from '../utils/tablePagination';
import { filterFacturacionRows } from '../utils/facturacionTableFilters';
import { countryName } from '../constants/countries';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import styles from './Cobros.module.css';

const SECTIONS = {
  cuentas: 'cuentas',
  cuentasFondo: 'cuentasFondo',
  cobros: 'cobros',
  facturacion: 'facturacion',
};

const isCuentasSection = (section) =>
  section === SECTIONS.cuentas || section === SECTIONS.cuentasFondo;

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

const FACTURA_T_COLUMNS = [
  { key: 'codigo', label: 'Código' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'firstName', label: 'Nombre' },
  { key: 'lastName', label: 'Apellido' },
  { key: 'documentType', label: 'Tipo doc.' },
  { key: 'documentNumber', label: 'N° documento' },
  { key: 'passportCountry', label: 'País pasaporte' },
  { key: 'address', label: 'Domicilio' },
  { key: 'email', label: 'Email' },
  { key: 'cardNumber', label: 'Tarjeta / N°' },
];

const FACTURA_A_COLUMNS = [
  { key: 'codigo', label: 'Código' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'montoSinIva', label: 'Monto sin IVA' },
  { key: 'businessName', label: 'Razón social' },
  { key: 'cuit', label: 'CUIT' },
  { key: 'commercialAddress', label: 'Dom. comercial' },
  { key: 'ivaCondition', label: 'Cond. IVA' },
  { key: 'email', label: 'Email' },
  { key: 'cardNumber', label: 'Tarjeta / N°' },
];

/** Neto: total con IVA / 1.21 (solo Factura A). */
function montoSinIvaFromCobro(cobro) {
  const total = Number(cobro?.montoARS != null ? cobro.montoARS : cobro?.monto) || 0;
  return Math.abs(total) / 1.21;
}

function facturaCellValue(cobro, key) {
  if (key === 'codigo') return paymentCodeLabel(cobro);
  // Solo día (sin hora): fecha de facturación, que puede diferir de la del cobro.
  if (key === 'fecha') return formatDisplayDate(cobro?.factura?.fecha || cobro?.fecha);
  if (key === 'montoSinIva') return formatMoneyArs(montoSinIvaFromCobro(cobro));
  if (key === 'passportCountry') {
    const code = cobro?.factura?.passportCountry;
    if (code == null || String(code).trim() === '') return '';
    return countryName(code) || String(code);
  }
  const raw = cobro?.factura?.[key];
  if (raw == null || String(raw).trim() === '') return '';
  return String(raw);
}

const STATUS_COLORS = {
  PENDIENTE: '#e03131',
  PAGADO: '#2f9e44',
  A_FAVOR: '#f59f00',
};

const EMPTY_ACCOUNT_FILTERS = {
  origen: [],
  cuenta: '',
  estado: [],
  finalizacionFrom: '',
  finalizacionTo: '',
  cliente: '',
  saldoMin: '',
  saldoMax: '',
  saldoEstado: ['PENDIENTE'],
};

const ORIGEN_OPTIONS = [
  { value: 'reserva', label: 'Reserva' },
  { value: 'externa', label: 'Externa' },
];

function sameStringSet(a, b) {
  const left = Array.isArray(a) ? [...a].sort() : [];
  const right = Array.isArray(b) ? [...b].sort() : [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function accountFilterIsSet(key, value) {
  if (Array.isArray(EMPTY_ACCOUNT_FILTERS[key])) {
    return Array.isArray(value) && value.length > 0;
  }
  return String(value || '').trim() !== '';
}

function accountFilterDiffersFromDefault(key, value) {
  const empty = EMPTY_ACCOUNT_FILTERS[key];
  if (Array.isArray(empty)) {
    return !sameStringSet(value, empty);
  }
  return String(value ?? '') !== String(empty ?? '');
}

const ACCOUNT_COLUMN_KEYS = {
  origen: ['origen'],
  cuenta: ['cuenta'],
  estado: ['estado'],
  finalizacion: ['finalizacionFrom', 'finalizacionTo'],
  cliente: ['cliente'],
  saldo: ['saldoMin', 'saldoMax'],
  saldoEstado: ['saldoEstado'],
};

const ACCOUNT_COLUMNS = [
  { key: 'origen', label: 'Origen' },
  { key: 'cuenta', label: 'Cuenta' },
  { key: 'estado', label: 'Estado' },
  { key: 'finalizacion', label: 'Finalización de la reserva' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'saldo', label: 'Saldo' },
  { key: 'saldoEstado', label: 'Saldo estado' },
];

const FACTURACION_TIPOS = ['A', 'B', 'T'];

const EMPTY_FACTURACION_TABLE_UI = {
  showPrevious: false,
  search: '',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

function facturacionSearchHaystack(cobro, columns) {
  const parts = [paymentCodeLabel(cobro)];
  for (const col of columns) {
    if (col.key === 'codigo' || col.key === 'fecha' || col.key === 'montoSinIva') continue;
    parts.push(facturaCellValue(cobro, col.key));
  }
  return foldAccents(parts.filter(Boolean).join(' '));
}

const SALDO_ESTADO_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'A_FAVOR', label: 'A favor' },
];

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

function isExternalAccount(reservation) {
  const origen = reservation?.origen || reservation?.accountKind || 'RESERVA';
  return origen === 'EXTERNA' || origen === 'EXTERNAL';
}

function accountEstadoValue(reservation) {
  if (isExternalAccount(reservation)) {
    return reservation.accountStatus || reservation.status || '';
  }
  return reservation.status || '';
}

function accountEstadoLabel(value) {
  if (!value) return '—';
  if (value === 'OPEN') return 'Abierta';
  if (value === 'CLOSED') return 'Cerrada';
  return getStatusLabel(value);
}

function accountCuentaLabel(reservation) {
  if (isExternalAccount(reservation)) {
    return (
      reservation.accountLabel ||
      (reservation.accountId != null ? `Externa #${reservation.accountId}` : 'Cuenta externa')
    );
  }
  const id = reservation.reservationId || reservation.id;
  return id != null ? String(id) : '';
}

function accountClientName(reservation) {
  const client = reservation.mainClient;
  if (client) {
    return `${client.firstName || ''} ${client.lastName || ''}`.trim();
  }
  if (isExternalAccount(reservation)) {
    return reservation.accountLabel || 'Cuenta externa';
  }
  return 'Sin cliente';
}

function accountFinalizacionDate(reservation) {
  if (isExternalAccount(reservation)) return null;
  const raw = reservation?.checkOut || reservation?.endDate || null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesAmountRange(value, minRaw, maxRaw) {
  const amount = Number(value) || 0;
  const min = String(minRaw || '').trim() === '' ? null : Number(minRaw);
  const max = String(maxRaw || '').trim() === '' ? null : Number(maxRaw);
  if (min != null && !Number.isNaN(min) && amount < min) return false;
  if (max != null && !Number.isNaN(max) && amount > max) return false;
  return true;
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

const Cobros = () => {
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
  const [uploadingCobroId, setUploadingCobroId] = useState(null);
  const [deletingAdjuntoId, setDeletingAdjuntoId] = useState(null);
  /** Cobros con comprobante subido en esta visita a Facturación (se ocultan al salir/recargar). */
  const [facturacionSessionDone, setFacturacionSessionDone] = useState(() => new Set());
  const [showCobroForm, setShowCobroForm] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [editingCobro, setEditingCobro] = useState(null);

  const [accountFilters, setAccountFilters] = useState(EMPTY_ACCOUNT_FILTERS);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsPageSize, setAccountsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [openAccountColumn, setOpenAccountColumn] = useState(null);
  const [accountFilterMenuPos, setAccountFilterMenuPos] = useState({ top: 0, left: 0 });
  const accountFilterMenuRef = useRef(null);
  const accountFilterBtnRefs = useRef({});
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalLabel, setExternalLabel] = useState('');
  const [creatingExternal, setCreatingExternal] = useState(false);
  const [payFilters, setPayFilters] = useState(EMPTY_PAY_FILTERS);
  const [facturacionUi, setFacturacionUi] = useState(() => ({
    A: { ...EMPTY_FACTURACION_TABLE_UI },
    B: { ...EMPTY_FACTURACION_TABLE_UI },
    T: { ...EMPTY_FACTURACION_TABLE_UI },
  }));

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
        getAccountsWithBalances('ALL'),
        getAllCobros().catch(() => []),
      ]);
      setReservationsWithBalances(balancesData || []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      const detail = (err?.message || '').replace(
        /^Error fetching (?:reservations|accounts) with balances:?\s*/,
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

  const facturacionSortMs = (cobro) => {
    const raw = cobro?.factura?.fecha || cobro?.fecha;
    return raw ? new Date(raw).getTime() : 0;
  };

  useEffect(() => {
    if (activeSection !== SECTIONS.facturacion) {
      setFacturacionSessionDone(new Set());
    }
  }, [activeSection]);

  const patchFacturacionUi = useCallback((tipo, patch) => {
    setFacturacionUi((prev) => {
      const current = prev[tipo] || EMPTY_FACTURACION_TABLE_UI;
      const next = { ...current, ...patch };
      if (
        Object.prototype.hasOwnProperty.call(patch, 'search') ||
        Object.prototype.hasOwnProperty.call(patch, 'showPrevious') ||
        Object.prototype.hasOwnProperty.call(patch, 'pageSize')
      ) {
        next.page = 1;
      }
      return { ...prev, [tipo]: next };
    });
  }, []);

  const facturacionColumnsByTipo = useMemo(
    () => ({
      A: FACTURA_A_COLUMNS,
      B: FACTURA_B_COLUMNS,
      T: FACTURA_T_COLUMNS,
    }),
    []
  );

  const facturacionRowsByTipo = useMemo(() => {
    const result = { A: [], B: [], T: [] };
    for (const tipo of FACTURACION_TIPOS) {
      const ui = facturacionUi[tipo] || EMPTY_FACTURACION_TABLE_UI;
      const columns = facturacionColumnsByTipo[tipo];
      result[tipo] = filterFacturacionRows({
        payments,
        tipo,
        showPrevious: ui.showPrevious,
        search: ui.search,
        sessionDoneIds: facturacionSessionDone,
        adjuntosOf,
        adjuntoTipo: ADJUNTO_FACTURA,
        searchHaystack: (cobro) => facturacionSearchHaystack(cobro, columns),
        sortMs: facturacionSortMs,
      });
    }
    return result;
  }, [payments, facturacionUi, facturacionColumnsByTipo, facturacionSessionDone]);

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

  const renderAdjuntoFileRow = (cobro, file, { showCheck = false, canDelete = false } = {}) => {
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
            onClick={() => handleDeleteAdjunto(cobro, file)}
          >
            <FiX aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  };

  const renderFacturaPdfCell = (cobro) => {
    const facturaFiles = adjuntosOf(cobro, ADJUNTO_FACTURA);
    const busyUpload = uploadingCobroId === cobro.id;
    if (facturaFiles.length > 0) {
      return (
        <div className={styles.fileList}>
          {facturaFiles.map((file) =>
            renderAdjuntoFileRow(cobro, file, { showCheck: true, canDelete: true })
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
          handleUploadAdjuntos(cobro, ADJUNTO_FACTURA, e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={busyUpload}
          onChange={(e) => {
            handleUploadAdjuntos(cobro, ADJUNTO_FACTURA, e.target.files);
            e.target.value = '';
          }}
        />
        {busyUpload ? 'Subiendo…' : 'Subir comprobante'}
      </label>
    );
  };

  const renderFacturacionTable = (tipo) => {
    const columns = facturacionColumnsByTipo[tipo];
    const ui = facturacionUi[tipo] || EMPTY_FACTURACION_TABLE_UI;
    const rows = facturacionRowsByTipo[tipo] || [];
    const pagedRows = pageSlice(rows, ui.page, ui.pageSize);
    const searchActive = String(ui.search || '').trim() !== '';
    const emptyMessage = searchActive
      ? `No hay resultados para la búsqueda en Factura ${tipo}`
      : ui.showPrevious
        ? `No hay cobros de Factura ${tipo}`
        : `No hay cobros pendientes de Factura ${tipo}`;

    return (
      <div className={styles.billingBlock} data-testid={`facturacion-table-${tipo}`}>
        <div className={styles.billingToolbar}>
          <div className={styles.panelHeader}>
            <h3>Factura {tipo}</h3>
          </div>
          <div className={styles.billingControls}>
            <label className={styles.billingSearch}>
              <FiSearch aria-hidden="true" size={14} />
              <span className={styles.srOnly}>Buscar Factura {tipo}</span>
              <input
                type="search"
                value={ui.search}
                placeholder="Buscar nº, razón social, CUIT…"
                aria-label={`Buscar Factura ${tipo}`}
                data-testid={`facturacion-search-${tipo}`}
                onChange={(e) => patchFacturacionUi(tipo, { search: e.target.value })}
              />
            </label>
            <label className={styles.billingToggle}>
              <input
                type="checkbox"
                checked={Boolean(ui.showPrevious)}
                data-testid={`facturacion-show-previous-${tipo}`}
                onChange={(e) =>
                  patchFacturacionUi(tipo, { showPrevious: e.target.checked })
                }
              />
              <span>Mostrar anteriores</span>
            </label>
          </div>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={
                      col.key === 'montoSinIva'
                        ? styles.amountCell
                        : col.key === 'codigo' || col.key === 'documentType'
                          ? styles.shortCell
                          : undefined
                    }
                  >
                    {col.label}
                  </th>
                ))}
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className={styles.emptyCell}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pagedRows.map((cobro) => (
                  <tr key={cobro.id} className={styles.row}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={
                          col.key === 'codigo' || col.key === 'documentType'
                            ? styles.idCell
                            : col.key === 'montoSinIva'
                              ? styles.amountCell
                              : styles.metaCell
                        }
                      >
                        {renderCopyCell(facturaCellValue(cobro, col.key))}
                      </td>
                    ))}
                    <td className={styles.facturaCell}>{renderFacturaPdfCell(cobro)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePager
          total={rows.length}
          page={ui.page}
          pageSize={ui.pageSize}
          onPageChange={(page) => patchFacturacionUi(tipo, { page })}
          onPageSizeChange={(pageSize) => patchFacturacionUi(tipo, { pageSize })}
          label={`Paginación Factura ${tipo}`}
        />
      </div>
    );
  };

  const setAccountFilter = (key, value) => {
    setAccountFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAccountMultiFilter = (key, optionValue) => {
    setAccountFilters((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const next = current.includes(optionValue)
        ? current.filter((value) => value !== optionValue)
        : [...current, optionValue];
      return { ...prev, [key]: next };
    });
  };

  const isAccountColumnActive = useCallback(
    (column) =>
      (ACCOUNT_COLUMN_KEYS[column] || []).some((key) =>
        accountFilterIsSet(key, accountFilters[key])
      ),
    [accountFilters]
  );

  const hasActiveAccountFilters = useMemo(
    () =>
      Object.keys(EMPTY_ACCOUNT_FILTERS).some((key) =>
        accountFilterDiffersFromDefault(key, accountFilters[key])
      ) || Boolean(clientIdParam),
    [accountFilters, clientIdParam]
  );

  const syncAccountFilterMenuPos = useCallback((column) => {
    const btn = accountFilterBtnRefs.current[column];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setAccountFilterMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const toggleAccountColumn = (column) => {
    setOpenAccountColumn((prev) => {
      if (prev === column) return null;
      syncAccountFilterMenuPos(column);
      return column;
    });
  };

  useEffect(() => {
    if (!openAccountColumn) return undefined;
    syncAccountFilterMenuPos(openAccountColumn);
    const onPointerDown = (e) => {
      const btn = accountFilterBtnRefs.current[openAccountColumn];
      if (accountFilterMenuRef.current?.contains(e.target)) return;
      if (btn?.contains(e.target)) return;
      setOpenAccountColumn(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenAccountColumn(null);
    };
    const onReposition = () => syncAccountFilterMenuPos(openAccountColumn);
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
  }, [openAccountColumn, syncAccountFilterMenuPos]);

  const accountEstadoOptions = useMemo(() => {
    const values = new Set();
    (reservationsWithBalances || []).forEach((reservation) => {
      const value = accountEstadoValue(reservation);
      if (value) values.add(value);
    });
    return Array.from(values)
      .sort((a, b) => accountEstadoLabel(a).localeCompare(accountEstadoLabel(b), 'es'))
      .map((value) => ({ value, label: accountEstadoLabel(value) }));
  }, [reservationsWithBalances]);

  const filteredAccounts = useMemo(() => {
    const clientId = clientIdParam ? Number(clientIdParam) : null;
    const origen = Array.isArray(accountFilters.origen) ? accountFilters.origen : [];
    const estado = Array.isArray(accountFilters.estado) ? accountFilters.estado : [];
    const saldoEstado = Array.isArray(accountFilters.saldoEstado)
      ? accountFilters.saldoEstado
      : [];
    const finalizacionFrom = startOfDay(accountFilters.finalizacionFrom);
    const finalizacionTo = endOfDay(accountFilters.finalizacionTo);

    return (reservationsWithBalances || []).filter((reservation) => {
      const isExterna = isExternalAccount(reservation);

      if (origen.length > 0) {
        const kind = isExterna ? 'externa' : 'reserva';
        if (!origen.includes(kind)) return false;
      }

      if (estado.length > 0) {
        if (!estado.includes(accountEstadoValue(reservation))) return false;
      }

      if (saldoEstado.length > 0) {
        const payStatus = reservation.estadoCobro || 'PENDIENTE';
        if (!saldoEstado.includes(payStatus)) return false;
      }

      if (!includesNormalized(accountCuentaLabel(reservation), accountFilters.cuenta)) {
        return false;
      }

      if (!includesNormalized(accountClientName(reservation), accountFilters.cliente)) {
        return false;
      }

      if (
        !matchesAmountRange(reservation.saldo, accountFilters.saldoMin, accountFilters.saldoMax)
      ) {
        return false;
      }

      if (finalizacionFrom || finalizacionTo) {
        const refDate = accountFinalizacionDate(reservation);
        if (!refDate) return false;
        if (finalizacionFrom && refDate < finalizacionFrom) return false;
        if (finalizacionTo && refDate > finalizacionTo) return false;
      }

      if (clientId != null && !Number.isNaN(clientId)) {
        const matchesClient =
          reservation.mainClient?.id === clientId ||
          Number(reservation.mainClientId) === clientId;
        if (!matchesClient) return false;
      }

      return true;
    });
  }, [reservationsWithBalances, accountFilters, clientIdParam]);

  useEffect(() => {
    setAccountsPage(1);
  }, [accountFilters, clientIdParam, accountsPageSize]);

  const accountsTotalPages = totalPagesFor(filteredAccounts.length, accountsPageSize);

  useEffect(() => {
    setAccountsPage((prev) => clampPage(prev, accountsTotalPages));
  }, [accountsTotalPages]);

  const pagedAccounts = useMemo(
    () => pageSlice(filteredAccounts, accountsPage, accountsPageSize),
    [filteredAccounts, accountsPage, accountsPageSize]
  );

  const accountsPageRange = useMemo(
    () => pageRange(filteredAccounts.length, accountsPage, accountsPageSize),
    [filteredAccounts.length, accountsPage, accountsPageSize]
  );

  const hasActivePayFilters = useMemo(
    () =>
      Object.values(payFilters).some((value) => String(value || '').trim() !== '') ||
      Boolean(clientIdParam),
    [payFilters, clientIdParam]
  );

  const mergeCobroAdjuntos = (cobroId, nuevos) => {
    setPayments((prev) =>
      prev.map((cobro) => {
        if (cobro.id !== cobroId) return cobro;
        const existing = Array.isArray(cobro.adjuntos) ? cobro.adjuntos : [];
        return { ...cobro, adjuntos: [...existing, ...nuevos] };
      })
    );
  };

  const removeCobroAdjuntoLocal = (cobroId, adjuntoId) => {
    setPayments((prev) =>
      prev.map((cobro) => {
        if (cobro.id !== cobroId) return cobro;
        const existing = Array.isArray(cobro.adjuntos) ? cobro.adjuntos : [];
        return { ...cobro, adjuntos: existing.filter((a) => a.id !== adjuntoId) };
      })
    );
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
      mergeCobroAdjuntos(cobro.id, list);
      if (tipo === ADJUNTO_FACTURA) {
        setFacturacionSessionDone((prev) => {
          const next = new Set(prev);
          next.add(cobro.id);
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
      await deleteCobroAdjunto(cobro.id, adjunto.id);
      removeCobroAdjuntoLocal(cobro.id, adjunto.id);
      if (adjunto.tipo === ADJUNTO_FACTURA) {
        const remaining = adjuntosOf(
          {
            ...cobro,
            adjuntos: (cobro.adjuntos || []).filter((a) => a.id !== adjunto.id),
          },
          ADJUNTO_FACTURA
        );
        if (remaining.length === 0) {
          setFacturacionSessionDone((prev) => {
            const next = new Set(prev);
            next.delete(cobro.id);
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
    setEditingCobro(null);
    setSelectedReservation(reservation || null);
    setShowCobroForm(true);
  };

  const handleNewPayment = () => {
    setEditingCobro(null);
    setSelectedReservation(null);
    setShowCobroForm(true);
  };

  const handleEditCobro = (cobro) => {
    setSelectedReservation(null);
    setEditingCobro(cobro);
    setShowCobroForm(true);
  };

  const handleCloseCobroForm = () => {
    setShowCobroForm(false);
    setSelectedReservation(null);
    setEditingCobro(null);
  };

  const handleDeleteCobro = async (cobro) => {
    if (!cobro?.id) return;
    await deleteCobro(cobro.id);
    setPayments((prev) => (prev || []).filter((row) => row.id !== cobro.id));
    if (editingCobro?.id === cobro.id) handleCloseCobroForm();
    notify({
      title: 'Cobro eliminado',
      message: `Se eliminó ${paymentCodeLabel(cobro)}.`,
      type: 'success',
      autoDismiss: true,
    });
  };

  const handleCreateExternalAccount = async () => {
    const label = String(externalLabel || '').trim();
    if (!label) {
      notify({ title: 'Falta etiqueta', message: 'Indicá un nombre para la cuenta externa.', type: 'error' });
      return;
    }
    try {
      setCreatingExternal(true);
      await createExternalAccount({ label });
      setExternalLabel('');
      setShowExternalForm(false);
      notify({ title: 'Cuenta creada', message: `Cuenta externa “${label}” lista.`, type: 'success' });
      await loadData();
    } catch (err) {
      notify({
        title: 'No se pudo crear',
        message: err?.message || 'Error al crear cuenta externa',
        type: 'error',
      });
    } finally {
      setCreatingExternal(false);
    }
  };

  const handlePaymentSuccess = (nuevoCobro) => {
    if (nuevoCobro?.id != null) {
      const code = paymentCodeLabel(nuevoCobro);
      const reservaRef =
        nuevoCobro.reservaId || selectedReservation?.reservationId || selectedReservation?.id;
      notify({
        title: 'Cobro registrado',
        message: reservaRef != null ? `${code} · Reserva #${reservaRef}.` : `${code}.`,
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

  const cuentasFlat = activeSection === SECTIONS.cuentasFondo;

  return (
    <div className={`${styles.newLayout} ${cuentasFlat ? styles.newLayoutWhite : ''}`}>
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
            className={`${styles.sectionButton} ${activeSection === SECTIONS.cuentasFondo ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.cuentasFondo)}
          >
            Cuentas pendientes (fondo)
          </button>
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.cobros ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.cobros)}
          >
            Cobros
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

      <div className={`${styles.mainContent} ${cuentasFlat ? styles.mainContentWhite : ''}`}>
        <div
          className={`${styles.mainContentBody} ${
            activeSection === SECTIONS.facturacion ? styles.mainContentBodyWide : ''
          }`}
        >
          {isCuentasSection(activeSection) && (
            <section className={`${styles.section} ${cuentasFlat ? styles.sectionFlat : ''}`}>
              <div className={styles.sectionHeader}>
                <h2>{cuentasFlat ? 'Cuentas pendientes (fondo)' : 'Cuentas pendientes'}</h2>
                <div className={styles.sectionActions}>
                  {hasActiveAccountFilters && (
                    <button
                      type="button"
                      className={styles.clearDates}
                      onClick={() => {
                        setAccountFilters(EMPTY_ACCOUNT_FILTERS);
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
                    onClick={() => setShowExternalForm((v) => !v)}
                  >
                    <FiPlus aria-hidden="true" />
                    Cuenta externa
                  </button>
                </div>
              </div>

              {showExternalForm && (
                <div className={styles.filters} aria-label="Alta cuenta externa">
                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>Etiqueta</span>
                    <input
                      type="text"
                      value={externalLabel}
                      onChange={(e) => setExternalLabel(e.target.value)}
                      placeholder="Ej. Bar mesa 3 / Empresa ACME"
                      aria-label="Etiqueta de cuenta externa"
                    />
                    <button
                      type="button"
                      className={styles.createButton}
                      disabled={creatingExternal}
                      onClick={handleCreateExternalAccount}
                    >
                      {creatingExternal ? 'Creando…' : 'Crear'}
                    </button>
                  </div>
                </div>
              )}

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

              <div className={styles.panelHeader}>
                <h3>
                  {filteredAccounts.length === 0
                    ? '0 resultados'
                    : `${accountsPageRange.from}–${accountsPageRange.to} de ${filteredAccounts.length} resultado${filteredAccounts.length === 1 ? '' : 's'}`}
                </h3>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {ACCOUNT_COLUMNS.map(({ key, label }) => {
                        const isOpen = openAccountColumn === key;
                        const isActive = isAccountColumnActive(key);
                        const alignClass =
                          key === 'saldo'
                            ? styles.amountCell
                            : key === 'origen' || key === 'cuenta'
                              ? styles.shortCell
                              : undefined;
                        return (
                          <th
                            key={key}
                            className={[styles.columnHeader, alignClass]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <div className={styles.columnHeaderInner}>
                              <span>{label}</span>
                              <button
                                type="button"
                                ref={(el) => {
                                  accountFilterBtnRefs.current[key] = el;
                                }}
                                className={`${styles.filterBtn} ${isOpen ? styles.filterBtnOpen : ''} ${isActive ? styles.filterBtnActive : ''}`}
                                aria-label={`Filtrar ${label}`}
                                aria-expanded={isOpen}
                                aria-haspopup="dialog"
                                onClick={() => toggleAccountColumn(key)}
                              >
                                <FiFilter size={13} aria-hidden="true" />
                              </button>
                            </div>
                          </th>
                        );
                      })}
                      <th className={styles.actionsHeader}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className={styles.emptyCell}>
                          No hay cuentas con los filtros actuales
                        </td>
                      </tr>
                    ) : (
                      pagedAccounts.map((reservation) => {
                        const client = reservation.mainClient;
                        const isExterna = isExternalAccount(reservation);
                        const clientName = accountClientName(reservation);
                        const statusColor =
                          STATUS_COLORS[reservation.estadoCobro] || '#6b7280';
                        const rowKey = reservation.accountId || `r-${reservation.id}`;
                        const reservaNum =
                          reservation.reservationId || reservation.id;
                        const estadoValue = accountEstadoValue(reservation);
                        const finalizacion = accountFinalizacionDate(reservation);

                        return (
                          <tr key={rowKey} className={styles.row}>
                            <td className={`${styles.metaCell} ${styles.shortCell}`}>
                              {isExterna ? 'Externa' : 'Reserva'}
                            </td>
                            <td className={styles.idCell}>
                              {isExterna ? (
                                reservation.accountLabel ||
                                `Externa #${reservation.accountId}`
                              ) : (
                                <ReservationIdChip
                                  id={reservaNum}
                                  source={reservation.source}
                                  status={reservation.status}
                                />
                              )}
                            </td>
                            <td className={styles.metaCell}>
                              {accountEstadoLabel(estadoValue)}
                            </td>
                            <td className={styles.metaCell}>
                              {finalizacion ? formatDisplayDate(finalizacion) : '—'}
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
                            <td className={styles.amountCell} style={{ color: statusColor }}>
                              {formatMoneyArs(reservation.saldo)}
                            </td>
                            <td>
                              <span
                                className={styles.statusBadge}
                                style={{ backgroundColor: statusColor }}
                              >
                                {reservation.estadoCobro}
                              </span>
                            </td>
                            <td>
                              <div className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.paymentButton}
                                  onClick={() => handleAddPayment(reservation)}
                                  title="Agregar cobro"
                                >
                                  <FiPlus aria-hidden="true" />
                                  Agregar cobro
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <TablePager
                total={filteredAccounts.length}
                page={accountsPage}
                pageSize={accountsPageSize}
                onPageChange={setAccountsPage}
                onPageSizeChange={setAccountsPageSize}
                label="Paginación de cuentas"
              />

              {openAccountColumn ? (
                <div
                  ref={accountFilterMenuRef}
                  className={styles.filterMenu}
                  role="dialog"
                  aria-label={`Filtro ${openAccountColumn}`}
                  style={{
                    top: accountFilterMenuPos.top,
                    left: accountFilterMenuPos.left,
                  }}
                >
                  {openAccountColumn === 'origen' && (
                    <div
                      className={styles.columnFilterStack}
                      role="group"
                      aria-label="Filtrar por origen"
                    >
                      {ORIGEN_OPTIONS.map((opt) => {
                        const checked = accountFilters.origen.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={styles.filterOption}
                            role="menuitemcheckbox"
                            aria-checked={checked}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAccountMultiFilter('origen', opt.value)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {openAccountColumn === 'cuenta' && (
                    <input
                      type="search"
                      className={styles.columnFilter}
                      aria-label="Filtrar por cuenta"
                      placeholder="Buscar…"
                      autoFocus
                      value={accountFilters.cuenta}
                      onChange={(e) => setAccountFilter('cuenta', e.target.value)}
                    />
                  )}
                  {openAccountColumn === 'estado' && (
                    <div
                      className={styles.columnFilterStack}
                      role="group"
                      aria-label="Filtrar por estado"
                    >
                      {accountEstadoOptions.length === 0 ? (
                        <div className={styles.filterOptionEmpty}>Sin estados</div>
                      ) : (
                        accountEstadoOptions.map((opt) => {
                          const checked = accountFilters.estado.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              className={styles.filterOption}
                              role="menuitemcheckbox"
                              aria-checked={checked}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAccountMultiFilter('estado', opt.value)}
                              />
                              <span>{opt.label}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                  {openAccountColumn === 'finalizacion' && (
                    <div className={styles.columnFilterStack}>
                      <label className={styles.columnFilterRow}>
                        <span className={styles.columnFilterLabel}>Desde</span>
                        <input
                          type="date"
                          className={styles.columnFilter}
                          aria-label="Finalización de la reserva desde"
                          value={accountFilters.finalizacionFrom}
                          onChange={(e) => setAccountFilter('finalizacionFrom', e.target.value)}
                        />
                      </label>
                      <label className={styles.columnFilterRow}>
                        <span className={styles.columnFilterLabel}>Hasta</span>
                        <input
                          type="date"
                          className={styles.columnFilter}
                          aria-label="Finalización de la reserva hasta"
                          value={accountFilters.finalizacionTo}
                          min={accountFilters.finalizacionFrom || undefined}
                          onChange={(e) => setAccountFilter('finalizacionTo', e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                  {openAccountColumn === 'cliente' && (
                    <input
                      type="search"
                      className={styles.columnFilter}
                      aria-label="Buscar cliente"
                      placeholder="Buscar cliente…"
                      autoFocus
                      value={accountFilters.cliente}
                      onChange={(e) => setAccountFilter('cliente', e.target.value)}
                    />
                  )}
                  {openAccountColumn === 'saldo' && (
                    <div className={styles.columnFilterStack}>
                      <input
                        type="number"
                        className={styles.columnFilter}
                        aria-label="Saldo mínimo"
                        placeholder="Mín"
                        autoFocus
                        value={accountFilters.saldoMin}
                        onChange={(e) => setAccountFilter('saldoMin', e.target.value)}
                      />
                      <input
                        type="number"
                        className={styles.columnFilter}
                        aria-label="Saldo máximo"
                        placeholder="Máx"
                        value={accountFilters.saldoMax}
                        onChange={(e) => setAccountFilter('saldoMax', e.target.value)}
                      />
                    </div>
                  )}
                  {openAccountColumn === 'saldoEstado' && (
                    <div
                      className={styles.columnFilterStack}
                      role="group"
                      aria-label="Filtrar por saldo estado"
                    >
                      {SALDO_ESTADO_OPTIONS.map((opt) => {
                        const checked = accountFilters.saldoEstado.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={styles.filterOption}
                            role="menuitemcheckbox"
                            aria-checked={checked}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleAccountMultiFilter('saldoEstado', opt.value)
                              }
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          )}

          {activeSection === SECTIONS.cobros && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Cobros</h2>
                <div className={styles.sectionActions}>
                  {hasActivePayFilters && (
                    <button
                      type="button"
                      className={styles.clearDates}
                      onClick={() => {
                        setPayFilters(EMPTY_PAY_FILTERS);
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
                    title="Crear nuevo cobro"
                  >
                    <FiPlus aria-hidden="true" />
                    Cobro
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

              <CobrosHistorialTable
                payments={payments}
                onPaymentsChange={setPayments}
                payFilters={payFilters}
                onPayFiltersChange={setPayFilters}
                enableColumnFilters
                canDeleteFactura={canFacturacion}
                clientIdFilter={clientIdParam}
                emptyMessage="No hay cobros con los filtros actuales"
                onClientClick={handleClientClick}
                onReservationClick={(reservaId) => {
                  if (reservaId != null) navigate(`/reservations/${reservaId}`);
                }}
                onEditCobro={handleEditCobro}
                onDeleteCobro={handleDeleteCobro}
                testId="estado-cuentas-cobros-table"
              />
            </section>
          )}

          {activeSection === SECTIONS.facturacion && canFacturacion && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Facturación</h2>
              </div>
              {renderFacturacionTable('A')}
              {renderFacturacionTable('B')}
              {renderFacturacionTable('T')}
            </section>
          )}
        </div>
      </div>

      {showCobroForm && (
        <CobroForm
          reservaId={
            editingCobro
              ? editingCobro.reservaId || editingCobro.reserva?.id || null
              : selectedReservation &&
                  selectedReservation.origen !== 'EXTERNA' &&
                  selectedReservation.accountKind !== 'EXTERNAL'
                ? selectedReservation.reservationId || selectedReservation.id
                : null
          }
          accountId={
            editingCobro
              ? editingCobro.accountId || null
              : selectedReservation &&
                  (selectedReservation.origen === 'EXTERNA' ||
                    selectedReservation.accountKind === 'EXTERNAL')
                ? selectedReservation.accountId
                : null
          }
          initialCobro={editingCobro}
          onClose={handleCloseCobroForm}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {noticeDialog}
      {confirmDialog}
    </div>
  );
};

export default Cobros;
