import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { getAllPagos } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PaymentForm from '../components/PaymentForm';
import PagosHistorialTable, {
  EMPTY_PAY_FILTERS,
} from '../components/PagosHistorialTable';
import styles from './ReceptionDashboard.module.css';

const RANGE_OPTIONS = [
  { days: 1, label: 'Hoy' },
  { days: 3, label: '3 días' },
  { days: 7, label: '7 días' },
];

function addDaysIso(iso, delta) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function pagoInHorizon(pago, todayIso, days) {
  if (!pago?.fecha) return false;
  const fecha = new Date(pago.fecha);
  if (Number.isNaN(fecha.getTime())) return false;
  const fromIso = addDaysIso(todayIso, -(Math.max(1, days) - 1));
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${todayIso}T23:59:59.999`);
  return fecha >= from && fecha <= to;
}

function RangeFilter({ value, onChange, labelledBy }) {
  return (
    <div className={styles.rangeGroup} role="group" aria-labelledby={labelledBy}>
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          type="button"
          className={`${styles.rangeBtn} ${
            value === opt.days ? styles.rangeBtnActive : ''
          }`}
          aria-pressed={value === opt.days}
          onClick={() => onChange(opt.days)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Widget Caja del dashboard: historial de pagos (misma tabla que Estado de cuentas)
 * con rango Hoy | 3 días | 7 días, crear y editar.
 */
export default function CajaWidget({ todayIso, className = '' }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canFacturacion = can('facturacion');
  const [horizonDays, setHorizonDays] = useState(1);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payFilters, setPayFilters] = useState(EMPTY_PAY_FILTERS);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPago, setEditingPago] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getAllPagos();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Error al cargar pagos');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const horizonPayments = useMemo(
    () =>
      (payments || []).filter((pago) =>
        pagoInHorizon(pago, todayIso, horizonDays)
      ),
    [payments, todayIso, horizonDays]
  );

  const hasActivePayFilters = useMemo(
    () =>
      Object.values(payFilters).some((value) => String(value || '').trim() !== ''),
    [payFilters]
  );

  const openNew = () => {
    setEditingPago(null);
    setPaymentOpen(true);
  };

  const openEdit = (pago) => {
    setEditingPago(pago);
    setPaymentOpen(true);
  };

  const closeForm = () => {
    setPaymentOpen(false);
    setEditingPago(null);
  };

  return (
    <section
      className={`${styles.module} ${styles.tileCaja} ${className}`.trim()}
      aria-labelledby="dash-caja"
      data-testid="caja-widget"
    >
      <div className={styles.moduleHeader}>
        <h2 id="dash-caja" className={styles.moduleTitle}>
          Caja
        </h2>
        <div className={styles.moduleToolbar}>
          <RangeFilter
            value={horizonDays}
            onChange={setHorizonDays}
            labelledBy="dash-caja"
          />
          {hasActivePayFilters ? (
            <button
              type="button"
              className={styles.textBtn}
              onClick={() => setPayFilters(EMPTY_PAY_FILTERS)}
            >
              Limpiar filtros
            </button>
          ) : null}
          <button
            type="button"
            className={styles.actionBtnPrimary}
            onClick={openNew}
            title="Crear nuevo pago"
            data-testid="caja-nuevo-pago"
          >
            <FiPlus aria-hidden="true" />
            Pago
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.empty}>Cargando pagos…</p>
      ) : error ? (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button type="button" className={styles.retryBtn} onClick={() => load()}>
            Reintentar
          </button>
        </div>
      ) : (
        <div className={styles.cajaTableWrap}>
          <PagosHistorialTable
            payments={horizonPayments}
            onPaymentsChange={setPayments}
            payFilters={payFilters}
            onPayFiltersChange={setPayFilters}
            enableColumnFilters
            canDeleteFactura={canFacturacion}
            emptyMessage="Sin pagos en el rango seleccionado"
            onClientClick={(client) => {
              if (client?.id) navigate(`/clients/${client.id}`);
            }}
            onEditPago={openEdit}
            testId="caja-pagos-table"
          />
        </div>
      )}

      {paymentOpen ? (
        <PaymentForm
          reservaId={editingPago?.reservaId || editingPago?.reserva?.id || null}
          accountId={editingPago?.accountId || null}
          initialPago={editingPago}
          onClose={closeForm}
          onSuccess={() => {
            closeForm();
            load({ quiet: true });
          }}
        />
      ) : null}
    </section>
  );
}
