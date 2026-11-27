import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiChevronLeft, FiChevronRight, FiEdit2, FiPlus, FiRotateCcw, FiShoppingBag, FiXCircle } from 'react-icons/fi';
import {
  cancelarComida,
  fetchComidasDelDia,
  reactivarComida
} from '../../services/api';
import { todayIsoLocal } from '../../utils/calendarDates';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ReservationIdChip from '../ReservationIdChip';
import RoomNameChip from '../RoomNameChip';
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

const ORIGENES = [
  { key: 'incluida', label: 'Incluidos', className: 'segIncluida' },
  { key: 'adicional', label: 'Adicionales', className: 'segAdicional' },
  { key: 'externo', label: 'Externos', className: 'segExterno' }
];

function diaLabel(iso) {
  const hoy = todayIsoLocal();
  if (iso === hoy) return 'Hoy';
  if (iso === shiftIso(hoy, 1)) return 'Mañana';
  if (iso === shiftIso(hoy, -1)) return 'Ayer';
  return format(parseISO(iso), 'EEE d/M', { locale: es });
}

/** Tablero del día: total grande, barra por origen y personas con régimen especial. */
function ResumenDia({ fecha, grupo, grande = false }) {
  const total = grupo?.total ?? 0;
  const origen = grupo?.porOrigen || {};
  const conDieta = grupo?.conDieta ?? 0;
  const dietas = grupo?.dietas || [];
  const partes = ORIGENES.filter((o) => (origen[o.key] || 0) > 0);
  return (
    <div
      className={`${styles.resumen} ${grande ? styles.resumenGrande : styles.resumenChico}`}
      aria-label={`Resumen ${diaLabel(fecha)}`}
    >
      <div className={styles.resumenHead}>
        <span className={styles.resumenDia}>{diaLabel(fecha)}</span>
        <span className={styles.resumenFecha}>{format(parseISO(fecha), "d 'de' MMMM", { locale: es })}</span>
      </div>
      <div className={styles.resumenTotal}>
        <strong>{total}</strong>
        <span>comensales</span>
      </div>
      {grande && total > 0 ? (
        <div className={styles.barra} role="img" aria-label={partes.map((o) => `${o.label} ${origen[o.key]}`).join(', ')}>
          {partes.map((o) => (
            <span
              key={o.key}
              className={`${styles.barraSeg} ${styles[o.className]}`}
              style={{ flexGrow: origen[o.key] }}
            />
          ))}
        </div>
      ) : null}
      <ul className={styles.leyenda}>
        {partes.map((o) => (
          <li key={o.key}>
            {grande ? <span className={`${styles.leyendaDot} ${styles[o.className]}`} aria-hidden="true" /> : null}
            {o.label} <strong>{origen[o.key]}</strong>
          </li>
        ))}
        {!partes.length ? <li className={styles.muted}>Sin comensales</li> : null}
      </ul>
      <div className={styles.resumenDieta}>
        <span>
          Régimen especial <strong>{conDieta}</strong>
        </span>
        {grande && dietas.length ? <span className={styles.dietasLista}>{dietas.join(' · ')}</span> : null}
      </div>
    </div>
  );
}

/**
 * Comedor → Desayuno / Cena: tablero del día y del siguiente + comensales previstos.
 * Las incluidas vienen del régimen de la reserva; las cenas adicionales/externas se
 * cargan con «+ Cena» y generan su comanda de Cena (a la que se suman las bebidas).
 */
export default function ComensalesTab({ tipo = 'CENA' }) {
  const esCena = tipo === 'CENA';
  const grupoKey = esCena ? 'cenas' : 'desayunos';
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [fecha, setFecha] = useState(() => todayIsoLocal());
  const [data, setData] = useState(null);
  const [siguiente, setSiguiente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [nuevaCenaOpen, setNuevaCenaOpen] = useState(false);
  const [comandaPreset, setComandaPreset] = useState(null);
  const [cenaEditando, setCenaEditando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, resSig] = await Promise.all([
        fetchComidasDelDia(fecha, { incluirCanceladas: true }),
        fetchComidasDelDia(shiftIso(fecha, 1))
      ]);
      setData(res.data);
      setSiguiente(resSig?.data || null);
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

  const cambiarPorAlmuerzo = async (item) => {
    const ok = await confirm({
      title: 'Cambiar por almuerzo',
      message: `La cena incluida de ${item.guestName} (${item.pax}) se cambia por un almuerzo sin cargo para usar en Minutas.`,
      confirmText: 'Cambiar por almuerzo',
      cancelText: 'Volver'
    });
    if (!ok) return;
    run(item, () => cancelarComida(item.id));
  };

  const cancelar = async (item) => {
    const ok = await confirm({
      title: 'Cancelar cena',
      message: `¿Cancelar la cena de ${item.guestName}? Se quita la cena de su comanda; las bebidas ya cargadas se mantienen.`,
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
        {items.length === 0 ? (
          <p className={styles.muted}>Sin comensales previstos.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Nombre</th>
                <th>Dieta</th>
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
                      {item.clientId ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => navigate(`/clients/${item.clientId}`)}
                        >
                          {item.guestName}
                        </button>
                      ) : (
                        item.guestName
                      )}
                      {item.edades?.length ? <span className={styles.note}> · {item.edades.join(' · ')}</span> : null}
                      {item.notas ? <span className={styles.note}> · {item.notas}</span> : null}
                    </td>
                    <td>
                      {item.dietas?.length ? (
                        item.dietas.join(' · ')
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td>
                      {item.rooms?.length ? (
                        <RoomNameChip rooms={item.rooms} />
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.num}>{item.pax}</td>
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
                        {cancelada ? (item.origen === 'REGIMEN' ? 'Cambiada por almuerzo' : 'Cancelada') : 'Prevista'}
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
                          {!cancelada && item.origen === 'MANUAL' ? (
                            <>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => setCenaEditando(item)}
                                disabled={busy}
                                title="Editar cena"
                                aria-label={`Editar cena de ${item.guestName}`}
                              >
                                <FiEdit2 aria-hidden="true" />
                              </button>
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
                            </>
                          ) : !cancelada ? (
                            <button
                              type="button"
                              className={styles.textBtn}
                              onClick={() => cambiarPorAlmuerzo(item)}
                              disabled={busy}
                              aria-label={`Cambiar por almuerzo la cena de ${item.guestName}`}
                            >
                              Cambiar por almuerzo
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
        {esCena ? (
          <button type="button" className={`${styles.btnPrimary} ${styles.pushRight}`} onClick={() => setNuevaCenaOpen(true)}>
            <FiPlus aria-hidden="true" /> Cena
          </button>
        ) : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <p className={styles.muted}>Cargando…</p> : null}

      {data ? (
        <>
          <div className={styles.tablero}>
            <ResumenDia fecha={fecha} grupo={data[grupoKey]} grande />
            <ResumenDia fecha={shiftIso(fecha, 1)} grupo={siguiente?.[grupoKey]} />
          </div>
          {renderSection(esCena ? 'Cenas' : 'Desayunos', data[grupoKey], tipo)}
        </>
      ) : null}

      {esCena ? (
        <>
          <NuevaCenaModal
            open={nuevaCenaOpen}
            fecha={fecha}
            onClose={() => setNuevaCenaOpen(false)}
            onSaved={load}
          />
          <NuevaCenaModal
            open={Boolean(cenaEditando)}
            fecha={fecha}
            cena={cenaEditando}
            onClose={() => setCenaEditando(null)}
            onSaved={load}
          />
          <ConsumptionOrderModal
            open={Boolean(comandaPreset)}
            preset={comandaPreset}
            onClose={() => setComandaPreset(null)}
            onSaved={load}
          />
        </>
      ) : null}
    </div>
  );
}
