import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiChevronLeft, FiChevronRight, FiPlus, FiRotateCcw, FiShoppingBag, FiXCircle } from 'react-icons/fi';
import {
  actualizarComida,
  cancelarComida,
  fetchComidasDelDia,
  reactivarComida
} from '../../services/api';
import { todayIsoLocal } from '../../utils/calendarDates';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ReservationIdChip from '../ReservationIdChip';
import ConsumptionOrderModal from '../ConsumptionOrderModal';
import NuevaCenaModal from './NuevaCenaModal';
import styles from './Comensales.module.css';

function origenLabel(item) {
  if (item.origen === 'REGIMEN') return 'Incluida';
  return item.esExterno ? 'Externo' : 'Adicional';
}

function shiftIso(iso, days) {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
}

/** Comensales de una comida: input que guarda al salir o con Enter. */
function PaxCell({ item, editable, onSave }) {
  const [value, setValue] = useState(String(item.pax));
  useEffect(() => setValue(String(item.pax)), [item.pax]);
  if (!editable) return <span className={styles.num}>{item.pax}</span>;
  const commit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      setValue(String(item.pax));
      return;
    }
    if (n !== item.pax) onSave(n);
  };
  return (
    <input
      className={styles.paxInput}
      type="number"
      min="1"
      max="99"
      value={value}
      aria-label="Comensales"
      title={item.paxManual ? 'Comensales editados a mano' : 'Comensales'}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/**
 * Gastronomía → Comensales: desayunos y cenas previstos del día. Las incluidas
 * vienen del régimen de la reserva; las adicionales/externas se cargan con
 * «+ Cena» y generan su comanda de Cena (a la que se suman las bebidas).
 */
export default function ComensalesTab() {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [fecha, setFecha] = useState(() => todayIsoLocal());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [nuevaCenaOpen, setNuevaCenaOpen] = useState(false);
  const [comandaPreset, setComandaPreset] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchComidasDelDia(fecha, { incluirCanceladas: true });
      setData(res.data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las comidas');
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (item, fn) => {
    setBusyId(item.id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción');
    } finally {
      setBusyId(null);
    }
  };

  const cancelar = async (item) => {
    const ok = await confirm({
      title: 'Cancelar cena',
      message:
        item.origen === 'REGIMEN'
          ? `¿Cancelar la cena incluida de ${item.guestName} (${item.pax})? Se genera un almuerzo sin cargo.`
          : `¿Cancelar la cena de ${item.guestName}? Se quita la cena de su comanda; las bebidas ya cargadas se mantienen.`,
      confirmText: 'Cancelar cena',
      cancelText: 'Volver'
    });
    if (!ok) return;
    run(item, () => cancelarComida(item.id));
  };

  const openConsumos = (item) => {
    if (item.comandaId && item.comandaEstado === 'ACTIVA') {
      setComandaPreset({ comandaId: item.comandaId });
    } else if (item.reservationId) {
      setComandaPreset({ reservationId: item.reservationId, ambito: 'CENA', fecha });
    }
  };

  const renderSection = (title, group, tipo) => {
    const items = group?.items || [];
    return (
      <section className={styles.section} aria-label={title}>
        <h3 className={styles.sectionTitle}>
          {title}
          <span className={styles.sectionTotal}>{group?.total ?? 0}</span>
        </h3>
        {items.length === 0 ? (
          <p className={styles.muted}>Sin comensales previstos.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Nombre</th>
                <th>Hab.</th>
                <th className={styles.num}>Pers.</th>
                <th>Origen</th>
                <th>Estado</th>
                {tipo === 'CENA' ? <th aria-label="Acciones" /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cancelada = item.estado === 'CANCELADA';
                const busy = busyId === item.id;
                const sinComanda =
                  item.origen === 'MANUAL' && !cancelada && item.comandaEstado !== 'ACTIVA';
                return (
                  <tr key={item.id} className={cancelada ? styles.rowCancelled : undefined}>
                    <td>
                      {item.reservationId ? (
                        <ReservationIdChip
                          id={item.reservationId}
                          status={item.reservationStatus}
                          onClick={() => navigate(`/reservations/${item.reservationId}`)}
                        />
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td>
                      {item.guestName}
                      {item.notas ? <span className={styles.note}> · {item.notas}</span> : null}
                    </td>
                    <td>{item.roomLabel}</td>
                    <td className={styles.num}>
                      <PaxCell
                        item={item}
                        editable={tipo === 'CENA' && !cancelada && !busy}
                        onSave={(n) => run(item, () => actualizarComida(item.id, { pax: n }))}
                      />
                    </td>
                    <td>
                      {origenLabel(item)}
                      {sinComanda ? <span className={styles.warn}> · sin comanda</span> : null}
                    </td>
                    <td>
                      <span className={styles.status}>
                        <span
                          className={`${styles.dot} ${cancelada ? styles.dotOff : styles.dotOn}`}
                          aria-hidden="true"
                        />
                        {cancelada ? 'Cancelada' : 'Prevista'}
                      </span>
                    </td>
                    {tipo === 'CENA' ? (
                      <td>
                        <div className={styles.actions}>
                          {!cancelada && (item.comandaEstado === 'ACTIVA' || item.reservationId) ? (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => openConsumos(item)}
                              disabled={busy}
                              title={item.comandaId ? `Agregar a la comanda #${item.comandaId}` : 'Nueva comanda de cena'}
                              aria-label="Consumos de la cena"
                            >
                              <FiShoppingBag aria-hidden="true" />
                            </button>
                          ) : null}
                          {!cancelada ? (
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconDanger}`}
                              onClick={() => cancelar(item)}
                              disabled={busy}
                              title="Cancelar cena"
                              aria-label={`Cancelar cena de ${item.guestName}`}
                            >
                              <FiXCircle aria-hidden="true" />
                            </button>
                          ) : item.origen === 'REGIMEN' ? (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => run(item, () => reactivarComida(item.id))}
                              disabled={busy}
                              title="Reactivar cena"
                              aria-label={`Reactivar cena de ${item.guestName}`}
                            >
                              <FiRotateCcw aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    );
  };

  return (
    <div className={styles.panel}>
      {confirmDialog}
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => setFecha((f) => shiftIso(f, -1))} aria-label="Día anterior">
          <FiChevronLeft aria-hidden="true" />
        </button>
        <input
          type="date"
          className={styles.dateInput}
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          aria-label="Fecha"
        />
        <button type="button" className={styles.btn} onClick={() => setFecha((f) => shiftIso(f, 1))} aria-label="Día siguiente">
          <FiChevronRight aria-hidden="true" />
        </button>
        <span className={styles.dateLabel}>
          {format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })}
        </span>
        <button type="button" className={styles.btn} onClick={() => setFecha(todayIsoLocal())}>
          Hoy
        </button>
        <button type="button" className={`${styles.btnPrimary} ${styles.pushRight}`} onClick={() => setNuevaCenaOpen(true)}>
          <FiPlus aria-hidden="true" /> Cena
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <p className={styles.muted}>Cargando…</p> : null}

      {data ? (
        <div className={styles.sections}>
          {renderSection('Cenas', data.cenas, 'CENA')}
          {renderSection('Desayunos', data.desayunos, 'DESAYUNO')}
        </div>
      ) : null}

      <NuevaCenaModal
        open={nuevaCenaOpen}
        fecha={fecha}
        onClose={() => setNuevaCenaOpen(false)}
        onSaved={load}
      />
      <ConsumptionOrderModal
        open={Boolean(comandaPreset)}
        preset={comandaPreset}
        onClose={() => setComandaPreset(null)}
        onSaved={load}
      />
    </div>
  );
}
