import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import {
  LIBRO_SEARCH_TYPE_LABEL,
  searchLibroEntities
} from '../utils/libroGlobalSearch';
import {
  fetchClients,
  fetchQueries,
  fetchReservations
} from '../services/api';
import styles from '../styles/App.module.css';

/**
 * Barra de búsqueda siempre visible en el menú superior (todas las páginas).
 */
export default function GlobalNavSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [queries, setQueries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchReservations(), fetchClients(), fetchQueries()])
      .then(([reservationsData, clientsData, queriesData]) => {
        if (cancelled) return;
        setReservations(Array.isArray(reservationsData) ? reservationsData : []);
        setClients(Array.isArray(clientsData) ? clientsData : []);
        setQueries(Array.isArray(queriesData) ? queriesData : []);
        setLoaded(true);
      })
      .catch((err) => {
        console.error('Error cargando búsqueda global:', err);
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const pick = (item) => {
    if (item.type === 'reservation') {
      navigate(`/reservations/${item.id}`);
    } else if (item.type === 'client') {
      navigate(`/clients/${item.id}`);
    } else if (item.type === 'query') {
      navigate('/consulta', {
        state: { queryData: item.payload, isEditing: true }
      });
    }
    setTerm('');
    setOpen(false);
  };

  const showResults = open && term.trim().length > 0;

  return (
    <div className={styles.globalSearch} ref={rootRef}>
      <label className={styles.globalSearchLabel} htmlFor="global-nav-search">
        <span className={styles.globalSearchIcon} aria-hidden="true">
          <FiSearch size={14} />
        </span>
        <input
          id="global-nav-search"
          type="search"
          className={styles.globalSearchInput}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar reservas, clientes…"
          aria-label="Buscar reservas, clientes o consultas"
          aria-controls={showResults ? listId : undefined}
          aria-expanded={showResults}
          autoComplete="off"
        />
      </label>

      {showResults ? (
        <div
          className={styles.globalSearchResults}
          id={listId}
          role="listbox"
          aria-label="Resultados de búsqueda"
        >
          {!loaded ? (
            <div className={styles.globalSearchEmpty}>Cargando…</div>
          ) : results.length === 0 ? (
            <div className={styles.globalSearchEmpty}>Sin resultados</div>
          ) : (
            results.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                role="option"
                className={styles.globalSearchResult}
                onClick={() => pick(item)}
              >
                <span className={styles.globalSearchBadge}>
                  {LIBRO_SEARCH_TYPE_LABEL[item.type]}
                </span>
                <span className={styles.globalSearchTitle}>{item.title}</span>
                <span className={styles.globalSearchSubtitle}>{item.subtitle}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
