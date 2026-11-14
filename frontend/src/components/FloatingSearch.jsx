import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  LIBRO_SEARCH_TYPE_LABEL,
  searchLibroEntities
} from '../utils/libroGlobalSearch';
import styles from '../styles/FloatingSearch.module.css';

/**
 * Lupa del hub del Libro (entre Hoy y +) → barra de búsqueda opaca.
 */
export default function FloatingSearch({
  reservations = [],
  clients = [],
  queries = [],
  onSelectReservation,
  onSelectClient,
  onSelectQuery
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const panelId = useId();

  const results = useMemo(
    () =>
      searchLibroEntities(
        { reservations, clients, queries },
        term,
        { limit: 12 }
      ),
    [reservations, clients, queries, term]
  );

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setTerm('');
      }
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = () => {
    setOpen(false);
    setTerm('');
  };

  const pick = (item) => {
    if (item.type === 'reservation') onSelectReservation?.(item.payload);
    else if (item.type === 'client') onSelectClient?.(item.payload);
    else if (item.type === 'query') onSelectQuery?.(item.payload);
    close();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      {open ? (
        <div className={styles.panel} id={panelId} role="dialog" aria-label="Buscar en el Libro">
          <div className={styles.inputRow}>
            <span className={styles.inputIcon} aria-hidden="true">
              <FiSearch size={15} />
            </span>
            <input
              ref={inputRef}
              type="search"
              className={styles.input}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Reservas, clientes, consultas…"
              aria-label="Buscar reservas, clientes o consultas"
              autoComplete="off"
            />
          </div>
          <div className={styles.results} role="listbox" aria-label="Resultados">
            {!term.trim() ? (
              <div className={styles.empty}>Escribí nombre, documento, teléfono o ID</div>
            ) : results.length === 0 ? (
              <div className={styles.empty}>Sin resultados</div>
            ) : (
              results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  role="option"
                  className={styles.resultButton}
                  onClick={() => pick(item)}
                >
                  <span className={styles.typeBadge}>
                    {LIBRO_SEARCH_TYPE_LABEL[item.type]}
                  </span>
                  <span className={styles.resultTitle}>{item.title}</span>
                  <span className={styles.resultSubtitle}>{item.subtitle}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        aria-label={open ? 'Cerrar búsqueda' : 'Buscar en el Libro'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={open ? 'Cerrar' : 'Buscar'}
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          {open ? <FiX /> : <FiSearch />}
        </span>
      </button>
    </div>
  );
}
