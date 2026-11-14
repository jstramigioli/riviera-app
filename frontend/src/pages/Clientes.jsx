import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchClients } from '../services/api';
import { getAddressFromNotes } from '../utils/clientAddressNotes';
import { filterAndSortClients, uniqueCountries } from '../utils/clientListQuery';
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

function Clientes() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [promotions, setPromotions] = useState('');
  const [hasEmail, setHasEmail] = useState('');
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
      setError('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const countries = useMemo(() => uniqueCountries(clients), [clients]);

  const visibleClients = useMemo(
    () =>
      filterAndSortClients(clients, {
        search,
        country,
        promotions,
        hasEmail,
        sortField,
        sortDirection,
      }),
    [clients, search, country, promotions, hasEmail, sortField, sortDirection]
  );

  const hasActiveFilters = Boolean(search || country || promotions || hasEmail);

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
    setCountry('');
    setPromotions('');
    setHasEmail('');
  };

  if (loading) {
    return <div className={styles.loading}>Cargando clientes...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <div className={styles.error}>{error}</div>
        <button type="button" onClick={loadClients} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

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
        <div className={styles.mainContentBody}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Listado de clientes</h2>
                <p className={styles.resultsInfo}>
                  Mostrando {visibleClients.length} de {clients.length} clientes
                </p>
              </div>

              <div className={styles.toolbar}>
                <label className={styles.searchField}>
                  <span className={styles.srOnly}>Buscar cliente</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, documento, email, teléfono…"
                  />
                </label>

                <div className={styles.filters} aria-label="Filtros de clientes">
                  <label className={styles.srOnly} htmlFor="client-filter-country">
                    País
                  </label>
                  <select
                    id="client-filter-country"
                    className={styles.filterSelect}
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  >
                    <option value="">Todos los países</option>
                    {countries.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>

                  <label className={styles.srOnly} htmlFor="client-filter-promotions">
                    Promociones
                  </label>
                  <select
                    id="client-filter-promotions"
                    className={styles.filterSelect}
                    value={promotions}
                    onChange={(event) => setPromotions(event.target.value)}
                  >
                    <option value="">Promociones: todas</option>
                    <option value="yes">Quiere promociones</option>
                    <option value="no">No quiere promociones</option>
                  </select>

                  <label className={styles.srOnly} htmlFor="client-filter-email">
                    Email
                  </label>
                  <select
                    id="client-filter-email"
                    className={styles.filterSelect}
                    value={hasEmail}
                    onChange={(event) => setHasEmail(event.target.value)}
                  >
                    <option value="">Email: todos</option>
                    <option value="yes">Con email</option>
                    <option value="no">Sin email</option>
                  </select>

                  {hasActiveFilters ? (
                    <button type="button" className={styles.clearFilters} onClick={clearFilters}>
                      Limpiar filtros
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {visibleClients.length === 0 ? (
              <div className={styles.emptyState}>No hay clientes para mostrar</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {COLUMNS.map((column) => (
                        <th
                          key={column.field}
                          className={styles.sortableHeader}
                          onClick={() => handleSort(column.field)}
                          aria-sort={
                            sortField === column.field
                              ? sortDirection === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                        >
                          {column.label}
                          {sortField === column.field ? (
                            <span className={styles.sortIcon} aria-hidden="true">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClients.map((client) => {
                      const address = getAddressFromNotes(client.notes) || '-';
                      return (
                        <tr
                          key={client.id}
                          className={styles.row}
                          onClick={() => navigate(`/clients/${client.id}`)}
                        >
                          <td>{client.lastName || '-'}</td>
                          <td>{client.firstName || '-'}</td>
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
                              '-'
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
                              '-'
                            )}
                          </td>
                          <td>
                            {[client.documentType, client.documentNumber].filter(Boolean).join(' ') || '-'}
                          </td>
                          <td>{client.country || '-'}</td>
                          <td>{client.province || '-'}</td>
                          <td>{client.city || '-'}</td>
                          <td>{address}</td>
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
        </div>
      </div>
    </div>
  );
}

export default Clientes;
