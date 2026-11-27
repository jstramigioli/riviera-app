import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiChevronLeft,
  FiDownload,
  FiEdit2,
  FiPlus,
  FiPrinter
} from 'react-icons/fi';
import {
  fetchDailyMenuPdfBlob,
  getDailyMenuByDate
} from '../services/gastronomiaApi';
import RoomNameChip from '../components/RoomNameChip';
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
  th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:center}
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

async function openMenuPdf(menuId, mode) {
  const blob = await fetchDailyMenuPdfBlob(menuId);
  const url = URL.createObjectURL(blob);
  if (mode === 'download') {
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-riviera-${menuId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (mode === 'print' && win) {
    win.addEventListener('load', () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* ignore */
      }
    });
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const MESA_ENSALADAS = 'mesa de ensaladas';

const SECTION_LABELS = {
  ENTRADA: 'Entrada',
  ENSALADA: 'Ensaladas',
  SOPA: 'Sopa',
  PRIMER_PLATO: 'Primer plato',
  SEGUNDO_PLATO: 'Segundo plato',
  PLATO_INFANTIL: 'Plato infantil',
  POSTRE: 'Postres',
  BUFFET: 'Buffet'
};

const CONVENTIONAL_ORDER = [
  'ENTRADA',
  'ENSALADA',
  'SOPA',
  'PRIMER_PLATO',
  'SEGUNDO_PLATO',
  'PLATO_INFANTIL',
  'POSTRE'
];

function formatMenuDate(dateValue) {
  if (!dateValue) return '';
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(d);
}

/**
 * Mini menú estilo PDF A5: secciones con título + todos los ítems (sin logo).
 * ENSALADA: solo título «mesa de ensaladas» (misma tipografía que secciones; sin ítems).
 */
function buildMenuPreviewSections(menu) {
  if (!menu) return [];
  const bySection = new Map();
  for (const item of menu.items || []) {
    const key = item.section || 'BUFFET';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(item);
  }
  for (const list of bySection.values()) {
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  if (menu.kind === 'BUFFET') {
    const list = bySection.get('BUFFET') || [];
    const names = list.map((it) => it.nameSnapshot).filter(Boolean);
    return names.length ? [{ key: 'BUFFET', title: null, items: names }] : [];
  }

  const sections = [];
  for (const section of CONVENTIONAL_ORDER) {
    if (section === 'ENSALADA') {
      // Solo título tipográfico; sin sección «Ensaladas» + ítems.
      sections.push({
        key: section,
        title: MESA_ENSALADAS,
        items: [],
        titleOnly: true
      });
      continue;
    }
    const list = bySection.get(section) || [];
    const names = list.map((it) => it.nameSnapshot).filter(Boolean);
    if (!names.length) continue;
    sections.push({
      key: section,
      title: SECTION_LABELS[section] || section,
      items: names,
      titleOnly: false
    });
  }
  return sections;
}

/**
 * Hub temático Comidas: totales desayuno/cena → detalle;
 * menú diario MP conectado al módulo Gastronomía.
 */
export default function ComidasHub({
  mealsDateIso,
  onMealsDateChange,
  meals,
  mealsError = null,
  onOpenReservation,
  onOpenClient
}) {
  const [detailMeal, setDetailMeal] = useState(null);
  const [selectedBreakfast, setSelectedBreakfast] = useState(() => new Set());
  const [selectedDinner, setSelectedDinner] = useState(() => new Set());
  const [dailyMenu, setDailyMenu] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

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
    setPdfError(null);
  }, [mealsDateIso]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMenuLoading(true);
      setMenuError(null);
      try {
        const menu = await getDailyMenuByDate(mealsDateIso);
        if (!cancelled) setDailyMenu(menu);
      } catch (err) {
        if (!cancelled) {
          setDailyMenu(null);
          if (err.status !== 404) setMenuError(err.message);
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

  const detailItems =
    detailMeal === 'breakfast'
      ? breakfastItems
      : detailMeal === 'dinner'
        ? dinnerItems
        : [];
  const selectedSet =
    detailMeal === 'breakfast' ? selectedBreakfast : selectedDinner;
  const detailTitle = detailMeal === 'breakfast' ? 'Desayuno' : 'Cena';
  const previewSections = useMemo(
    () => buildMenuPreviewSections(dailyMenu),
    [dailyMenu]
  );
  const menuDateLabel = formatMenuDate(dailyMenu?.date || mealsDateIso);
  const editPath = dailyMenu?.id
    ? `/comedor?tab=week&id=${dailyMenu.id}`
    : `/comedor?tab=week&date=${mealsDateIso}`;

  return (
    <section
      className={`${styles.module} ${styles.tileComidas} ${styles.comidasHub}`}
      aria-labelledby="dash-comidas"
      data-testid="comidas-hub"
    >
      <div className={styles.moduleHeader}>
        <h2 id="dash-comidas" className={styles.moduleTitle}>
          Comidas
        </h2>
        <div className={styles.moduleToolbar}>
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
          {mealsError ? (
            <p className={styles.empty} role="alert" data-testid="comidas-error">
              {mealsError}
            </p>
          ) : null}
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
              <span className={styles.comidasTotalHint}>personas</span>
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
              <span className={styles.comidasTotalHint}>personas</span>
            </button>
          </div>

          <div className={styles.comidasMenuBlock} data-testid="comidas-menu-block">
            {menuLoading ? (
              <p className={styles.empty}>Cargando menú…</p>
            ) : menuError ? (
              <p className={styles.empty}>{menuError}</p>
            ) : dailyMenu ? (
              <div
                className={styles.comidasMenuMini}
                data-testid="comidas-menu-preview"
                aria-label="Vista previa del menú diario"
              >
                <p className={styles.comidasMenuMiniTitle}>Menú</p>
                <p className={styles.comidasMenuMiniDate}>{menuDateLabel}</p>
                <div className={styles.comidasMenuMiniRule} aria-hidden="true" />
                {previewSections.length ? (
                  <div className={styles.comidasMenuMiniBody}>
                    {previewSections.map((section) => (
                      <div
                        key={section.key}
                        className={styles.comidasMenuSection}
                        data-testid={`comidas-menu-section-${section.key}`}
                      >
                        {section.titleOnly ? (
                          <p className={styles.comidasMenuMesaEnsaladas}>
                            {section.title}
                          </p>
                        ) : (
                          <>
                            {section.title ? (
                              <h4 className={styles.comidasMenuSectionTitle}>
                                {section.title}
                              </h4>
                            ) : null}
                            <ul className={styles.comidasMenuList}>
                              {section.items.map((name) => (
                                <li key={`${section.key}-${name}`}>{name}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>Sin platos cargados.</p>
                )}
              </div>
            ) : (
              <p className={styles.empty} data-testid="comidas-menu-empty">
                No hay menú para esta fecha.
              </p>
            )}
            <div className={styles.comidasMenuActions}>
              <Link
                to={editPath}
                className={styles.comidasIconBtn}
                data-testid="comidas-menu-edit-link"
                aria-label={dailyMenu ? 'Editar menú' : 'Crear menú'}
                title={dailyMenu ? 'Editar menú' : 'Crear menú'}
              >
                {dailyMenu ? (
                  <FiEdit2 aria-hidden="true" />
                ) : (
                  <FiPlus aria-hidden="true" />
                )}
              </Link>
              {dailyMenu?.id ? (
                <>
                  <button
                    type="button"
                    className={styles.comidasIconBtn}
                    data-testid="comidas-menu-download-pdf"
                    aria-label="Descargar PDF"
                    title="Descargar PDF"
                    disabled={pdfBusy}
                    onClick={async () => {
                      setPdfBusy(true);
                      setPdfError(null);
                      try {
                        await openMenuPdf(dailyMenu.id, 'download');
                      } catch (err) {
                        setPdfError(err.message || 'No se pudo descargar el PDF');
                      } finally {
                        setPdfBusy(false);
                      }
                    }}
                  >
                    <FiDownload aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.comidasIconBtn}
                    data-testid="comidas-menu-print-pdf"
                    aria-label="Imprimir menú"
                    title="Imprimir menú"
                    disabled={pdfBusy}
                    onClick={async () => {
                      setPdfBusy(true);
                      setPdfError(null);
                      try {
                        await openMenuPdf(dailyMenu.id, 'print');
                      } catch (err) {
                        setPdfError(err.message || 'No se pudo imprimir el PDF');
                      } finally {
                        setPdfBusy(false);
                      }
                    }}
                  >
                    <FiPrinter aria-hidden="true" />
                  </button>
                </>
              ) : null}
              {pdfError ? (
                <p className={styles.comidasMenuError} role="alert">
                  {pdfError}
                </p>
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
                  <th className={styles.colRoom}>Habitación</th>
                  <th className={styles.colGuests}>Huéspedes</th>
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
                        onClick={() =>
                          item.clientId != null
                            ? onOpenClient?.(item.clientId)
                            : onOpenReservation?.(item.reservationId)
                        }
                        title={
                          item.clientId != null ? 'Ver cliente' : 'Ver reserva'
                        }
                      >
                        {item.guestName}
                      </button>
                    </td>
                    <td className={styles.colRoom}>
                      <RoomNameChip
                        name={item.roomLabel}
                        rooms={item.rooms}
                      />
                    </td>
                    <td className={styles.colGuests}>{item.guests ?? '—'}</td>
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
