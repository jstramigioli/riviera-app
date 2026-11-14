import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiMinus, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import {
  fetchOccupiedRoomsToday,
  fetchCuentasParaPago,
  fetchMenuItems,
  fetchMenuCategories,
  createConsumptionOrder,
  deleteCargo
} from '../services/api';
import styles from '../styles/ConsumptionOrderModal.module.css';

const FALLBACK_CATEGORY_ORDER = ['BEBIDAS', 'MINUTAS', 'CAFETERIA'];
const FALLBACK_CATEGORY_LABELS = {
  BEBIDAS: 'Bebidas',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería'
};

const TOAST_MS = 5000;

function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function todayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function reservationOptionKey(row) {
  if (row.accountKind === 'EXTERNAL' || row.origen === 'EXTERNA') {
    return `ext:${row.accountId}`;
  }
  return `${row.reservationId}:${row.roomId}`;
}

function reservationOptionLabel(row) {
  if (row.accountKind === 'EXTERNAL' || row.origen === 'EXTERNA') {
    return `Externa · ${row.label || `Cuenta #${row.accountId}`}`;
  }
  if (row.label) return row.label;
  const room = row.roomName || 'Hab.';
  const apellido = row.clientLastName || (row.clientName || '').split(/\s+/).pop() || 'Sin apellido';
  return `${room} - ${apellido}`;
}

function newLine() {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    menuItemId: null,
    varietyId: null,
    varietyName: null,
    name: '',
    category: null,
    price: 0,
    quantity: 1,
    query: '',
    dropdownOpen: false,
    highlight: 0
  };
}

function subgroupKey(value) {
  const s = String(value || '').trim();
  return s || '';
}

function subgroupSortValue(value) {
  const s = subgroupKey(value);
  // Sin subgrupo al final del grupo de categoría
  return s || '\uffff';
}

/** Expande ítems con variedades a opciones elegibles (Chica/Grande, etc.). */
function expandMenuOptions(menuItems) {
  const out = [];
  for (const item of menuItems) {
    if (item.isActive === false) continue;
    const varieties = Array.isArray(item.varieties) ? item.varieties : [];
    const subgroup = subgroupKey(item.subgroup);
    if (varieties.length === 0) {
      out.push({
        optionKey: `item-${item.id}`,
        menuItemId: item.id,
        varietyId: null,
        varietyName: null,
        name: item.name,
        displayName: item.name,
        category: item.category,
        subgroup,
        price: Number(item.price),
        ordenIndex: item.ordenIndex || 0
      });
      continue;
    }
    for (const variety of varieties) {
      out.push({
        optionKey: `item-${item.id}-var-${variety.id}`,
        menuItemId: item.id,
        varietyId: variety.id,
        varietyName: variety.name,
        name: item.name,
        displayName: `${item.name} — ${variety.name}`,
        category: item.category,
        subgroup,
        price: Number(variety.price),
        ordenIndex: item.ordenIndex || 0
      });
    }
  }
  return out;
}

function cloneLine(line) {
  return {
    ...line,
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dropdownOpen: false,
    highlight: 0
  };
}

function filterMenuItems(menuItems, query, categoryMeta = {}) {
  const labels = categoryMeta.labels || FALLBACK_CATEGORY_LABELS;
  const order = categoryMeta.order || FALLBACK_CATEGORY_ORDER;
  const q = query.trim().toLowerCase();
  let list = expandMenuOptions(menuItems);
  if (q) {
    list = list.filter((i) => {
      const hay = `${i.displayName} ${i.name} ${i.varietyName || ''} ${i.subgroup || ''} ${labels[i.category] || i.category}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return [...list].sort((a, b) => {
    const ca = order.indexOf(a.category);
    const cb = order.indexOf(b.category);
    const ia = ca === -1 ? 999 : ca;
    const ib = cb === -1 ? 999 : cb;
    if (ia !== ib) return ia - ib;
    const bySub = subgroupSortValue(a.subgroup).localeCompare(subgroupSortValue(b.subgroup), 'es');
    if (bySub !== 0) return bySub;
    const byOrden = (a.ordenIndex || 0) - (b.ordenIndex || 0);
    if (byOrden !== 0) return byOrden;
    const byName = a.name.localeCompare(b.name, 'es');
    if (byName !== 0) return byName;
    return String(a.varietyName || '').localeCompare(String(b.varietyName || ''), 'es');
  });
}

function optionGroupLabel(item, labels = FALLBACK_CATEGORY_LABELS) {
  const cat = labels[item.category] || item.category || '';
  if (item.subgroup) return `${cat} · ${item.subgroup}`;
  return cat;
}

function resolvePresetKey(list, preset) {
  if (!preset?.reservationId || !Array.isArray(list) || list.length === 0) return '';
  const reservationId = Number(preset.reservationId);
  if (preset.roomId != null) {
    const exact = list.find(
      (r) =>
        Number(r.reservationId) === reservationId && Number(r.roomId) === Number(preset.roomId)
    );
    if (exact) return reservationOptionKey(exact);
  }
  const first = list.find((r) => Number(r.reservationId) === reservationId);
  return first ? reservationOptionKey(first) : '';
}

/**
 * Modal POS de comanda: fecha → reservas ocupadas ese día → filas de ítems.
 * preset opcional: { reservationId, roomId?, fecha? } para abrir desde el panel.
 */
export default function ConsumptionOrderModal({ open, onClose, onSaved, preset = null }) {
  const titleId = useId();
  const dateRef = useRef(null);
  const reservationRef = useRef(null);
  const itemInputRefs = useRef({});
  const itemCellRefs = useRef({});
  const dropdownListRefs = useRef({});
  const toastTimerRef = useRef(null);
  const pendingUndoRef = useRef(null);
  const presetRef = useRef(preset);

  const [fecha, setFecha] = useState(todayLocalIso);
  const [reservations, setReservations] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categoryMeta, setCategoryMeta] = useState({
    order: FALLBACK_CATEGORY_ORDER,
    labels: FALLBACK_CATEGORY_LABELS
  });
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectionKey, setSelectionKey] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  const selectedReservation = useMemo(
    () => reservations.find((r) => reservationOptionKey(r) === selectionKey) || null,
    [reservations, selectionKey]
  );

  const filledLines = useMemo(
    () => lines.filter((l) => l.menuItemId),
    [lines]
  );

  const total = useMemo(
    () => filledLines.reduce((sum, line) => sum + Number(line.price) * Number(line.quantity), 0),
    [filledLines]
  );

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearToastTimer();
    pendingUndoRef.current = null;
    setToast(null);
  }, [clearToastTimer]);

  const resetOrder = useCallback(() => {
    setSelectionKey('');
    setLines([newLine()]);
    setError(null);
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        fetchMenuItems({ active: true }),
        fetchMenuCategories().catch(() => null)
      ]);
      setMenuItems(itemsRes.data || itemsRes || []);
      const cats = catsRes?.data || [];
      if (cats.length) {
        setCategoryMeta({
          order: cats.map((c) => c.code),
          labels: Object.fromEntries(cats.map((c) => [c.code, c.label]))
        });
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el menú');
    }
  }, []);

  const loadReservations = useCallback(async (dateCivil, { preferPreset = false } = {}) => {
    setLoadingReservations(true);
    setError(null);
    try {
      const [roomsRes, cuentasRes] = await Promise.all([
        fetchOccupiedRoomsToday(dateCivil),
        fetchCuentasParaPago().catch(() => ({ data: [] }))
      ]);
      const occupied = roomsRes.data || roomsRes || [];
      const cuentas = cuentasRes.data || cuentasRes || [];
      const externas = (Array.isArray(cuentas) ? cuentas : [])
        .filter((c) => c.accountKind === 'EXTERNAL' || c.origen === 'EXTERNA')
        .map((c) => ({
          ...c,
          reservationId: null,
          roomId: `ext-${c.accountId}`,
          accountId: c.accountId,
          accountKind: 'EXTERNAL',
          origen: 'EXTERNA',
          label: c.label
        }));
      const list = [...occupied, ...externas];
      setReservations(list);
      setSelectionKey((prev) => {
        if (preferPreset) {
          const fromPreset = resolvePresetKey(list, presetRef.current);
          if (fromPreset) return fromPreset;
        }
        if (!prev) return '';
        return list.some((r) => reservationOptionKey(r) === prev) ? prev : '';
      });
      return list;
    } catch (err) {
      setReservations([]);
      setSelectionKey('');
      setError(err.message || 'No se pudo cargar las reservas');
      return [];
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const initialFecha =
      preset?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(preset.fecha)
        ? preset.fecha
        : todayLocalIso();
    setFecha(initialFecha);
    resetOrder();
    dismissToast();
    setLoadingMeta(true);
    Promise.all([loadMenu(), loadReservations(initialFecha, { preferPreset: true })]).finally(
      () => {
        setLoadingMeta(false);
      }
    );
    const hasPreset = Boolean(preset?.reservationId);
    const t = window.setTimeout(() => {
      if (hasPreset) {
        const firstKey = Object.keys(itemInputRefs.current)[0];
        const firstInput = firstKey ? itemInputRefs.current[firstKey] : null;
        (firstInput || reservationRef.current)?.focus();
      } else {
        dateRef.current?.focus();
      }
    }, 40);
    return () => window.clearTimeout(t);
    // Solo al abrir: no re-disparar si cambia la referencia de preset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadMenu, loadReservations, resetOrder, dismissToast]);

  useEffect(() => () => clearToastTimer(), [clearToastTimer]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const openDropdown = lines.some((l) => l.dropdownOpen);
        if (openDropdown) {
          e.preventDefault();
          setLines((prev) =>
            prev.map((l) => (l.dropdownOpen ? { ...l, dropdownOpen: false } : l))
          );
          return;
        }
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, lines]);

  const onFechaChange = (value) => {
    setFecha(value);
    setSelectionKey('');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      loadReservations(value, { preferPreset: false });
    }
  };

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const closeOtherDropdowns = (exceptKey) => {
    setLines((prev) =>
      prev.map((l) =>
        l.key === exceptKey || !l.dropdownOpen ? l : { ...l, dropdownOpen: false }
      )
    );
  };

  const openDropdown = (lineKey, enabled) => {
    if (!enabled) return;
    closeOtherDropdowns(lineKey);
    updateLine(lineKey, { dropdownOpen: true, highlight: 0 });
  };

  const setQuantity = (key, value) => {
    const qty = Math.max(1, Math.min(999, Number(value) || 1));
    updateLine(key, { quantity: qty });
  };

  const bumpQuantity = (key, delta) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = Math.max(1, Math.min(999, (Number(l.quantity) || 1) + delta));
        return { ...l, quantity: next };
      })
    );
  };

  const removeLine = (key) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length === 0 ? [newLine()] : next;
    });
  };

  const focusItemInput = (rowKey) => {
    window.setTimeout(() => itemInputRefs.current[rowKey]?.focus(), 30);
  };

  const addRow = () => {
    const row = newLine();
    setLines((prev) => [...prev, row]);
    focusItemInput(row.key);
  };

  /**
   * Asegura fila en blanco después de `lineKey` y enfoca su campo ítem.
   * Si `selectedItem` viene, aplica la selección en el mismo setState (Enter).
   */
  const applySelection = (line, selectedItem) => ({
    ...line,
    menuItemId: selectedItem.menuItemId ?? selectedItem.id,
    varietyId: selectedItem.varietyId ?? null,
    varietyName: selectedItem.varietyName ?? null,
    name: selectedItem.name,
    category: selectedItem.category,
    price: Number(selectedItem.price),
    query: selectedItem.displayName || selectedItem.name,
    dropdownOpen: false,
    highlight: 0
  });

  const advanceAfterItem = (lineKey, selectedItem = null) => {
    const blank = newLine();
    let focusKey = blank.key;

    setLines((prev) => {
      const withSelection = selectedItem
        ? prev.map((l) =>
            l.key === lineKey
              ? applySelection(l, selectedItem)
              : l.dropdownOpen
                ? { ...l, dropdownOpen: false, highlight: 0 }
                : l
          )
        : prev.map((l) =>
            l.dropdownOpen ? { ...l, dropdownOpen: false, highlight: 0 } : l
          );

      const idx = withSelection.findIndex((l) => l.key === lineKey);
      if (idx >= 0) {
        const emptyAfter = withSelection
          .slice(idx + 1)
          .find((l) => !l.menuItemId);
        if (emptyAfter) {
          focusKey = emptyAfter.key;
          return withSelection;
        }
      }

      focusKey = blank.key;
      return [...withSelection, blank];
    });

    focusItemInput(focusKey);
  };

  const selectItem = (lineKey, item, { advance = false } = {}) => {
    if (!item) return;
    if (advance) {
      advanceAfterItem(lineKey, item);
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.key === lineKey ? applySelection(l, item) : l))
    );
  };

  const onItemKeyDown = (e, line) => {
    const options = filterMenuItems(menuItems, line.query, categoryMeta);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!line.dropdownOpen) return;
      updateLine(line.key, {
        highlight: Math.min(options.length - 1, (line.highlight || 0) + 1)
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!line.dropdownOpen) return;
      updateLine(line.key, { highlight: Math.max(0, (line.highlight || 0) - 1) });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (line.dropdownOpen && options[line.highlight]) {
        selectItem(line.key, options[line.highlight], { advance: true });
        return;
      }
      // Ítem ya elegido: seguir a la fila siguiente (no crear consumo vacío)
      if (line.menuItemId) {
        advanceAfterItem(line.key);
      }
      return;
    }
    if (e.key === 'Escape' && line.dropdownOpen) {
      e.preventDefault();
      e.stopPropagation();
      updateLine(line.key, { dropdownOpen: false });
    }
  };

  useEffect(() => {
    const openLine = lines.find((l) => l.dropdownOpen);
    if (!openLine) return;
    const listEl = dropdownListRefs.current[openLine.key];
    const el = listEl?.querySelector(`[data-idx="${openLine.highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [lines]);

  // Clic afuera: cierra el menú y deja la fila sin ítem (cancelar apertura accidental)
  useEffect(() => {
    if (!open) return undefined;
    const openLine = lines.find((l) => l.dropdownOpen);
    if (!openLine) return undefined;

    const onPointerDown = (e) => {
      const cell = itemCellRefs.current[openLine.key];
      if (cell?.contains(e.target)) return;
      setLines((prev) =>
        prev.map((l) =>
          l.key === openLine.key
            ? {
                ...l,
                menuItemId: null,
                varietyId: null,
                varietyName: null,
                name: '',
                category: null,
                price: 0,
                query: '',
                dropdownOpen: false,
                highlight: 0
              }
            : l.dropdownOpen
              ? { ...l, dropdownOpen: false, highlight: 0 }
              : l
        )
      );
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, lines]);

  const showUndoToast = ({ message, cargoIds, snapshot }) => {
    clearToastTimer();
    pendingUndoRef.current = { cargoIds, snapshot };
    setToast({ message });
    toastTimerRef.current = window.setTimeout(() => {
      pendingUndoRef.current = null;
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_MS);
  };

  const undoLastOrder = async () => {
    const pending = pendingUndoRef.current;
    if (!pending) {
      dismissToast();
      return;
    }

    clearToastTimer();
    pendingUndoRef.current = null;
    setToast(null);
    setError(null);

    try {
      const ids = Array.isArray(pending.cargoIds) ? pending.cargoIds : [];
      for (const id of ids) {
        if (id != null) await deleteCargo(id);
      }
    } catch (err) {
      setError(err.message || 'No se pudo deshacer la comanda');
    }

    const snap = pending.snapshot;
    if (snap) {
      const restored = snap.lines?.length
        ? snap.lines.map((l) => cloneLine(l))
        : [newLine()];
      setFecha(snap.fecha);
      setSelectionKey(snap.selectionKey);
      setLines(restored);
      focusItemInput(restored[0]?.key);
    }
  };

  const submit = async ({ continueAfter }) => {
    setError(null);

    const isExternal =
      selectedReservation?.accountKind === 'EXTERNAL' ||
      selectedReservation?.origen === 'EXTERNA';
    if (!isExternal && !selectedReservation?.reservationId) {
      setError('Seleccioná una reserva o cuenta externa');
      reservationRef.current?.focus();
      return;
    }
    if (isExternal && !selectedReservation?.accountId) {
      setError('Seleccioná una cuenta externa');
      reservationRef.current?.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError('Fecha inválida');
      dateRef.current?.focus();
      return;
    }
    if (filledLines.length === 0) {
      setError('Agregá al menos un ítem a la comanda');
      const first = lines[0];
      if (first) itemInputRefs.current[first.key]?.focus();
      return;
    }

    const snapshot = {
      fecha,
      selectionKey,
      lines: filledLines.map((l) => ({ ...l, dropdownOpen: false, highlight: 0 }))
    };

    setSubmitting(true);
    try {
      // Agrupar filas del mismo ítem+variedad por si el usuario repitió
      const merged = new Map();
      for (const line of filledLines) {
        const mergeKey = `${line.menuItemId}:${line.varietyId ?? ''}`;
        const prev = merged.get(mergeKey);
        if (prev) {
          prev.quantity = Math.min(999, prev.quantity + Number(line.quantity));
        } else {
          merged.set(mergeKey, {
            menuItemId: line.menuItemId,
            varietyId: line.varietyId ?? null,
            quantity: Number(line.quantity)
          });
        }
      }

      const result = await createConsumptionOrder({
        ...(isExternal
          ? { accountId: selectedReservation.accountId }
          : { reservationId: selectedReservation.reservationId }),
        fecha,
        items: [...merged.values()]
      });

      const label = reservationOptionLabel(selectedReservation);
      const message = `Comanda cargada en ${label} — ${formatMoney(result?.data?.total ?? total)}`;
      const cargoIds = (result?.data?.cargos || [])
        .map((c) => c.id)
        .filter((id) => id != null);

      onSaved?.(result);

      if (continueAfter) {
        showUndoToast({ message, cargoIds, snapshot });
        resetOrder();
        window.setTimeout(() => reservationRef.current?.focus(), 40);
      } else {
        dismissToast();
        onClose?.();
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar la comanda');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const busy = loadingMeta || loadingReservations || submitting;
  const itemsEnabled = Boolean(selectedReservation) && !submitting;

  const toastNode =
    toast &&
    createPortal(
      <div className={styles.toast} role="status" aria-live="polite">
        <p className={styles.toastText}>{toast.message}</p>
        <button
          type="button"
          className={styles.toastUndo}
          onClick={undoLastOrder}
        >
          Deshacer
        </button>
        <button
          type="button"
          className={styles.toastClose}
          onClick={dismissToast}
          aria-label="Cerrar aviso"
          title="Cerrar"
        >
          <FiX />
        </button>
      </div>,
      document.body
    );

  return (
    <>
      <div className={styles.overlay} role="presentation">
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>Nuevo consumo</h2>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
            >
              <FiX />
            </button>
          </header>

          {error ? (
            <div className={styles.alerts}>
              <div className={styles.error} role="alert">{error}</div>
            </div>
          ) : null}

          <div className={styles.body}>
            <aside className={styles.metaColumn}>
              <div className={styles.row}>
                <label className={styles.label} htmlFor="consumo-fecha">
                  Fecha
                </label>
                <input
                  id="consumo-fecha"
                  ref={dateRef}
                  className={styles.dateInput}
                  type="date"
                  value={fecha}
                  disabled={submitting}
                  onChange={(e) => onFechaChange(e.target.value)}
                />
              </div>

              <div className={styles.row}>
                <label className={styles.label} htmlFor="consumo-reserva">
                  Reserva
                </label>
                <select
                  id="consumo-reserva"
                  ref={reservationRef}
                  className={styles.select}
                  value={selectionKey}
                  disabled={busy}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectionKey(value);
                    setLines((prev) => (prev.length ? prev : [newLine()]));
                  }}
                >
                  <option value="">
                    {loadingReservations
                      ? 'Cargando reservas…'
                      : reservations.length === 0
                        ? 'Sin reservas ocupadas ese día'
                        : 'Seleccionar reserva…'}
                  </option>
                  {reservations.map((r) => (
                    <option key={reservationOptionKey(r)} value={reservationOptionKey(r)}>
                      {reservationOptionLabel(r)}
                      {r.status && r.status !== 'INGRESADA' ? ` (${r.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </aside>

            <div className={styles.itemsZone}>
              <div className={styles.linesHeader}>
                <span className={styles.colQty}>Cant.</span>
                <span className={styles.colItem}>Ítem</span>
                <span className={styles.colPrice}>Precio</span>
                <span className={styles.colRemove} aria-hidden="true" />
              </div>

              <ul className={styles.lines}>
                {lines.map((line) => {
                  const options = filterMenuItems(menuItems, line.query, categoryMeta);
                  return (
                    <li key={line.key} className={styles.line}>
                      <div className={styles.qtyGroup}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          disabled={!itemsEnabled}
                          onClick={() => bumpQuantity(line.key, -1)}
                          aria-label="Restar cantidad"
                          title="Restar"
                        >
                          <FiMinus />
                        </button>
                        <label className={styles.srOnly} htmlFor={`qty-${line.key}`}>
                          Cantidad {line.name || 'ítem'}
                        </label>
                        <input
                          id={`qty-${line.key}`}
                          className={styles.qty}
                          type="number"
                          min={1}
                          max={999}
                          value={line.quantity}
                          disabled={!itemsEnabled}
                          onChange={(e) => setQuantity(line.key, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          disabled={!itemsEnabled}
                          onClick={() => bumpQuantity(line.key, 1)}
                          aria-label="Sumar cantidad"
                          title="Sumar"
                        >
                          <FiPlus />
                        </button>
                      </div>

                      <div
                        className={styles.itemCell}
                        ref={(el) => {
                          itemCellRefs.current[line.key] = el;
                        }}
                      >
                        <input
                          ref={(el) => {
                            itemInputRefs.current[line.key] = el;
                          }}
                          className={styles.itemInput}
                          type="text"
                          autoComplete="off"
                          placeholder={
                            selectedReservation
                              ? 'Buscar ítem del menú…'
                              : 'Seleccioná una reserva primero'
                          }
                          value={line.query}
                          disabled={!itemsEnabled}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateLine(line.key, {
                              query: value,
                              highlight: 0,
                              // Si edita el texto, invalidar selección previa
                              menuItemId: null,
                              varietyId: null,
                              varietyName: null,
                              name: '',
                              category: null,
                              price: 0
                            });
                          }}
                          onClick={() => openDropdown(line.key, itemsEnabled)}
                          onKeyDown={(e) => onItemKeyDown(e, line)}
                          aria-autocomplete="list"
                          aria-expanded={line.dropdownOpen}
                        />
                        {line.dropdownOpen && itemsEnabled ? (
                          <ul
                            className={styles.dropdown}
                            role="listbox"
                            ref={(el) => {
                              dropdownListRefs.current[line.key] = el;
                            }}
                          >
                            {options.length === 0 ? (
                              <li className={styles.dropdownEmpty}>Sin resultados</li>
                            ) : (
                              options.map((item, idx) => {
                                const prev = idx > 0 ? options[idx - 1] : null;
                                const showGroup =
                                  !prev ||
                                  prev.category !== item.category ||
                                  subgroupKey(prev.subgroup) !== subgroupKey(item.subgroup);
                                return (
                                  <li key={item.optionKey} className={styles.dropdownOptionWrap}>
                                    {showGroup ? (
                                      <div className={styles.dropdownGroup} aria-hidden="true">
                                        {optionGroupLabel(item, categoryMeta.labels)}
                                      </div>
                                    ) : null}
                                    <button
                                      type="button"
                                      role="option"
                                      data-idx={idx}
                                      aria-selected={idx === line.highlight}
                                      className={`${styles.dropdownItem} ${idx === line.highlight ? styles.dropdownItemActive : ''}`}
                                      onMouseEnter={() => updateLine(line.key, { highlight: idx })}
                                      onClick={() => selectItem(line.key, item)}
                                    >
                                      <span className={styles.itemName}>{item.displayName}</span>
                                      <span className={styles.itemPrice}>{formatMoney(item.price)}</span>
                                    </button>
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        ) : null}
                      </div>

                      <div className={styles.priceCell}>
                        {line.menuItemId ? formatMoney(line.price * line.quantity) : '—'}
                      </div>

                      <button
                        type="button"
                        className={styles.iconBtn}
                        disabled={!itemsEnabled || (lines.length === 1 && !line.menuItemId)}
                        onClick={() => removeLine(line.key)}
                        aria-label={line.name ? `Quitar ${line.name}` : 'Quitar fila'}
                        title="Quitar"
                      >
                        <FiTrash2 />
                      </button>
                    </li>
                  );
                })}
                <li className={styles.addRow}>
                  <button
                    type="button"
                    className={styles.addRowBtn}
                    disabled={!itemsEnabled}
                    onClick={addRow}
                    aria-label="Agregar fila"
                    title="Agregar fila"
                  >
                    <FiPlus aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <footer className={styles.footer}>
            <div className={styles.total}>
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={submitting || filledLines.length === 0 || !selectedReservation}
                onClick={() => submit({ continueAfter: true })}
                title="Guardar y cargar otra reserva"
              >
                <FiPlus aria-hidden="true" />
                Guardar y otra
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={submitting || filledLines.length === 0 || !selectedReservation}
                onClick={() => submit({ continueAfter: false })}
              >
                {submitting ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </footer>
        </div>
      </div>
      {toastNode}
    </>
  );
}
