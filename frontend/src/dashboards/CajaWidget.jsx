import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { getAllCobros } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CobroForm from '../components/CobroForm';
import CobrosHistorialTable, {
  EMPTY_PAY_FILTERS,
} from '../components/CobrosHistorialTable';
import styles from './ReceptionDashboard.module.css';

/**
 * Widget Caja del dashboard: historial de cobros (misma tabla que Estado de cuentas)
 * con alta de cobro. Sin filtros de rango ni editar/eliminar aquí
 * (esas acciones viven en Estado de cuentas, perfil y reserva).
 * `refreshToken`: el padre lo incrementa tras crear/editar cobro fuera del widget (FAB).
 */
export default function CajaWidget({ refreshToken = 0, className = '' }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canFacturacion = can('facturacion');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payFilters, setPayFilters] = useState(EMPTY_PAY_FILTERS);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingCobro, setEditingCobro] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getAllCobros();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Error al cargar cobros');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load({ quiet: refreshToken > 0 });
    // refreshToken: recarga tras cobro creado/editado desde el FAB del dashboard
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load es estable en la práctica
  }, [refreshToken]);

  const hasActivePayFilters = useMemo(
    () =>
      Object.values(payFilters).some((value) => String(value || '').trim() !== ''),
    [payFilters]
  );

  const openNew = () => {
    setEditingCobro(null);
    setPaymentOpen(true);
  };

  const openEdit = (cobro) => {
    setEditingCobro(cobro || null);
    setPaymentOpen(true);
  };

  const closeForm = () => {
    setPaymentOpen(false);
    setEditingCobro(null);
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
            title="Crear nuevo cobro"
            data-testid="caja-nuevo-cobro"
          >
            <FiPlus aria-hidden="true" />
            Cobro
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.empty}>Cargando cobros…</p>
      ) : error ? (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button type="button" className={styles.retryBtn} onClick={() => load()}>
            Reintentar
          </button>
        </div>
      ) : (
        <div className={styles.cajaTableWrap}>
          <CobrosHistorialTable
            payments={payments}
            onPaymentsChange={setPayments}
            payFilters={payFilters}
            onPayFiltersChange={setPayFilters}
            enableColumnFilters
            canDeleteFactura={canFacturacion}
            emptyMessage="Sin cobros"
            onClientClick={(client) => {
              if (client?.id) navigate(`/clients/${client.id}`);
            }}
            onReservationClick={(reservaId) => {
              if (reservaId != null) navigate(`/reservations/${reservaId}`);
            }}
            onEditCobro={openEdit}
            enableRowActions={false}
            testId="caja-cobros-table"
          />
        </div>
      )}

      {paymentOpen ? (
        <CobroForm
          reservaId={
            editingCobro
              ? editingCobro.reservaId ||
                editingCobro.reserva?.id ||
                editingCobro.imputaciones?.[0]?.reservaId ||
                editingCobro.imputaciones?.[0]?.reserva?.id ||
                null
              : null
          }
          accountId={
            editingCobro
              ? editingCobro.accountId ||
                editingCobro.imputaciones?.[0]?.accountId ||
                null
              : null
          }
          initialCobro={editingCobro}
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
