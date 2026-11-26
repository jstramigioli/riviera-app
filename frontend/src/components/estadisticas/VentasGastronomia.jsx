import { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { fetchVentasGastronomia } from '../../services/api';
import { todayIsoLocal } from '../../utils/calendarDates';
import { formatMoneyArs } from '../../utils/formatMoney';
import styles from './VentasGastronomia.module.css';

const AMBITO_LABELS = {
  CENA: 'Cena',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería',
  FRIGOBAR: 'Frigobar'
};

function money(v) {
  return formatMoneyArs(v, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function rangoMes(baseIso, offset = 0) {
  const base = subMonths(new Date(`${baseIso}T12:00:00`), offset);
  const fin = offset === 0 ? new Date(`${baseIso}T12:00:00`) : endOfMonth(base);
  return { desde: format(startOfMonth(base), 'yyyy-MM-dd'), hasta: format(fin, 'yyyy-MM-dd') };
}

/**
 * Estadísticas → Ventas gastronómicas: lo vendido por ámbito (Cena, Minutas,
 * Cafetería, Frigobar) y por producto, separando lo facturado de lo sin cargo
 * (Almuerzo sin cargo). Fuente: líneas de comandas activas.
 */
export default function VentasGastronomia() {
  const hoy = todayIsoLocal();
  const [rango, setRango] = useState(() => rangoMes(hoy, 0));
  const [ambitoFiltro, setAmbitoFiltro] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!rango.desde || !rango.hasta) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVentasGastronomia(rango);
      setData(res.data);
    } catch (err) {
      setError(err.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  }, [rango]);

  useEffect(() => {
    load();
  }, [load]);

  const productos = useMemo(
    () => (data?.porProducto || []).filter((p) => !ambitoFiltro || p.ambito === ambitoFiltro),
    [data, ambitoFiltro]
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Ventas gastronómicas</h2>
        <label className={styles.field}>
          <span className={styles.label}>Desde</span>
          <input
            type="date"
            className={styles.input}
            value={rango.desde}
            max={rango.hasta}
            onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Hasta</span>
          <input
            type="date"
            className={styles.input}
            value={rango.hasta}
            min={rango.desde}
            onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
          />
        </label>
        <div className={styles.presets}>
          <button type="button" className={styles.btn} onClick={() => setRango(rangoMes(hoy, 0))}>
            Este mes
          </button>
          <button type="button" className={styles.btn} onClick={() => setRango(rangoMes(hoy, 1))}>
            Mes anterior
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <p className={styles.muted}>Cargando…</p> : null}

      {data ? (
        <>
          <section aria-label="Ventas por ámbito">
            <h3 className={styles.heading}>Por ámbito</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ámbito</th>
                  <th className={styles.num}>Comandas</th>
                  <th className={styles.num}>Unidades</th>
                  <th className={styles.num}>Facturado</th>
                  <th className={styles.num}>Sin cargo</th>
                </tr>
              </thead>
              <tbody>
                {data.porAmbito.map((a) => (
                  <tr key={a.ambito}>
                    <td>{AMBITO_LABELS[a.ambito] || a.ambito}</td>
                    <td className={styles.num}>{a.comandas}</td>
                    <td className={styles.num}>{a.unidades}</td>
                    <td className={styles.num}>{money(a.facturado)}</td>
                    <td className={`${styles.num} ${styles.mutedCell}`}>{a.sinCargo ? money(a.sinCargo) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={styles.num}>{data.totales.comandas}</td>
                  <td className={styles.num}>{data.totales.unidades}</td>
                  <td className={styles.num}>{money(data.totales.facturado)}</td>
                  <td className={`${styles.num} ${styles.mutedCell}`}>
                    {data.totales.sinCargo ? money(data.totales.sinCargo) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section aria-label="Ventas por producto">
            <div className={styles.sectionHeader}>
              <h3 className={styles.heading}>Por producto</h3>
              <select
                className={styles.input}
                value={ambitoFiltro}
                onChange={(e) => setAmbitoFiltro(e.target.value)}
                aria-label="Filtrar por ámbito"
              >
                <option value="">Todos los ámbitos</option>
                {Object.entries(AMBITO_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {productos.length === 0 ? (
              <p className={styles.muted}>Sin ventas en el período.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Ámbito</th>
                    <th className={styles.num}>Unidades</th>
                    <th className={styles.num}>Facturado</th>
                    <th className={styles.num}>Sin cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={`${p.ambito}-${p.menuItemId}-${p.producto}`}>
                      <td>{p.producto}</td>
                      <td>{AMBITO_LABELS[p.ambito] || p.ambito}</td>
                      <td className={styles.num}>{p.unidades}</td>
                      <td className={styles.num}>{money(p.facturado)}</td>
                      <td className={`${styles.num} ${styles.mutedCell}`}>{p.sinCargo ? money(p.sinCargo) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className={styles.footnote}>
              Incluye lo cargado por comanda. Sin cargo: almuerzos sin cargo, a precio de lista del momento.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
