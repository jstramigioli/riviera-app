import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { fetchAuditEntities, fetchAuditLogs } from '../services/api';
import styles from './Auditoria.module.css';

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return String(value);
  }
}

function prettyJson(value) {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const EMPTY_FILTERS = {
  q: '',
  entity: '',
  action: '',
  from: '',
  to: ''
};

function Auditoria() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [items, setItems] = useState([]);
  const [entities, setEntities] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const loadEntities = useCallback(async () => {
    try {
      const list = await fetchAuditEntities();
      setEntities(Array.isArray(list) ? list : []);
    } catch {
      setEntities([]);
    }
  }, []);

  const loadPage = useCallback(async ({ reset = false, cursor = null } = {}) => {
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await fetchAuditLogs({
        q: applied.q || undefined,
        entity: applied.entity || undefined,
        action: applied.action || undefined,
        from: applied.from ? new Date(applied.from).toISOString() : undefined,
        to: applied.to ? new Date(applied.to).toISOString() : undefined,
        cursor: cursor || undefined,
        limit: 50
      });

      const pageItems = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => (reset ? pageItems : [...prev, ...pageItems]));
      setNextCursor(data?.nextCursor || null);
      if (reset) {
        setSelectedId(pageItems[0]?.id || null);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial');
      if (reset) {
        setItems([]);
        setSelectedId(null);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [applied]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    loadPage({ reset: true });
  }, [loadPage]);

  function onFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function applyFilters(event) {
    event?.preventDefault?.();
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Auditoría</h1>
        <p>Historial de cambios por usuario de sesión (admin / gerencia).</p>
      </header>

      <form className={styles.filters} onSubmit={applyFilters}>
        <div className={styles.field}>
          <label htmlFor="audit-q">Buscar</label>
          <input
            id="audit-q"
            name="q"
            value={filters.q}
            onChange={onFilterChange}
            placeholder="Usuario, resumen, id…"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-entity">Entidad</label>
          <select id="audit-entity" name="entity" value={filters.entity} onChange={onFilterChange}>
            <option value="">Todas</option>
            {entities.map((entity) => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
            {!entities.includes('Reservation') ? <option value="Reservation">Reservation</option> : null}
            {!entities.includes('Client') ? <option value="Client">Client</option> : null}
            {!entities.includes('Pago') ? <option value="Pago">Pago</option> : null}
            {!entities.includes('Cargo') ? <option value="Cargo">Cargo</option> : null}
            {!entities.includes('SeasonBlock') ? <option value="SeasonBlock">SeasonBlock</option> : null}
            {!entities.includes('Configuracion') ? <option value="Configuracion">Configuracion</option> : null}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-action">Acción</label>
          <select id="audit-action" name="action" value={filters.action} onChange={onFilterChange}>
            <option value="">Todas</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="UPSERT">UPSERT</option>
            <option value="CREATE_MANY">CREATE_MANY</option>
            <option value="UPDATE_MANY">UPDATE_MANY</option>
            <option value="DELETE_MANY">DELETE_MANY</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-from">Desde</label>
          <input id="audit-from" type="datetime-local" name="from" value={filters.from} onChange={onFilterChange} />
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-to">Hasta</label>
          <input id="audit-to" type="datetime-local" name="to" value={filters.to} onChange={onFilterChange} />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.button}>
            <FiSearch aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Filtrar
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={clearFilters}>
            Limpiar
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => loadPage({ reset: true })} title="Actualizar">
            <FiRefreshCw aria-hidden="true" />
          </button>
        </div>
      </form>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p className={styles.status}>
        {loading ? 'Cargando…' : `${items.length} registro${items.length === 1 ? '' : 's'}`}
      </p>

      <div className={styles.layout}>
        <div>
          <div className={styles.tableWrap}>
            {loading && items.length === 0 ? (
              <div className={styles.empty}>Cargando historial…</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}>No hay cambios registrados con estos filtros.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Actor</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`${styles.row} ${item.id === selectedId ? styles.rowActive : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td className={styles.mono}>{formatWhen(item.createdAt)}</td>
                      <td>
                        <div>{item.actorDisplayName || item.actorUsername || 'Sistema'}</div>
                        <div className={styles.muted}>{item.actorRole || '—'}</div>
                      </td>
                      <td>{item.action}</td>
                      <td>
                        <div>{item.entity}</div>
                        <div className={styles.muted}>{item.entityId || '—'}</div>
                      </td>
                      <td>{item.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {nextCursor ? (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={loadingMore}
                onClick={() => loadPage({ cursor: nextCursor })}
              >
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            </div>
          ) : null}
        </div>

        <aside className={styles.detail}>
          {selected ? (
            <>
              <h2>Detalle</h2>
              <div className={styles.detailMeta}>
                <div><span className={styles.label}>Cuándo</span><span>{formatWhen(selected.createdAt)}</span></div>
                <div><span className={styles.label}>Actor</span><span>{selected.actorDisplayName || selected.actorUsername || 'Sistema'} ({selected.actorRole || '—'})</span></div>
                <div><span className={styles.label}>Acción</span><span>{selected.action}</span></div>
                <div><span className={styles.label}>Entidad</span><span>{selected.entity} {selected.entityId ? `#${selected.entityId}` : ''}</span></div>
                <div><span className={styles.label}>Resumen</span><span>{selected.summary}</span></div>
              </div>
              <h2>Diff</h2>
              <pre className={styles.pre}>{prettyJson(selected.diff || { before: selected.before, after: selected.after })}</pre>
            </>
          ) : (
            <div className={styles.empty}>Seleccioná un registro para ver el detalle.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default Auditoria;
