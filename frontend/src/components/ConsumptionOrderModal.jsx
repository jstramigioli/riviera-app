import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
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

function lineKey(itemId) {
  return `item-${itemId}`;
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

/**
 * Modal POS de comanda: fecha → reservas ocupadas ese día → ítems.
 */
export default function ConsumptionOrderModal({ open, onClose, onSaved }) {
  const titleId = useId();
  const dateRef = useRef(null);
  const reservationRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const [fecha, setFecha] = useState(todayLocalIso);
  const [reservations, setReservations] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectionKey, setSelectionKey] = useState('');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const selectedReservation = useMemo(
    () => reservations.find((r) => reservationOptionKey(r) === selectionKey) || null,
    [reservations, selectionKey]
  );

  const filteredItems = useMemo(() => {
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
  }, [menuItems, query]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.price) * Number(line.quantity), 0),
    [lines]
  );

  const resetOrder = useCallback(() => {
    setSelectionKey('');
    setQuery('');
    setHighlight(0);
    setDropdownOpen(false);
    setLines([]);
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
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    setHighlight(0);
  }, [query, filteredItems.length]);

  const onFechaChange = (value) => {
    setFecha(value);
    setSuccessMsg(null);
    setSelectionKey('');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      loadReservations(value);
    }
  };

  const addItem = (item) => {
    if (!item) return;
    setLines((prev) => {
      const key = lineKey(item.id);
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: Math.min(999, l.quantity + 1) } : l
        );
      }
      return [
        ...prev,
        {
          key,
          menuItemId: item.id,
          name: item.name,
          category: item.category,
          price: Number(item.price),
          quantity: 1
        }
      ];
    });
    setQuery('');
    setDropdownOpen(false);
    setHighlight(0);
    window.setTimeout(() => searchRef.current?.focus(), 20);
  };

  const setQuantity = (key, value) => {
    const qty = Math.max(1, Math.min(999, Number(value) || 1));
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)));
  };

  const removeLine = (key) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const onSearchKeyDown = (e) => {
    if (!dropdownOpen && (e.key === 'ArrowDown' || e.key === 'Enter') && filteredItems.length) {
      setDropdownOpen(true);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownOpen(true);
      setHighlight((h) => Math.min(filteredItems.length - 1, h + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlight]) addItem(filteredItems[highlight]);
      return;
    }
    if (e.key === 'Escape' && dropdownOpen) {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(false);
    }
  };

  useEffect(() => {
    if (!dropdownOpen || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, dropdownOpen]);

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
    if (lines.length === 0) {
      setError('Agregá al menos un ítem a la comanda');
      searchRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const result = await createConsumptionOrder({
        reservationId: selectedReservation.reservationId,
        fecha,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity
        }))
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
            <p className={styles.subtitle}>Comanda por reserva — Enter agrega ítems</p>
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

        <div className={styles.body}>
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
                setSelectionKey(e.target.value);
                setSuccessMsg(null);
                window.setTimeout(() => searchRef.current?.focus(), 20);
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

          <div className={styles.row}>
            <span className={styles.label}>Cliente</span>
            <div className={styles.clientBox}>
              {selectedReservation?.clientName || (selectionKey ? 'Sin nombre' : '—')}
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.label} htmlFor="consumo-search">
              Ítem del menú
            </label>
            <div className={styles.searchWrap}>
              <FiSearch className={styles.searchIcon} aria-hidden="true" />
              <input
                id="consumo-search"
                ref={searchRef}
                className={styles.searchInput}
                type="text"
                autoComplete="off"
                placeholder="Buscar bebidas, minutas, cafetería…"
                value={query}
                disabled={submitting || !selectedReservation}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={onSearchKeyDown}
                aria-autocomplete="list"
                aria-expanded={dropdownOpen}
              />
              {dropdownOpen && selectedReservation ? (
                <ul className={styles.dropdown} role="listbox" ref={listRef}>
                  {filteredItems.length === 0 ? (
                    <li className={styles.dropdownEmpty}>Sin resultados</li>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          data-idx={idx}
                          aria-selected={idx === highlight}
                          className={`${styles.dropdownItem} ${idx === highlight ? styles.dropdownItemActive : ''}`}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => addItem(item)}
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
          </div>

          <div className={styles.linesHeader}>
            <span>Comanda</span>
            <span className={styles.muted}>{lines.length} ítem(s)</span>
          </div>

          {lines.length === 0 ? (
            <div className={styles.emptyLines}>Sin ítems. Buscá y presioná Enter para agregar.</div>
          ) : (
            <ul className={styles.lines}>
              {lines.map((line) => (
                <li key={line.key} className={styles.line}>
                  <div className={styles.lineMain}>
                    <span className={styles.lineCat}>
                      {CATEGORY_LABELS[line.category] || line.category}
                    </span>
                    <span className={styles.lineName}>{line.name}</span>
                  </div>
                  <div className={styles.lineControls}>
                    <label className={styles.srOnly} htmlFor={`qty-${line.key}`}>
                      Cantidad {line.name}
                    </label>
                    <input
                      id={`qty-${line.key}`}
                      className={styles.qty}
                      type="number"
                      min={1}
                      max={999}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.key, e.target.value)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className={styles.lineSubtotal}>
                      {formatMoney(line.price * line.quantity)}
                    </span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => removeLine(line.key)}
                      aria-label={`Quitar ${line.name}`}
                      title="Quitar"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
              disabled={submitting || lines.length === 0 || !selectedReservation}
              onClick={() => submit({ continueAfter: true })}
              title="Guardar y cargar otra reserva"
            >
              <FiPlus aria-hidden="true" />
              Guardar y otra
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={submitting || lines.length === 0 || !selectedReservation}
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
