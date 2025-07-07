import React, { useState } from 'react';
import EditClientModal from './EditClientModal';
import api from '../services/api';
import styles from '../styles/Estadisticas.module.css';

function ClientList({ clients, onClientUpdated, onClientDeleted }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('lastName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Función para extraer domicilio de las notas
  const getAddressFromNotes = (notes) => {
    if (!notes) return null;
    const addressMatch = notes.match(/Domicilio:\s*(.+)/);
    return addressMatch ? addressMatch[1].trim() : null;
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleClientUpdated = (updatedClient) => {
    onClientUpdated(updatedClient);
    handleCloseModal();
  };

  const handleDeleteClient = async (client) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar al cliente "${client.firstName} ${client.lastName}"?\n\nEsta acción no se puede deshacer.`
    );
    
    if (confirmDelete) {
      try {
        await api.deleteClient(client.id);
        onClientDeleted(client.id);
        alert('Cliente eliminado exitosamente');
      } catch (error) {
        console.error('Error eliminando cliente:', error);
        alert('Error al eliminar el cliente');
      }
    }
  };

  const filteredAndSortedClients = clients
    .filter(client => {
      const searchLower = searchTerm.toLowerCase();
      const address = getAddressFromNotes(client.notes);
      return (
        client.firstName?.toLowerCase().includes(searchLower) ||
        client.lastName?.toLowerCase().includes(searchLower) ||
        client.email?.toLowerCase().includes(searchLower) ||
        client.phone?.includes(searchTerm) ||
        client.documentNumber?.includes(searchTerm) ||
        client.city?.toLowerCase().includes(searchLower) ||
        client.province?.toLowerCase().includes(searchLower) ||
        address?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      // Convertir a string para comparación
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

  return (
    <div className={styles.clientListContainer}>
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>
        <div className={styles.resultsInfo}>
          Mostrando {filteredAndSortedClients.length} de {clients.length} clientes
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.clientsTable}>
          <thead>
            <tr>
              <th onClick={() => handleSort('lastName')} className={styles.sortableHeader}>
                Apellido
                {sortField === 'lastName' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('firstName')} className={styles.sortableHeader}>
                Nombre
                {sortField === 'firstName' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('email')} className={styles.sortableHeader}>
                Email
                {sortField === 'email' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('phone')} className={styles.sortableHeader}>
                Teléfono
                {sortField === 'phone' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('documentType')} className={styles.sortableHeader}>
                Tipo Doc.
                {sortField === 'documentType' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('documentNumber')} className={styles.sortableHeader}>
                Número Doc.
                {sortField === 'documentNumber' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('country')} className={styles.sortableHeader}>
                País
                {sortField === 'country' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('province')} className={styles.sortableHeader}>
                Provincia
                {sortField === 'province' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('city')} className={styles.sortableHeader}>
                Ciudad
                {sortField === 'city' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th className={styles.sortableHeader}>
                Domicilio
              </th>
              <th onClick={() => handleSort('wantsPromotions')} className={styles.sortableHeader}>
                Promociones
                {sortField === 'wantsPromotions' && (
                  <span className={styles.sortIcon}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th className={styles.actionHeader}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedClients.map(client => (
              <tr key={client.id} className={styles.tableRow}>
                <td>{client.lastName || '-'}</td>
                <td>{client.firstName || '-'}</td>
                <td>
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className={styles.emailLink}>
                      {client.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className={styles.phoneLink}>
                      {client.phone}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{client.documentType || '-'}</td>
                <td>{client.documentNumber || '-'}</td>
                <td>
                  <span className={styles.countryBadge}>
                    {client.country || '-'}
                  </span>
                </td>
                <td>{client.province || '-'}</td>
                <td>{client.city || '-'}</td>
                <td className={styles.addressCell}>
                  {getAddressFromNotes(client.notes) || '-'}
                </td>
                <td>
                  {client.wantsPromotions ? (
                    <span className={styles.promotionBadge}>
                      ✅ Sí
                    </span>
                  ) : (
                    <span className={styles.noPromotionBadge}>
                      ❌ No
                    </span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => handleEditClient(client)}
                    className={styles.editButton}
                    title="Editar cliente"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client)}
                    className={styles.deleteButton}
                    title="Eliminar cliente"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredAndSortedClients.length === 0 && (
          <div className={styles.emptyState}>
            <p>No se encontraron clientes que coincidan con la búsqueda.</p>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      <EditClientModal
        client={editingClient}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onClientUpdated={handleClientUpdated}
      />
    </div>
  );
}

export default ClientList; 