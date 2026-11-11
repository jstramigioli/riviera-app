import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FiMinus, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import {
  fetchOccupiedRoomsToday,
  fetchMenuItems,
  createConsumptionOrder
} from '../services/api';
import styles from '../styles/ConsumptionOrderModal.module.css';

const CATEGORY_ORDER = ['BEBIDAS', 'MINUTAS', 'CAFETERIA'];
const CATEGORY_LABELS = {
  BEBIDAS: 'Bebidas',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería'
};

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
  return `${row.reservationId}:${row.roomId}`;
}

function reservationOptionLabel(row) {
  if (row.label) return row.label;
  const room = row.roomName || 'Hab.';
  const apellido = row.clientLastName || (row.clientName || '').split(/\s+/).pop() || 'Sin apellido';
  return `${room} - ${apellido}`;
}

function newLine() {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    menuItemId: null,
    name: '',
    category: null,
    price: 0,
    quantity: 1,
    query: '',
    dropdownOpen: false,
    highlight: 0
  };
}

function filterMenuItems(menuItems, query) {
  const q = query.trim().toLowerCase();
  let list = menuItems.filter((i) => i.isActive !== false);
  if (q) {
    list = list.filter((i) => {
      const hay = `${i.name} ${CATEGORY_LABELS[i.category] || i.category}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return [...list].sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return (a.ordenIndex || 0) - (b.ordenIndex || 0) || a.name.localeCompare(b.name, 'es');
  });
}

/**
 * Modal POS de comanda: fecha → reservas ocupadas ese día → filas de ítems.
 */
export default function ConsumptionOrderModal({ open, onClose, onSaved }) {
  const titleId = useId();
  const dateRef = useRef(null);
  const reservationRef = useRef(null);
  const itemInputRefs = useRef({});
  const dropdownListRefs = useRef({});

  const [fecha, setFecha] = useState(todayLocalIso);
  const [reservations, setReservations] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectionKey, setSelectionKey] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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

  const resetOrder = useCallback(() => {
    setSelectionKey('');
    setLines([newLine()]);
    setError(null);
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const itemsRes = await fetchMenuItems({ active: true });
      setMenuItems(itemsRes.data || itemsRes || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el menú');
    }
  }, []);

  const loadReservations = useCallback(async (dateCivil) => {
    setLoadingReservations(true);
    setError(null);
    try {
      const roomsRes = await fetchOccupiedRoomsToday(dateCivil);
      const list = roomsRes.data || roomsRes || [];
      setReservations(list);
      setSelectionKey((prev) => {
        if (!prev) return '';
        return list.some((r) => reservationOptionKey(r) === prev) ? prev : '';
      });
    } catch (err) {
      setReservations([]);
      setSelectionKey('');
      setError(err.message || 'No se pudo cargar las reservas');
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const today = todayLocalIso();
    setFecha(today);
    resetOrder();
    setSuccessMsg(null);
    setLoadingMeta(true);
    Promise.all([loadMenu(), loadReservations(today)]).finally(() => {
      setLoadingMeta(false);
    });
    const t = window.setTimeout(() => dateRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, loadMenu, loadReservations, resetOrder]);

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
    setSuccessMsg(null);
    setSelectionKey('');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      loadReservations(value);
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

  const addRow = () => {
    const row = newLine();
    setLines((prev) => [...prev, row]);
    window.setTimeout(() => itemInputRefs.current[row.key]?.focus(), 30);
  };

  const selectItem = (lineKey, item) => {
    if (!item) return;
    let focusKey = null;
    setLines((prev) => {
      const updated = prev.map((l) =>
        l.key === lineKey
          ? {
              ...l,
              menuItemId: item.id,
              name: item.name,
              category: item.category,
              price: Number(item.price),
              query: item.name,
              dropdownOpen: false,
              highlight: 0
            }
          : l
      );
      const idx = updated.findIndex((l) => l.key === lineKey);
      const hasEmptyAfter = updated
        .slice(idx + 1)
        .some((l) => !l.menuItemId && !String(l.query || '').trim());
      if (hasEmptyAfter) {
        const nextEmpty = updated.slice(idx + 1).find((l) => !l.menuItemId);
        focusKey = nextEmpty?.key || null;
        return updated;
      }
      if (idx === updated.length - 1) {
        const row = newLine();
        focusKey = row.key;
        return [...updated, row];
      }
      return updated;
    });
    window.setTimeout(() => {
      if (focusKey) itemInputRefs.current[focusKey]?.focus();
    }, 30);
  };

  const onItemKeyDown = (e, line) => {
    const options = filterMenuItems(menuItems, line.query);

    if (!line.dropdownOpen && (e.key === 'ArrowDown' || e.key === 'Enter') && options.length) {
      closeOtherDropdowns(line.key);
      updateLine(line.key, { dropdownOpen: true });
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      closeOtherDropdowns(line.key);
      updateLine(line.key, {
        dropdownOpen: true,
        highlight: Math.min(options.length - 1, (line.highlight || 0) + 1)
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateLine(line.key, { highlight: Math.max(0, (line.highlight || 0) - 1) });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (options[line.highlight]) {
        selectItem(line.key, options[line.highlight]);
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

  const submit = async ({ continueAfter }) => {
    setError(null);
    setSuccessMsg(null);

    if (!selectedReservation?.reservationId) {
      setError('Seleccioná una reserva');
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

    setSubmitting(true);
    try {
      // Agrupar filas del mismo ítem por si el usuario repitió
      const merged = new Map();
      for (const line of filledLines) {
        const prev = merged.get(line.menuItemId);
        if (prev) {
          prev.quantity = Math.min(999, prev.quantity + Number(line.quantity));
        } else {
          merged.set(line.menuItemId, {
            menuItemId: line.menuItemId,
            quantity: Number(line.quantity)
          });
        }
      }

      const result = await createConsumptionOrder({
        reservationId: selectedReservation.reservationId,
        fecha,
        items: [...merged.values()]
      });

      const label = reservationOptionLabel(selectedReservation);
      setSuccessMsg(
        `Comanda cargada en ${label} — ${formatMoney(result?.data?.total ?? total)}`
      );
      onSaved?.(result);

      if (continueAfter) {
        resetOrder();
        window.setTimeout(() => reservationRef.current?.focus(), 40);
      } else {
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

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>Nuevo consumo</h2>
            <p className={styles.subtitle}>Comanda por reserva — filas de ítems del menú</p>
          </div>
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

        <div className={styles.stickyTop}>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {successMsg ? <div className={styles.success} role="status">{successMsg}</div> : null}

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
                setSuccessMsg(null);
                let focusKey = null;
                setLines((prev) => {
                  if (prev.length) {
                    focusKey = prev[0].key;
                    return prev;
                  }
                  const row = newLine();
                  focusKey = row.key;
                  return [row];
                });
                if (value) {
                  window.setTimeout(() => {
                    if (focusKey) itemInputRefs.current[focusKey]?.focus();
                  }, 20);
                }
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
        </div>

        <div className={styles.itemsZone}>
          <div className={styles.linesHeader}>
            <span className={styles.colQty}>Cant.</span>
            <span className={styles.colItem}>Ítem</span>
            <span className={styles.colPrice}>Precio</span>
            <span className={styles.colRemove} aria-hidden="true" />
          </div>

          <ul className={styles.lines}>
            {lines.map((line) => {
              const options = filterMenuItems(menuItems, line.query);
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

                  <div className={styles.itemCell}>
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
                        closeOtherDropdowns(line.key);
                        updateLine(line.key, {
                          query: value,
                          dropdownOpen: true,
                          highlight: 0,
                          // Si edita el texto, invalidar selección previa
                          menuItemId: null,
                          name: '',
                          category: null,
                          price: 0
                        });
                      }}
                      onFocus={() => {
                        if (!itemsEnabled) return;
                        closeOtherDropdowns(line.key);
                        updateLine(line.key, { dropdownOpen: true });
                      }}
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
                          options.map((item, idx) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                role="option"
                                data-idx={idx}
                                aria-selected={idx === line.highlight}
                                className={`${styles.dropdownItem} ${idx === line.highlight ? styles.dropdownItemActive : ''}`}
                                onMouseEnter={() => updateLine(line.key, { highlight: idx })}
                                onClick={() => selectItem(line.key, item)}
                              >
                                <span className={styles.itemCat}>
                                  {CATEGORY_LABELS[item.category] || item.category}
                                </span>
                                <span className={styles.itemName}>{item.name}</span>
                                <span className={styles.itemPrice}>{formatMoney(item.price)}</span>
                              </button>
                            </li>
                          ))
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
          </ul>

          <button
            type="button"
            className={styles.addRowBtn}
            disabled={!itemsEnabled}
            onClick={addRow}
          >
            <FiPlus aria-hidden="true" />
            Agregar fila
          </button>
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
  );
}
