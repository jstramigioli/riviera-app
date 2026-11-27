import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRotateCcw, FiXCircle } from 'react-icons/fi';
import {
  anularBeneficio,
  anularConsumptionOrder,
  cancelarComida,
  fetchComidasDeReserva,
  reactivarComida,
  restaurarBeneficio
} from '../../services/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { formatMoneyArs } from '../../utils/formatMoney';
import styles from './ComidasReservaPanel.module.css';

const ESTADO_BENEFICIO = {
  DISPONIBLE: 'Disponible',
  UTILIZADO: 'Utilizado',
  ANULADO: 'Anulado'
};

const MOTIVO_ANULACION = {
  CHECKOUT: 'por check-out',
  CENA_REACTIVADA: 'cena reactivada',
  FUERA_DE_ESTADIA: 'fuera de la estadía',
  MANUAL: 'manual'
};

const RESERVA_ACTIVA = new Set(['PENDIENTE', 'CONFIRMADA', 'INGRESADA']);

function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function fechaLarga(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC'
  }).format(d);
}

function celdaTexto(p) {
  if (!p) return '—';
  if (p.estado === 'CANCELADA') return 'Cancelada';
  return `${p.origen === 'REGIMEN' ? 'Incluida' : 'Adicional'} · ${p.pax}`;
}

/**
 * Detalle de reserva → Comidas: desayunos/cenas de la estadía (con cancelar /
 * reactivar cena incluida) y beneficios «Almuerzo sin cargo» con su estado,
 * historial y comanda en la que se usaron.
 */
export default function ComidasReservaPanel({ reservationId, reservationStatus, onChanged }) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!reservationId) return;
    try {
      const res = await fetchComidasDeReserva(reservationId);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las comidas');
    }
  }, [reservationId]);

  useEffect(() => {
    load();
  }, [load]);

  const dias = useMemo(() => {
    const byFecha = new Map();
    for (const p of data?.prestaciones || []) {
      if (!byFecha.has(p.fecha)) byFecha.set(p.fecha, { fecha: p.fecha, DESAYUNO: null, CENA: null });
      byFecha.get(p.fecha)[p.tipo] = p;
    }
    return [...byFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [data]);

  const editable = RESERVA_ACTIVA.has(reservationStatus);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const cancelarCena = async (p) => {
    const ok = await confirm({
      title: 'Cancelar cena',
      message: `¿Cancelar la cena incluida del ${fechaCorta(p.fecha)}? Se genera un almuerzo sin cargo.`,
      confirmText: 'Cancelar cena',
      cancelText: 'Volver'
    });
    if (ok) run(() => cancelarComida(p.id));
  };

  const anular = async (b) => {
    const ok = await confirm({
      title: 'Anular almuerzo sin cargo',
      message: `¿Anular el almuerzo sin cargo de la cena del ${fechaCorta(b.cenaFecha)}?`,
      confirmText: 'Anular'
    });
    if (ok) run(() => anularBeneficio(b.id));
  };

  const anularComanda = async (b) => {
    const ok = await confirm({
      title: 'Anular comanda',
      message: `¿Anular la comanda #${b.comanda.id}? Se eliminan sus cargos y el almuerzo sin cargo vuelve a quedar disponible.`,
      confirmText: 'Anular comanda'
    });
    if (ok) run(() => anularConsumptionOrder(b.comanda.id));
  };

  const beneficios = data?.beneficios || [];

  return (
    <div className={styles.root} data-testid="comidas-reserva">
      {confirmDialog}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.section} aria-label="Almuerzos sin cargo">
        <h3 className={styles.heading}>
          Almuerzos sin cargo
          {data?.beneficiosDisponibles ? (
            <span className={styles.badgeCount}>{data.beneficiosDisponibles} disponible{data.beneficiosDisponibles > 1 ? 's' : ''}</span>
          ) : null}
        </h3>
        {beneficios.length === 0 ? (
          <p className={styles.muted}>Sin beneficios.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Origen</th>
                <th>Estado</th>
                <th>Comanda</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {beneficios.map((b) => (
                <tr key={b.id}>
                  <td>Cena cancelada del {fechaCorta(b.cenaFecha)}</td>
                  <td>
                    <span className={styles.status}>
                      <span className={`${styles.dot} ${styles[`dot${b.estado}`]}`} aria-hidden="true" />
                      {ESTADO_BENEFICIO[b.estado]}
                      {b.estado === 'ANULADO' && b.motivoAnulacion ? (
                        <span className={styles.muted}> · {MOTIVO_ANULACION[b.motivoAnulacion]}</span>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    {b.comanda ? (
                      <span
                        title={b.comanda.items
                          .map((i) => `${i.descripcion}${i.bonificado ? ' (sin cargo)' : ` · ${formatMoneyArs(i.subtotal)}`}`)
                          .join('\n')}
                      >
                        #{b.comanda.id} · {fechaCorta(b.comanda.fecha)}
                        {b.comanda.estado === 'ANULADA' ? <span className={styles.muted}> · anulada</span> : null}
                      </span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {b.estado === 'DISPONIBLE' ? (
                        <button type="button" className={styles.linkBtn} onClick={() => anular(b)} disabled={busy}>
                          Anular
                        </button>
                      ) : null}
                      {b.estado === 'ANULADO' && b.motivoAnulacion === 'MANUAL' ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => run(() => restaurarBeneficio(b.id))}
                          disabled={busy}
                        >
                          Restaurar
                        </button>
                      ) : null}
                      {b.estado === 'UTILIZADO' && b.comanda?.estado === 'ACTIVA' ? (
                        <button type="button" className={styles.linkBtn} onClick={() => anularComanda(b)} disabled={busy}>
                          Anular comanda
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section} aria-label="Comidas de la estadía">
        <h3 className={styles.heading}>Comidas de la estadía</h3>
        {dias.length === 0 ? (
          <p className={styles.muted}>El servicio contratado no incluye comidas.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Desayuno</th>
                <th>Cena</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {dias.map((dia) => {
                const cena = dia.CENA;
                const cenaIncluida = cena?.origen === 'REGIMEN';
                return (
                  <tr key={dia.fecha}>
                    <td className={styles.fecha}>{fechaLarga(dia.fecha)}</td>
                    <td className={dia.DESAYUNO?.estado === 'CANCELADA' ? styles.cancelled : undefined}>
                      {celdaTexto(dia.DESAYUNO)}
                    </td>
                    <td className={cena?.estado === 'CANCELADA' ? styles.cancelled : undefined}>
                      {celdaTexto(cena)}
                    </td>
                    <td>
                      {editable && cenaIncluida ? (
                        <div className={styles.actions}>
                          {cena.estado === 'PREVISTA' ? (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => cancelarCena(cena)}
                              disabled={busy}
                              title="Cancelar cena"
                              aria-label={`Cancelar cena del ${fechaCorta(dia.fecha)}`}
                            >
                              <FiXCircle aria-hidden="true" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => run(() => reactivarComida(cena.id))}
                              disabled={busy}
                              title="Reactivar cena"
                              aria-label={`Reactivar cena del ${fechaCorta(dia.fecha)}`}
                            >
                              <FiRotateCcw aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
