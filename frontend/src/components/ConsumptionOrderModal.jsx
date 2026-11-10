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

/**
 * Modal POS de comanda: habitación → cliente, buscador de ítems, cantidades, teclado-first.
 */
export default function ConsumptionOrderModal({ open, onClose, onSaved }) {
  const titleId = useId();
  const roomRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const [rooms, setRooms] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => String(r.roomId) === String(roomId)) || null,
    [rooms, roomId]
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
    setRoomId('');
    setQuery('');
    setHighlight(0);
    setDropdownOpen(false);
    setLines([]);
    setError(null);
  }, []);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const [roomsRes, itemsRes] = await Promise.all([
        fetchOccupiedRoomsToday(),
        fetchMenuItems({ active: true })
      ]);
      setRooms(roomsRes.data || roomsRes || []);
      setMenuItems(itemsRes.data || itemsRes || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la comanda');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    resetOrder();
    setSuccessMsg(null);
    loadMeta();
    const t = window.setTimeout(() => roomRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, loadMeta, resetOrder]);

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

    if (!selectedRoom?.reservationId) {
      setError('Seleccioná una habitación ocupada');
      roomRef.current?.focus();
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
        reservationId: selectedRoom.reservationId,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity
        }))
      });

      const roomLabel = selectedRoom.roomName;
      const client = selectedRoom.clientName || 'huésped';
      setSuccessMsg(
        `Comanda cargada en ${roomLabel} (${client}) — ${formatMoney(result?.data?.total ?? total)}`
      );
      onSaved?.(result);

      if (continueAfter) {
        resetOrder();
        window.setTimeout(() => roomRef.current?.focus(), 40);
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
            <p className={styles.subtitle}>Comanda por habitación — Enter agrega ítems</p>
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
            <label className={styles.label} htmlFor="consumo-room">
              Habitación
            </label>
            <select
              id="consumo-room"
              ref={roomRef}
              className={styles.select}
              value={roomId}
              disabled={loadingMeta || submitting}
              onChange={(e) => {
                setRoomId(e.target.value);
                setSuccessMsg(null);
                window.setTimeout(() => searchRef.current?.focus(), 20);
              }}
            >
              <option value="">Seleccionar habitación…</option>
              {rooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>
                  {r.roomName}
                  {r.clientName ? ` — ${r.clientName}` : ''}
                  {r.status === 'INGRESADA' ? '' : ` (${r.status})`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Cliente</span>
            <div className={styles.clientBox}>
              {selectedRoom?.clientName || (roomId ? 'Sin nombre' : '—')}
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
                disabled={submitting || !selectedRoom}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={onSearchKeyDown}
                aria-autocomplete="list"
                aria-expanded={dropdownOpen}
              />
              {dropdownOpen && selectedRoom ? (
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
              disabled={submitting || lines.length === 0 || !selectedRoom}
              onClick={() => submit({ continueAfter: true })}
              title="Guardar y cargar otra habitación"
            >
              <FiPlus aria-hidden="true" />
              Guardar y otra hab.
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={submitting || lines.length === 0 || !selectedRoom}
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
