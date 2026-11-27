import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiDownload,
  FiEdit2,
  FiPlus,
  FiPrinter,
  FiSave,
  FiX
} from 'react-icons/fi';
import {
  addDays,
  format,
  parseISO,
  startOfWeek
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  listDailyMenus,
  getDailyMenu,
  getDailyMenuByDate,
  createDailyMenu,
  updateDailyMenu,
  copyDailyMenu,
  fetchDailyMenuPdfBlob,
  searchDishes
} from '../services/gastronomiaApi';
import { todayIsoLocal } from '../utils/calendarDates';
import { CATALOG_CATEGORIES } from '../constants/catalogoPlatos';
import { buildMenuPreviewSections } from '../utils/menuPreview';
import ComensalesTab from '../components/gastronomia/ComensalesTab';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import styles from './Gastronomia.module.css';
import modalStyles from '../components/gastronomia/Comensales.module.css';

const MESA_ENSALADAS = 'mesa de ensaladas';

const SECTIONS = [
  { id: 'ENTRADA', label: 'Entrada' },
  { id: 'ENSALADA', label: 'mesa de ensaladas', fixed: true },
  { id: 'SOPA', label: 'Sopa' },
  { id: 'PRIMER_PLATO', label: 'Primer plato' },
  { id: 'SEGUNDO_PLATO', label: 'Segundo plato' },
  { id: 'PLATO_INFANTIL', label: 'Plato infantil' },
  { id: 'POSTRE', label: 'Postres' }
];

function sectionToDishCategory(section) {
  const s = String(section || '').toUpperCase();
  if (s === 'PRIMER_PLATO' || s === 'SEGUNDO_PLATO') return 'PLATO_PRINCIPAL';
  return CATALOG_CATEGORIES.some((c) => c.id === s) ? s : null;
}

/** Postres admiten varios platos; el resto del convencional es 1 por categoría. */
const MULTI_ITEM_SECTIONS = new Set(['POSTRE']);
const FIXED_SECTIONS = new Set(
  SECTIONS.filter((s) => s.fixed).map((s) => s.id)
);

const TABS = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'cena', label: 'Cena' },
  { id: 'week', label: 'Menús diarios' }
];

/** Pestañas viejas (links guardados): comensales → cena, historial → menús. */
const LEGACY_TABS = { comensales: 'cena', history: 'week' };

function weekStartIso(iso) {
  const d = parseISO(iso);
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function weekDays(fromIso) {
  const start = parseISO(fromIso);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return {
      iso: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEE', { locale: es }),
      dayNum: format(day, 'd/M')
    };
  });
}

function emptyItem(section = 'BUFFET') {
  if (section === 'ENSALADA') {
    return {
      section: 'ENSALADA',
      name: MESA_ENSALADAS,
      description: '',
      sortOrder: 0
    };
  }
  return { section, name: '', description: '', sortOrder: 0 };
}

function itemsFromMenu(menu) {
  if (!menu?.items?.length) {
    if (menu?.kind === 'BUFFET') return [emptyItem('BUFFET')];
    return SECTIONS.map((s) => emptyItem(s.id));
  }
  if (menu.kind === 'BUFFET') {
    return menu.items.map((it, idx) => ({
      section: 'BUFFET',
      name: it.nameSnapshot || '',
      description: it.descriptionSnap || '',
      sortOrder: it.sortOrder ?? idx
    }));
  }
  // Convencional: 1 slot por sección fija; Postre conserva todos los ítems.
  const mapped = menu.items.map((it, idx) => ({
    section: it.section,
    name: it.nameSnapshot || '',
    description: it.descriptionSnap || '',
    sortOrder: it.sortOrder ?? idx
  }));
  const out = [];
  for (const section of SECTIONS) {
    if (FIXED_SECTIONS.has(section.id)) {
      out.push(emptyItem(section.id));
      continue;
    }
    const rows = mapped.filter((i) => i.section === section.id);
    if (MULTI_ITEM_SECTIONS.has(section.id)) {
      if (rows.length) out.push(...rows);
      else out.push(emptyItem(section.id));
    } else {
      out.push(rows[0] || emptyItem(section.id));
    }
  }
  return out;
}

function conventionalItemsFromPrevious(prevItems) {
  const out = [];
  for (const section of SECTIONS) {
    if (FIXED_SECTIONS.has(section.id)) {
      out.push(emptyItem(section.id));
      continue;
    }
    const rows = (prevItems || []).filter(
      (i) => i.section === section.id && String(i.name || '').trim()
    );
    if (MULTI_ITEM_SECTIONS.has(section.id)) {
      if (rows.length) out.push(...rows.map((r) => ({ ...r, section: section.id })));
      else out.push(emptyItem(section.id));
    } else {
      out.push(rows[0] ? { ...rows[0], section: section.id } : emptyItem(section.id));
    }
  }
  return out;
}

function StatusBadge({ status }) {
  if (status === 'PUBLISHED') {
    return <span className={`${styles.badge} ${styles.badgePublished}`}>Publicado</span>;
  }
  if (status === 'DRAFT') {
    return <span className={`${styles.badge} ${styles.badgeDraft}`}>Borrador</span>;
  }
  return null;
}

async function openPdf(menuId, mode) {
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

/** Menú completo (todas las secciones) para las tarjetas de la semana. */
function MenuCompleto({ menu }) {
  const sections = buildMenuPreviewSections(menu);
  if (!sections.length) return <span className={styles.dayMeta}>Sin platos cargados</span>;
  return (
    <div className={styles.dayMenu}>
      {sections.map((section) =>
        section.titleOnly ? (
          <p key={section.key} className={styles.dayMenuMesa}>
            {section.title}
          </p>
        ) : (
          <div key={section.key} className={styles.dayMenuSection}>
            {section.title ? <span className={styles.dayMenuTitle}>{section.title}</span> : null}
            <ul className={styles.dayMenuList}>
              {section.items.map((name, i) => (
                <li key={`${section.key}-${i}`}>{name}</li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}

/** Descargar / imprimir / editar / reutilizar: mismas acciones en tarjetas e historial. */
function MenuActions({ menu, onEdit, onReuse, onError }) {
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  const pdf = (mode) =>
    stop(() => {
      openPdf(menu.id, mode).catch((err) => onError?.(err.message || 'No se pudo abrir el PDF'));
    });
  return (
    <div className={styles.menuActions}>
      <button type="button" className={styles.iconBtn} onClick={pdf('download')} title="Descargar" aria-label={`Descargar menú del ${menu.date}`}>
        <FiDownload aria-hidden="true" />
      </button>
      <button type="button" className={styles.iconBtn} onClick={pdf('print')} title="Imprimir" aria-label={`Imprimir menú del ${menu.date}`}>
        <FiPrinter aria-hidden="true" />
      </button>
      <button type="button" className={styles.iconBtn} onClick={stop(onEdit)} title="Editar" aria-label={`Editar menú del ${menu.date}`}>
        <FiEdit2 aria-hidden="true" />
      </button>
      <button type="button" className={styles.iconBtn} onClick={stop(onReuse)} title="Reutilizar" aria-label={`Reutilizar menú del ${menu.date}`}>
        <FiCopy aria-hidden="true" />
      </button>
    </div>
  );
}

/** Copia un menú a otra fecha y abre el editor del nuevo. */
function ReutilizarMenuModal({ menu, onClose, onDone }) {
  const today = todayIsoLocal();
  const [fecha, setFecha] = useState(() =>
    menu.date === today ? format(addDays(parseISO(today), 1), 'yyyy-MM-dd') : today
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const overlay = useOverlayDismiss(onClose, { enabled: !saving });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await copyDailyMenu(menu.id, fecha);
      onDone(created);
    } catch (err) {
      setError(err.status === 409 ? 'Ya hay un menú cargado ese día.' : err.message);
      setSaving(false);
    }
  };

  return (
    <div className={modalStyles.overlay} role="presentation" {...overlay}>
      <form
        className={modalStyles.modal}
        style={{ width: 'min(24rem, 100%)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reutilizar-menu-title"
        onSubmit={submit}
      >
        <div className={modalStyles.modalHeader}>
          <h2 id="reutilizar-menu-title" className={modalStyles.modalTitle}>
            Reutilizar menú del {format(parseISO(menu.date), 'd/M')}
          </h2>
          <button type="button" className={modalStyles.iconBtn} onClick={onClose} aria-label="Cerrar">
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className={modalStyles.modalBody}>
          <label className={modalStyles.field}>
            <span className={modalStyles.label}>Para el día</span>
            <input
              type="date"
              className={modalStyles.dateInput}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className={modalStyles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className={modalStyles.modalFooter}>
          <span />
          <div className={modalStyles.footerActions}>
            <button type="button" className={modalStyles.btn} onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={modalStyles.btnPrimary} disabled={saving || !fecha}>
              {saving ? 'Copiando…' : 'Reutilizar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function Gastronomia() {
  const [searchParams, setSearchParams] = useSearchParams();
  if (searchParams.get('tab') === 'catalog') {
    return <Navigate to="/configuracion?tab=platos" replace />;
  }
  return <GastronomiaPage searchParams={searchParams} setSearchParams={setSearchParams} />;
}

function GastronomiaPage({ searchParams, setSearchParams }) {
  const rawTab = searchParams.get('tab');
  const tab =
    LEGACY_TABS[rawTab] ||
    (TABS.some((t) => t.id === rawTab) ? rawTab : null) ||
    (searchParams.get('id') || searchParams.get('date') ? 'week' : 'desayuno');
  const editId = searchParams.get('id');
  const editDate = searchParams.get('date');

  const [weekFrom, setWeekFrom] = useState(() => weekStartIso(todayIsoLocal()));
  const [weekMenus, setWeekMenus] = useState([]);
  const [historyFrom, setHistoryFrom] = useState(() =>
    format(addDays(parseISO(todayIsoLocal()), -30), 'yyyy-MM-dd')
  );
  const [historyTo, setHistoryTo] = useState(() => todayIsoLocal());
  const [historyRows, setHistoryRows] = useState([]);
  const [reuseMenu, setReuseMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [editor, setEditor] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestFor, setSuggestFor] = useState(null);
  const [saving, setSaving] = useState(false);

  const setTab = (next) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    sp.delete('id');
    sp.delete('date');
    setSearchParams(sp);
    setEditor(null);
  };

  const openEditor = useCallback((opts) => {
    const sp = new URLSearchParams();
    sp.set('tab', 'week');
    if (opts?.id) sp.set('id', String(opts.id));
    if (opts?.date) sp.set('date', opts.date);
    setSearchParams(sp);
  }, [setSearchParams]);

  const loadWeek = useCallback(async () => {
    const to = format(addDays(parseISO(weekFrom), 6), 'yyyy-MM-dd');
    setLoading(true);
    setError(null);
    try {
      const rows = await listDailyMenus({ from: weekFrom, to });
      setWeekMenus(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [weekFrom]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDailyMenus({ from: historyFrom, to: historyTo });
      setHistoryRows(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [historyFrom, historyTo]);

  useEffect(() => {
    if (tab === 'week' && !editId && !editDate) loadWeek();
  }, [tab, editId, editDate, loadWeek]);

  useEffect(() => {
    if (tab === 'week' && !editId && !editDate) loadHistory();
  }, [tab, editId, editDate, loadHistory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!editId && !editDate) {
        setEditor(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let menu = null;
        if (editId) menu = await getDailyMenu(editId);
        else {
          try {
            menu = await getDailyMenuByDate(editDate);
          } catch (err) {
            if (err.status !== 404) throw err;
            menu = {
              id: null,
              date: editDate,
              kind: 'CONVENTIONAL',
              status: 'DRAFT',
              notes: '',
              items: []
            };
          }
        }
        if (!cancelled) {
          setEditor({
            id: menu.id,
            date: menu.date,
            kind: menu.kind || 'CONVENTIONAL',
            status: menu.status || 'DRAFT',
            notes: menu.notes || '',
            items: itemsFromMenu(menu),
            dirty: false
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, editDate]);

  const weekByDate = useMemo(() => {
    const map = new Map();
    for (const row of weekMenus) map.set(row.date, row);
    return map;
  }, [weekMenus]);

  const days = useMemo(() => weekDays(weekFrom), [weekFrom]);
  const today = todayIsoLocal();

  const updateEditor = (patch) => {
    setEditor((prev) => (prev ? { ...prev, ...patch, dirty: true } : prev));
  };

  const setKind = (kind) => {
    setEditor((prev) => {
      if (!prev) return prev;
      let items = prev.items;
      if (kind === 'BUFFET') {
        items = prev.items
          .filter((i) => i.name.trim())
          .map((i, idx) => ({ ...i, section: 'BUFFET', sortOrder: idx }));
        if (!items.length) items = [emptyItem('BUFFET')];
      } else {
        items = conventionalItemsFromPrevious(prev.items);
      }
      return { ...prev, kind, items, dirty: true };
    });
  };

  const onNameChange = async (index, value) => {
    const section = editor?.items?.[index]?.section || null;
    setEditor((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) =>
        i === index ? { ...it, name: value } : it
      );
      return { ...prev, items, dirty: true };
    });
    setSuggestFor(index);
    if (String(value).trim().length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const category = sectionToDishCategory(section);
      const rows = await searchDishes(value, 8, {
        ...(category ? { category } : {})
      });
      setSuggestions(rows);
    } catch {
      setSuggestions([]);
    }
  };

  const pickSuggestion = (index, dish) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) =>
        i === index ? { ...it, name: dish.name } : it
      );
      return { ...prev, items, dirty: true };
    });
    setSuggestions([]);
    setSuggestFor(null);
  };

  const saveEditor = async () => {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: editor.date,
        kind: editor.kind,
        status: editor.status,
        notes: editor.notes || null,
        items: editor.items
          .filter((i) => i.name.trim())
          .map((i, idx) => ({
            section: editor.kind === 'BUFFET' ? 'BUFFET' : i.section,
            name: i.name.trim(),
            description: i.description?.trim() || null,
            sortOrder: idx
          }))
      };
      let saved;
      if (editor.id) saved = await updateDailyMenu(editor.id, payload);
      else saved = await createDailyMenu(payload);
      setEditor({
        id: saved.id,
        date: saved.date,
        kind: saved.kind,
        status: saved.status,
        notes: saved.notes || '',
        items: itemsFromMenu(saved),
        dirty: false
      });
      openEditor({ id: saved.id, date: saved.date });
      loadWeek();
    } catch (err) {
      if (err.status === 409 && err.data?.existingId) {
        setError('Ya existe un menú ese día. Abriendo el existente…');
        openEditor({ id: err.data.existingId });
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const copyFromPreviousWeek = async () => {
    if (!editor?.date) return;
    const prevDate = format(addDays(parseISO(editor.date), -7), 'yyyy-MM-dd');
    try {
      const source = await getDailyMenuByDate(prevDate);
      if (editor.id) {
        // overwrite current draft fields from source (user still saves)
        setEditor((prev) => ({
          ...prev,
          kind: source.kind,
          notes: source.notes || '',
          items: itemsFromMenu(source),
          dirty: true
        }));

      } else {
        const created = await copyDailyMenu(source.id, editor.date);
        openEditor({ id: created.id, date: created.date });

      }
    } catch (err) {
      setError(
        err.status === 404
          ? `No hay menú el ${prevDate} para copiar.`
          : err.message
      );
    }
  };

  const renderEditor = () => {
    if (!editor) return null;
    return (
      <div className={styles.panel} data-testid="gastronomia-editor">
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setSearchParams({ tab: 'week' });
              setEditor(null);
              loadWeek();
            }}
          >
            <FiChevronLeft /> Semana
          </button>
          <strong>
            {editor.id ? `Menú #${editor.id}` : 'Nuevo menú'} · {editor.date}
          </strong>
          <StatusBadge status={editor.status} />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.editorLayout}>
          <div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="g-date">Fecha</label>
                <input
                  id="g-date"
                  type="date"
                  value={editor.date}
                  onChange={(e) => updateEditor({ date: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="g-kind">Tipo</label>
                <select
                  id="g-kind"
                  value={editor.kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="CONVENTIONAL">Convencional</option>
                  <option value="BUFFET">Buffet</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="g-status">Estado</label>
                <select
                  id="g-status"
                  value={editor.status}
                  onChange={(e) => updateEditor({ status: e.target.value })}
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="PUBLISHED">Publicado</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="g-notes">Notas internas</label>
                <input
                  id="g-notes"
                  value={editor.notes}
                  onChange={(e) => updateEditor({ notes: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className={styles.toolbar} style={{ marginTop: 12 }}>
              <button type="button" className={styles.btn} onClick={copyFromPreviousWeek}>
                Copiar semana anterior
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() =>
                  setEditor((prev) =>
                    prev
                      ? {
                          ...prev,
                          kind: 'CONVENTIONAL',
                          items: SECTIONS.map((s) => emptyItem(s.id)),
                          dirty: true
                        }
                      : prev
                  )
                }
              >
                Vaciar
              </button>
            </div>

            {editor.kind === 'CONVENTIONAL'
              ? SECTIONS.map((section) => {
                  if (FIXED_SECTIONS.has(section.id)) {
                    return (
                      <div key={section.id} className={styles.sectionBlock}>
                        <p
                          className={styles.mesaEnsaladasTitle}
                          data-testid="gastronomia-ensaladas-fijas"
                        >
                          {MESA_ENSALADAS}
                        </p>
                      </div>
                    );
                  }
                  const allowMulti = MULTI_ITEM_SECTIONS.has(section.id);
                  const rows = editor.items
                    .map((it, idx) => ({ ...it, idx }))
                    .filter((it) => it.section === section.id);
                  return (
                    <div key={section.id} className={styles.sectionBlock}>
                      <h3 className={styles.sectionTitle}>{section.label}</h3>
                      {rows.map((row) => (
                        <ItemRow
                          key={`${section.id}-${row.idx}`}
                          item={row}
                          index={row.idx}
                          buffet={false}
                          allowRemove={allowMulti}
                          suggestFor={suggestFor}
                          suggestions={suggestions}
                          onNameChange={onNameChange}
                          onPick={pickSuggestion}
                          onChange={(patch) => {
                            setEditor((prev) => {
                              const items = prev.items.map((it, i) =>
                                i === row.idx ? { ...it, ...patch } : it
                              );
                              return { ...prev, items, dirty: true };
                            });
                          }}
                          onRemove={() => {
                            if (!allowMulti) {
                              setEditor((prev) => {
                                const items = prev.items.map((it, i) =>
                                  i === row.idx
                                    ? { ...it, name: '', description: '' }
                                    : it
                                );
                                return { ...prev, items, dirty: true };
                              });
                              return;
                            }
                            setEditor((prev) => {
                              const items = prev.items.filter((_, i) => i !== row.idx);
                              if (!items.some((i) => i.section === section.id)) {
                                items.push(emptyItem(section.id));
                              }
                              return { ...prev, items, dirty: true };
                            });
                          }}
                        />
                      ))}
                      {allowMulti ? (
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() =>
                            setEditor((prev) => ({
                              ...prev,
                              items: [...prev.items, emptyItem(section.id)],
                              dirty: true
                            }))
                          }
                        >
                          <FiPlus /> agregar postre
                        </button>
                      ) : null}
                    </div>
                  );
                })
              : (
                <div className={styles.sectionBlock}>
                  <h3 className={styles.sectionTitle}>Preparaciones</h3>
                  {editor.items.map((row, idx) => (
                    <ItemRow
                      key={`buffet-${idx}`}
                      item={row}
                      index={idx}
                      buffet
                      suggestFor={suggestFor}
                      suggestions={suggestions}
                      onNameChange={onNameChange}
                      onPick={pickSuggestion}
                      onMove={(dir) => {
                        setEditor((prev) => {
                          const items = [...prev.items];
                          const j = idx + dir;
                          if (j < 0 || j >= items.length) return prev;
                          const tmp = items[idx];
                          items[idx] = items[j];
                          items[j] = tmp;
                          return {
                            ...prev,
                            items: items.map((it, i) => ({
                              ...it,
                              section: 'BUFFET',
                              sortOrder: i
                            })),
                            dirty: true
                          };
                        });
                      }}
                      onChange={(patch) => {
                        setEditor((prev) => {
                          const items = prev.items.map((it, i) =>
                            i === idx ? { ...it, ...patch } : it
                          );
                          return { ...prev, items, dirty: true };
                        });
                      }}
                      onRemove={() => {
                        setEditor((prev) => {
                          let items = prev.items.filter((_, i) => i !== idx);
                          if (!items.length) items = [emptyItem('BUFFET')];
                          return { ...prev, items, dirty: true };
                        });
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() =>
                      setEditor((prev) => ({
                        ...prev,
                        items: [...prev.items, emptyItem('BUFFET')],
                        dirty: true
                      }))
                    }
                  >
                    <FiPlus /> agregar preparación
                  </button>
                </div>
              )}
          </div>

          <aside className={styles.sideActions}>
            {!editor.id || editor.dirty || saving ? (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveEditor}
                disabled={saving || !editor.date}
                data-testid="gastronomia-save"
              >
                <FiSave /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            ) : null}
            {editor.id ? (
              <>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => openPdf(editor.id, 'preview')}
                >
                  Ver PDF
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => openPdf(editor.id, 'download')}
                >
                  <FiDownload /> Descargar
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => openPdf(editor.id, 'print')}
                >
                  <FiPrinter /> Imprimir
                </button>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page} data-testid="gastronomia-page">
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Comedor</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de comedor">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.sectionButton} ${tab === t.id ? styles.sectionActive : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className={styles.mainContent}>

      {editor ? renderEditor() : null}

      {!editor && tab === 'week' ? (
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setWeekFrom(format(addDays(parseISO(weekFrom), -7), 'yyyy-MM-dd'))}
              aria-label="Semana anterior"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <span className={styles.weekLabel}>
              Semana del {format(parseISO(weekFrom), 'd MMM yyyy', { locale: es })}
            </span>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setWeekFrom(format(addDays(parseISO(weekFrom), 7), 'yyyy-MM-dd'))}
              aria-label="Semana siguiente"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
            {weekFrom !== weekStartIso(today) ? (
              <button type="button" className={styles.btn} onClick={() => setWeekFrom(weekStartIso(today))}>
                Esta semana
              </button>
            ) : null}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.weekGrid} data-testid="gastronomia-week">
            {days.map((day) => {
              const menu = weekByDate.get(day.iso);
              const isToday = day.iso === today;
              const open = () => openEditor(menu ? { id: menu.id, date: day.iso } : { date: day.iso });
              return (
                <div
                  key={day.iso}
                  role="button"
                  tabIndex={0}
                  aria-label={`${menu ? 'Menú' : 'Crear menú'} del ${day.label} ${day.dayNum}`}
                  aria-current={isToday ? 'date' : undefined}
                  className={[
                    styles.dayCard,
                    menu ? '' : styles.dayCardEmpty,
                    day.iso < today ? styles.dayCardPast : '',
                    isToday ? styles.dayCardToday : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      open();
                    }
                  }}
                >
                  <div className={styles.dayHead}>
                    <span className={styles.dayName}>{isToday ? 'Hoy' : day.label}</span>
                    <span className={styles.dayDate}>{day.dayNum}</span>
                    {menu ? <StatusBadge status={menu.status} /> : null}
                  </div>
                  {menu ? (
                    <>
                      <MenuCompleto menu={menu} />
                      <MenuActions
                        menu={menu}
                        onEdit={open}
                        onReuse={() => setReuseMenu(menu)}
                        onError={setError}
                      />
                    </>
                  ) : (
                    <span className={styles.dayEmpty}>
                      <FiPlus aria-hidden="true" /> Sin menú
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <section className={styles.historySection} aria-labelledby="historial-menus">
            <div className={styles.toolbar}>
              <h3 id="historial-menus" className={styles.historyTitle}>
                Historial
              </h3>
              <div className={styles.field}>
                <label htmlFor="h-from">Desde</label>
                <input id="h-from" type="date" value={historyFrom} onChange={(e) => e.target.value && setHistoryFrom(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="h-to">Hasta</label>
                <input id="h-to" type="date" value={historyTo} onChange={(e) => e.target.value && setHistoryTo(e.target.value)} />
              </div>
            </div>
            {historyRows.length ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Menú</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => openEditor({ id: row.id, date: row.date })}
                        >
                          {format(parseISO(row.date), 'EEE d/M/yyyy', { locale: es })}
                        </button>
                      </td>
                      <td>{row.kind === 'BUFFET' ? 'Buffet' : 'Convencional'}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>{row.preview || '—'}</td>
                      <td>
                        <MenuActions
                          menu={row}
                          onEdit={() => openEditor({ id: row.id, date: row.date })}
                          onReuse={() => setReuseMenu(row)}
                          onError={setError}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : !loading ? (
              <p className={styles.empty}>Sin menús en el rango.</p>
            ) : null}
          </section>
        </div>
      ) : null}

      {!editor && (tab === 'desayuno' || tab === 'cena') ? (
        <ComensalesTab key={tab} tipo={tab === 'cena' ? 'CENA' : 'DESAYUNO'} />
      ) : null}

      {reuseMenu ? (
        <ReutilizarMenuModal
          menu={reuseMenu}
          onClose={() => setReuseMenu(null)}
          onDone={(created) => {
            setReuseMenu(null);
            openEditor({ id: created.id, date: created.date });
          }}
        />
      ) : null}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  index,
  buffet,
  allowRemove = true,
  suggestFor,
  suggestions,
  onNameChange,
  onPick,
  onChange,
  onRemove,
  onMove
}) {
  return (
    <div
      className={`${styles.itemRow} ${buffet ? styles.itemRowBuffet : ''}`}
    >
      {buffet ? (
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <button type="button" className={styles.iconBtn} onClick={() => onMove?.(-1)} aria-label="Subir">
            ↑
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onMove?.(1)} aria-label="Bajar">
            ↓
          </button>
        </span>
      ) : (
        <span />
      )}
      <div style={{ position: 'relative' }}>
        <input
          value={item.name}
          onChange={(e) => onNameChange(index, e.target.value)}
          placeholder="Nombre del plato"
          aria-label="Nombre del plato"
        />
        {suggestFor === index && suggestions.length > 0 ? (
          <div className={styles.suggestBox} role="listbox">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.suggestItem}
                onClick={() => onPick(index, s)}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <input
        value={item.description || ''}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Descripción opcional"
        aria-label="Descripción"
      />
      {allowRemove ? (
        <button type="button" className={styles.iconBtn} onClick={onRemove} aria-label="Quitar">
          <FiX />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
