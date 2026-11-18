import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiPrinter, FiSave } from 'react-icons/fi';
import {
  loadMediaPensionMenu,
  saveMediaPensionMenu
} from '../utils/mediaPensionMenuStore';
import styles from './ReceptionDashboard.module.css';

function sumGuests(items) {
  return (items || []).reduce((sum, row) => sum + (Number(row.guests) || 0), 0);
}

function printMealRows(title, rows) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.guestName || r.label || '—')}</td><td>${escapeHtml(String(r.roomLabel || '—'))}</td><td>${escapeHtml(String(r.guests ?? ''))}</td></tr>`
    )
    .join('');
  const html = `<!doctype html><html><head><title>${escapeHtml(title)}</title>
<style>
  body{font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:#1f2933;padding:24px}
  h1{font-size:16px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #d8dde6}
  th{font-size:12px;color:#6b7280}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<table><thead><tr><th>Nombre</th><th>Habitación</th><th>Huéspedes</th></tr></thead>
<tbody>${body || '<tr><td colspan="3">Sin filas seleccionadas</td></tr>'}</tbody></table>
</body></html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=720,height=640');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Hub temático Comidas: totales desayuno/cena → detalle; menú diario MP (texto).
 */
export default function ComidasHub({
  mealsDateIso,
  onMealsDateChange,
  meals,
  onOpenReservation
}) {
  const [detailMeal, setDetailMeal] = useState(null); // 'breakfast' | 'dinner' | null
  const [selectedBreakfast, setSelectedBreakfast] = useState(() => new Set());
  const [selectedDinner, setSelectedDinner] = useState(() => new Set());
  const [menuText, setMenuText] = useState('');
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuStatus, setMenuStatus] = useState(null);
  const [menuDirty, setMenuDirty] = useState(false);

  const breakfastItems = meals?.breakfastItems || [];
  const dinnerItems = meals?.dinnerItems || [];

  const breakfastTotal = useMemo(() => {
    const fromStats = Number(meals?.breakfastGuests);
    if (Number.isFinite(fromStats) && fromStats >= 0) return fromStats;
    return sumGuests(breakfastItems);
  }, [meals?.breakfastGuests, breakfastItems]);

  const dinnerTotal = useMemo(() => {
    const fromStats = Number(meals?.dinnerGuests);
    if (Number.isFinite(fromStats) && fromStats >= 0) return fromStats;
    return sumGuests(dinnerItems);
  }, [meals?.dinnerGuests, dinnerItems]);

  useEffect(() => {
    setSelectedBreakfast(new Set());
    setSelectedDinner(new Set());
    setDetailMeal(null);
  }, [mealsDateIso]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMenuLoading(true);
      setMenuStatus(null);
      try {
        const text = await loadMediaPensionMenu(mealsDateIso);
        if (!cancelled) {
          setMenuText(text);
          setMenuDirty(false);
        }
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mealsDateIso]);

  const toggleMealSelection = (meal, reservationId) => {
    const setter = meal === 'breakfast' ? setSelectedBreakfast : setSelectedDinner;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(reservationId)) next.delete(reservationId);
      else next.add(reservationId);
      return next;
    });
  };

  const handleSaveMenu = async () => {
    setMenuSaving(true);
    setMenuStatus(null);
    try {
      const result = await saveMediaPensionMenu(mealsDateIso, menuText);
      setMenuDirty(false);
      if (result.source === 'config') {
        setMenuStatus({ type: 'ok', message: 'Menú guardado' });
      } else {
        setMenuStatus({
          type: 'warn',
          message: result.error
            ? `Guardado en este navegador (${result.error})`
            : 'Guardado en este navegador'
        });
      }
    } catch (err) {
      setMenuStatus({
        type: 'error',
        message: err?.message || 'No se pudo guardar el menú'
      });
    } finally {
      setMenuSaving(false);
    }
  };

  const detailItems =
    detailMeal === 'breakfast'
      ? breakfastItems
      : detailMeal === 'dinner'
        ? dinnerItems
        : [];
  const selectedSet =
    detailMeal === 'breakfast' ? selectedBreakfast : selectedDinner;
  const detailTitle = detailMeal === 'breakfast' ? 'Desayuno' : 'Cena';

  return (
    <section
      className={`${styles.module} ${styles.moduleWide} ${styles.comidasHub}`}
      aria-labelledby="dash-comidas"
      data-testid="comidas-hub"
    >
      <div className={styles.comidasHeader}>
        <h2 id="dash-comidas" className={styles.moduleTitle}>
          Comidas
        </h2>
        <div className={styles.mealsToolbar}>
          <label className={styles.srOnly} htmlFor="dash-comidas-date">
            Fecha de comidas
          </label>
          <input
            id="dash-comidas-date"
            type="date"
            className={styles.dateInput}
            value={mealsDateIso}
            onChange={(e) => {
              if (e.target.value) onMealsDateChange?.(e.target.value);
            }}
            aria-label="Fecha de comidas"
            data-testid="comidas-date"
          />
        </div>
      </div>

      {detailMeal == null ? (
        <>
          <div className={styles.comidasTotals} role="group" aria-label="Totales de comidas">
            <button
              type="button"
              className={styles.comidasTotalBtn}
              onClick={() => setDetailMeal('breakfast')}
              data-testid="comidas-total-breakfast"
              aria-label={`Ver detalle de desayuno, ${breakfastTotal} personas`}
            >
              <span className={styles.comidasTotalLabel}>Desayuno</span>
              <span className={styles.comidasTotalValue}>{breakfastTotal}</span>
              <span className={styles.comidasTotalHint}>personas · ver detalle</span>
            </button>
            <button
              type="button"
              className={styles.comidasTotalBtn}
              onClick={() => setDetailMeal('dinner')}
              data-testid="comidas-total-dinner"
              aria-label={`Ver detalle de cena, ${dinnerTotal} personas`}
            >
              <span className={styles.comidasTotalLabel}>Cena</span>
              <span className={styles.comidasTotalValue}>{dinnerTotal}</span>
              <span className={styles.comidasTotalHint}>personas · ver detalle</span>
            </button>
          </div>

          <div className={styles.comidasMenuBlock}>
            <div className={styles.comidasMenuHeader}>
              <h3 className={styles.comidasMenuTitle}>Menú diario · media pensión</h3>
              <p className={styles.comidasMenuNote}>
                Independiente del menú de minutas / snacks de consumos.
              </p>
            </div>
            <textarea
              className={styles.comidasMenuInput}
              value={menuText}
              onChange={(e) => {
                setMenuText(e.target.value);
                setMenuDirty(true);
                setMenuStatus(null);
              }}
              rows={5}
              placeholder="Ej.: Entrada · Principal · Postre…"
              disabled={menuLoading || menuSaving}
              aria-label="Menú diario de media pensión"
              data-testid="comidas-menu-input"
            />
            <div className={styles.comidasMenuActions}>
              <button
                type="button"
                className={styles.actionBtnPrimary}
                onClick={handleSaveMenu}
                disabled={menuLoading || menuSaving || !menuDirty}
                data-testid="comidas-menu-save"
              >
                <FiSave aria-hidden="true" />
                {menuSaving ? 'Guardando…' : 'Guardar menú'}
              </button>
              {menuStatus ? (
                <span
                  className={
                    menuStatus.type === 'error'
                      ? styles.comidasMenuError
                      : menuStatus.type === 'warn'
                        ? styles.comidasMenuWarn
                        : styles.comidasMenuOk
                  }
                  role="status"
                  data-testid="comidas-menu-status"
                >
                  {menuStatus.message}
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.comidasDetail} data-testid={`comidas-detail-${detailMeal}`}>
          <div className={styles.comidasDetailToolbar}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setDetailMeal(null)}
              data-testid="comidas-detail-back"
            >
              <FiChevronLeft aria-hidden="true" />
              Volver
            </button>
            <h3 className={styles.comidasDetailTitle}>{detailTitle}</h3>
            <button
              type="button"
              className={styles.actionBtn}
              disabled={selectedSet.size === 0}
              onClick={() =>
                printMealRows(
                  `${detailTitle} · ${mealsDateIso}`,
                  detailItems.filter((r) => selectedSet.has(r.reservationId))
                )
              }
              data-testid="comidas-detail-print"
            >
              <FiPrinter aria-hidden="true" />
              Imprimir detalle
            </button>
          </div>

          {detailItems.length === 0 ? (
            <p className={styles.empty}>
              {detailMeal === 'breakfast' ? 'Sin desayunos.' : 'Sin cenas.'}
            </p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th className={styles.checkCol} />
                  <th>Nombre</th>
                  <th>Habitación</th>
                  <th>Huéspedes</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((item) => (
                  <tr key={`${detailMeal}-${item.reservationId}`}>
                    <td className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.reservationId)}
                        onChange={() =>
                          toggleMealSelection(detailMeal, item.reservationId)
                        }
                        aria-label={`Seleccionar ${item.guestName}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.listLink}
                        onClick={() => onOpenReservation?.(item.reservationId)}
                      >
                        {item.guestName}
                      </button>
                    </td>
                    <td>{item.roomLabel || '—'}</td>
                    <td>{item.guests ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
