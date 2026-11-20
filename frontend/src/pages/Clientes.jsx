import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { fetchClients } from '../services/api';
import { getAddressFromNotes } from '../utils/clientAddressNotes';
import { filterAndSortClients } from '../utils/clientListQuery';
import styles from './Clientes.module.css';

const COLUMNS = [
  { field: 'lastName', label: 'Apellido' },
  { field: 'firstName', label: 'Nombre' },
  { field: 'email', label: 'Email' },
  { field: 'phone', label: 'Teléfono' },
  { field: 'documentNumber', label: 'Documento' },
  { field: 'country', label: 'País' },
  { field: 'province', label: 'Provincia' },
  { field: 'city', label: 'Ciudad' },
  { field: 'address', label: 'Domicilio' },
  { field: 'wantsPromotions', label: 'Promociones' },
];

function ClientesShell({ children }) {
  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Clientes</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de clientes">
          <button type="button" className={`${styles.sectionButton} ${styles.active}`}>
            Listado
          </button>
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>{children}</div>
      </div>
    </div>
  );
}

function Clientes() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('lastName');
  const [sortDirection, setSortDirection] = useState('asc');

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError('No se pudieron cargar los clientes. Revisá la conexión e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const visibleClients = useMemo(
    () =>
      filterAndSortClients(clients, {
        search,
        sortField,
        sortDirection,
      }),
    [clients, search, sortField, sortDirection]
  );

  const hasActiveFilters = Boolean(search);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const clearFilters = () => {
    setSearch('');
  };

  if (loading) {
    return (
      <ClientesShell>
        <div className={styles.statusPanel} role="status" aria-live="polite">
          Cargando clientes…
        </div>
      </ClientesShell>
    );
  }

  if (error) {
    return (
      <ClientesShell>
        <div className={styles.statusPanel} role="alert">
          <p className={styles.error}>{error}</p>
          <button type="button" onClick={loadClients} className={styles.retryButton}>
            Reintentar
          </button>
        </div>
      </ClientesShell>
    );
  }

  return (
    <ClientesShell>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Listado de clientes</h1>
      </header>

      <section className={styles.section} aria-label="Listado de clientes">
        <div className={styles.sectionHeader}>
          <p className={styles.resultsInfo} aria-live="polite">
            Mostrando {visibleClients.length} de {clients.length} clientes
          </p>

          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Buscar cliente</span>
              <FiSearch className={styles.searchIcon} aria-hidden="true" size={15} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, documento, email, teléfono…"
                autoComplete="off"
              />
            </label>

            {hasActiveFilters ? (
              <div className={styles.filters}>
                <button type="button" className={styles.clearFilters} onClick={clearFilters}>
                  Limpiar búsqueda
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {visibleClients.length === 0 ? (
          <div className={styles.emptyState}>
            {hasActiveFilters ? (
              <>
                <p className={styles.emptyTitle}>Ningún cliente coincide</p>
                <p className={styles.emptyHint}>Probá otra búsqueda o limpiá el filtro.</p>
                <button type="button" className={styles.clearFilters} onClick={clearFilters}>
                  Limpiar búsqueda
                </button>
              </>
            ) : (
              <>
                <p className={styles.emptyTitle}>No hay clientes para mostrar</p>
                <p className={styles.emptyHint}>Cuando se carguen, van a aparecer acá.</p>
              </>
            )}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    const isActive = sortField === column.field;
                    const SortIcon = isActive
                      ? sortDirection === 'asc'
                        ? FiChevronUp
                        : FiChevronDown
                      : null;
                    return (
                      <th
                        key={column.field}
                        className={styles.sortableHeader}
                        aria-sort={
                          isActive
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <button
                          type="button"
                          className={styles.sortButton}
                          onClick={() => handleSort(column.field)}
                        >
                          <span>{column.label}</span>
                          {SortIcon ? (
                            <SortIcon className={styles.sortIcon} aria-hidden="true" size={14} />
                          ) : (
                            <span className={styles.sortPlaceholder} aria-hidden="true" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((client) => {
                  const address = getAddressFromNotes(client.notes) || '—';
                  return (
                    <tr
                      key={client.id}
                      className={styles.row}
                      tabIndex={0}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/clients/${client.id}`);
                        }
                      }}
                    >
                      <td>{client.lastName || '—'}</td>
                      <td>{client.firstName || '—'}</td>
                      <td>
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            className={styles.emailLink}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {client.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {client.phone ? (
                          <a
                            href={`tel:${client.phone}`}
                            className={styles.phoneLink}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {client.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.tabular}>
                        {[client.documentType, client.documentNumber].filter(Boolean).join(' ') ||
                          '—'}
                      </td>
                      <td>{client.country || '—'}</td>
                      <td>{client.province || '—'}</td>
                      <td>{client.city || '—'}</td>
                      <td className={styles.addressCell}>{address}</td>
                      <td>
                        <span
                          className={
                            client.wantsPromotions ? styles.promotionYes : styles.promotionNo
                          }
                        >
                          {client.wantsPromotions ? 'Sí' : 'No'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ClientesShell>
  );
}

export default Clientes;
