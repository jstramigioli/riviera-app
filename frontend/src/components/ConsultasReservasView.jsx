import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { useAppData } from '../hooks/useAppData';
import { useSidePanel } from '../hooks/useSidePanel';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useAppNotice } from '../hooks/useAppNotice';
import { format } from 'date-fns';
import { updateReservationOnServer, updateClientOnServer } from '../utils/apiUtils';
import { deleteQuery, deleteAllQueries } from '../services/api';
import { deleteReservationWithWarning } from '../utils/deleteReservationWithWarning';
import { validateReservationDates, validateReservationConflict, showConflictNotification } from '../utils/reservationUtils';
import {
  RESERVATION_SOURCE_OPTIONS,
  sourceLabel
} from '../constants/reservationSource';
import ReservationsTable from './ReservationsTable';
import QueriesTable from './QueriesTable';
import SidePanel from './SidePanel';
import EditPanel from './EditPanel';
import ConfirmationModal from './ConfirmationModal';
import ErrorDisplay from './ErrorDisplay';
import styles from './ConsultasReservasView.module.css';

function ConsultasReservasView() {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeSection, setActiveSection] = useState('consultas');
  const [serviceTypes, setServiceTypes] = useState([]);
  const [clearingAll, setClearingAll] = useState(false);
  
  const {
    rooms,
    clients,
    setClients,
    reservations,
    setReservations,
    queries,
    setQueries,
    loading,
    error
  } = useAppData();

  const {
    sidePanelOpen,
    selectedReservation,
    selectedClient,
    clientBalance,
    isEditing,
    editData,
    panelMode,
    handleReservationClick,
    handleClientClick,
    handleEditChange,
    handleEditToggle,
    closePanel,
    setSelectedReservation,
    setSelectedClient,
    setIsEditing,
    setEditData
  } = useSidePanel();

  // Cargar tipos de servicio
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/service-types?hotelId=default-hotel');
        if (response.ok) {
          const data = await response.json();
          setServiceTypes(data.data || []);
        }
      } catch (error) {
        console.error('Error loading service types:', error);
      }
    };
    loadServiceTypes();
  }, []);

  // Función para obtener el nombre del tipo de servicio
  const getServiceTypeName = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    return serviceType ? serviceType.name : serviceTypeId;
  };

  async function handleEditSave() {
    try {
      if (panelMode === 'reservation') {
        // Validar fechas primero
        const dateValidation = validateReservationDates(editData.checkIn, editData.checkOut);
        if (!dateValidation.isValid) {
          notify({ title: 'Validación', message: dateValidation.message, type: 'warning' });
          return;
        }
        
        // Validar conflictos de reserva
        const conflict = validateReservationConflict(
          reservations,
          editData.roomId,
          editData.checkIn,
          editData.checkOut,
          editData.id
        );
        
        if (conflict.hasConflict) {
          const notice = showConflictNotification(conflict.message);
          notify({ title: 'Conflicto', message: notice.message, type: 'error' });
          return;
        }
        
        const updated = await updateReservationOnServer(editData.id, editData, setReservations);
        setIsEditing(false);
        setSelectedReservation(updated);
        setEditData(updated);
      } else {
        // Validar email antes de guardar
        if (editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email)) {
          notify({ title: 'Validación', message: 'Por favor, ingrese un formato de email válido', type: 'warning' });
          return;
        }
        
        const updated = await updateClientOnServer(editData.id, editData, setClients, setReservations);
        setIsEditing(false);
        setSelectedClient(updated);
        setEditData(updated);
      }
    } catch (error) {
      console.error('Error saving:', error);
      notify({
        title: 'Error',
        message: error.message || 'Error de conexión. Los cambios se han revertido.',
        type: 'error',
      });
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedReservation) return;
    try {
      setShowDeleteModal(false);
      const deleted = await deleteReservationWithWarning(selectedReservation.id, confirm);
      if (!deleted) return;
      setReservations(reservations.filter(r => r.id !== selectedReservation.id));
      closePanel();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      notify({ title: 'Error', message: `Error al eliminar la reserva: ${error.message}`, type: 'error' });
    }
  };

  const handleDeleteQuery = async (queryId) => {
    try {
      await deleteQuery(queryId);
      setQueries(prev => prev.filter(q => q.id !== queryId));
    } catch (error) {
      console.error('Error deleting query:', error);
      
      // Manejar diferentes tipos de errores
      let errorMessage = 'Error al eliminar la consulta';
      
      if (error.message.includes('404')) {
        errorMessage = 'La consulta no existe o ya fue eliminada';
      } else if (error.message.includes('500')) {
        errorMessage = 'Error del servidor. Intenta nuevamente';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      notify({ title: 'Error', message: errorMessage, type: 'error' });
    }
  };

  const handleClearAllQueries = async () => {
    if (!queries.length || clearingAll) return;

    const ok = await confirm({
      title: 'Limpiar todas las consultas',
      message: `¿Confirmás eliminar las ${queries.length} consultas almacenadas? Esta acción no se puede deshacer.`,
      confirmText: 'Limpiar todas',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (!ok) return;

    try {
      setClearingAll(true);
      await deleteAllQueries();
      setQueries([]);
    } catch (error) {
      console.error('Error clearing queries:', error);
      notify({
        title: 'Error',
        message: error.message || 'Error al limpiar las consultas',
        type: 'error',
      });
    } finally {
      setClearingAll(false);
    }
  };


  if (loading) return <div className={styles.loading}>Cargando datos...</div>;
  if (error) return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className={styles.newLayout}>
      {/* Sidebar Izquierdo */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Consultas y Reservas</h2>
        </div>

        {/* Menú de navegación */}
        <div className={styles.sectionMenu}>
          <button 
            type="button"
            className={`${styles.sectionButton} ${activeSection === 'consultas' ? styles.active : ''}`}
            onClick={() => setActiveSection('consultas')}
          >
            Consultas
          </button>
          <button 
            type="button"
            className={`${styles.sectionButton} ${activeSection === 'reservas' ? styles.active : ''}`}
            onClick={() => setActiveSection('reservas')}
          >
            Reservas
          </button>
        </div>
      </div>

      {/* Contenido Principal Derecho */}
      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          {/* Sección de Consultas */}
          {activeSection === 'consultas' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Consultas</h2>
                <div className={styles.sectionActions}>
                  <button
                    type="button"
                    className={styles.clearAllButton}
                    onClick={handleClearAllQueries}
                    disabled={!queries.length || clearingAll}
                    title="Eliminar todas las consultas almacenadas"
                  >
                    <FiTrash2 aria-hidden="true" />
                    {clearingAll ? 'Limpiando…' : 'Limpiar todas'}
                  </button>
                  <button 
                    type="button"
                    className={styles.createButton}
                    onClick={() => navigate('/consulta')}
                    title="Crear nueva consulta"
                  >
                    <FiPlus aria-hidden="true" />
                    Nueva Consulta
                  </button>
                </div>
              </div>
              <QueriesTable 
                queries={queries}
                onDeleteQuery={handleDeleteQuery}
              />
            </div>
          )}

          {/* Sección de Reservas */}
          {activeSection === 'reservas' && (
            <div className={styles.section}>
              <h2>Reservas</h2>
              <ReservationsTable 
                reservations={reservations}
                rooms={rooms}
                clients={clients}
                onReservationClick={handleReservationClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* SidePanel para detalles (mantenemos el existente) */}
      <SidePanel
        open={sidePanelOpen}
        onClose={closePanel}
        title={panelMode === 'reservation' && selectedReservation ? `Reserva #${selectedReservation.id}` : "DATOS DEL CLIENTE"}
        width={520}
      >
        {panelMode === 'reservation' && selectedReservation && (
          <EditPanel
            subtitle={`Reserva #${selectedReservation.id}`}
            isEditing={isEditing}
            onEditToggle={handleEditToggle}
            onSave={handleEditSave}
            onDelete={handleDeleteClick}
            showDeleteButton={true}
          >
            {/* Habitación */}
            <div style={{ marginBottom: 8 }}>
              <b> Habitación:</b> {isEditing ? (
                <select
                  value={editData.roomId || selectedReservation.roomId}
                  onChange={e => handleEditChange('roomId', parseInt(e.target.value))}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              ) : (
                <a
                  href={`/habitaciones/${selectedReservation.room?.id}`}
                  onClick={(e) => { e.preventDefault(); window.location.href = `/habitaciones/${selectedReservation.room?.id}`; }}
                  style={{ cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}
                  title={`Ver detalles de la habitación ${selectedReservation.room?.name}`}
                >
                  {selectedReservation.room?.name}
                </a>
              )}
            </div>

            {/* Cliente principal */}
            <div style={{ marginBottom: 8 }}>
              <b> Cliente principal:</b> {isEditing ? (
                <select
                  value={editData.mainClientId || selectedReservation.mainClientId}
                  onChange={e => handleEditChange('mainClientId', parseInt(e.target.value))}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
              ) : (
                <a
                  href={`/clients/${selectedReservation.mainClientId}`}
                  onClick={(e) => { e.preventDefault(); handleClientClick(clients.find(c => c.id === selectedReservation.mainClientId)); }}
                  style={{ cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}
                >
                  {selectedReservation.mainClient?.firstName} {selectedReservation.mainClient?.lastName}
                </a>
              )}
            </div>

            {/* Fechas */}
            <div style={{ marginBottom: 8 }}>
              <b> Check-in:</b> {isEditing ? (
                <input
                  type="date"
                  value={editData.checkIn ? format(new Date(editData.checkIn), 'yyyy-MM-dd') : format(new Date(selectedReservation.checkIn), 'yyyy-MM-dd')}
                  onChange={e => handleEditChange('checkIn', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                format(new Date(selectedReservation.checkIn), 'dd/MM/yyyy')
              )}
            </div>

            <div style={{ marginBottom: 8 }}>
              <b> Check-out:</b> {isEditing ? (
                <input
                  type="date"
                  value={editData.checkOut ? format(new Date(editData.checkOut), 'yyyy-MM-dd') : format(new Date(selectedReservation.checkOut), 'yyyy-MM-dd')}
                  onChange={e => handleEditChange('checkOut', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                format(new Date(selectedReservation.checkOut), 'dd/MM/yyyy')
              )}
            </div>

            {/* Monto total */}
            <div style={{ marginBottom: 8 }}>
              <b> Monto total:</b> {isEditing ? (
                <input
                  type="number"
                  value={editData.totalAmount || selectedReservation.totalAmount}
                  onChange={e => handleEditChange('totalAmount', parseFloat(e.target.value))}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                <a 
                  href={`/estado-de-cuentas?clientId=${selectedReservation.mainClientId}`}
                  onClick={(e) => { e.preventDefault(); window.location.href = `/estado-de-cuentas?clientId=${selectedReservation.mainClientId}`; }}
                  style={{ cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline', fontWeight: 'bold' }}
                  title="Ver detalles de cobros y pagos"
                >
                  ${selectedReservation.totalAmount?.toLocaleString('es-AR')}
                </a>
              )}
            </div>

            {/* Estado */}
            <div style={{ marginBottom: 8 }}>
              <b> Estado:</b> {isEditing ? (
                <select
                  value={editData.status || selectedReservation.status}
                >
                  <option value="PENDIENTE"> Pendiente</option>
                  <option value="CONFIRMADA"> Confirmada</option>
                  <option value="INGRESADA"> Ingresada</option>
                  <option value="FINALIZADA"> Finalizada</option>
                  <option value="CANCELADA"> Cancelada</option>
                  <option value="NO_PRESENTADA"> No presentada</option>
                </select>
              ) : (
                getStatusLabel(selectedReservation.status)
              )}
            </div>

            {/* Tipo de servicio */}
            <div style={{ marginBottom: 8 }}>
              <b> Tipo de servicio:</b> {isEditing ? (
                <select
                  value={editData.segments?.[0]?.services?.[0] || selectedReservation.segments?.[0]?.services?.[0] || ''}
                  onChange={e => {
                    // Actualizar el primer servicio del primer segmento
                    const newSegments = [...(editData.segments || selectedReservation.segments || [])];
                    if (newSegments[0]) {
                      newSegments[0].services = [e.target.value];
                      handleEditChange('segments', newSegments);
                    }
                  }}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  {serviceTypes.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              ) : (
                getServiceTypeName(selectedReservation.segments?.[0]?.services?.[0])
              )}
            </div>

            {/* Reservado por */}
            <div style={{ marginBottom: 8 }}>
              <b> Reservado por:</b>{' '}
              {isEditing ? (
                <select
                  value={editData.source ?? selectedReservation.source ?? ''}
                  onChange={(e) => handleEditChange('source', e.target.value || null)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  aria-label="Reservado por"
                >
                  <option value="">No especificado</option>
                  {RESERVATION_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                sourceLabel(selectedReservation.source)
              )}
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 8 }}>
              <b> Notas:</b> {isEditing ? (
                <textarea
                  value={editData.notes || selectedReservation.notes || ''}
                  onChange={e => handleEditChange('notes', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
                  placeholder="Notas adicionales..."
                />
              ) : (
                selectedReservation.notes || 'Sin notas'
              )}
            </div>
          </EditPanel>
        )}

        {panelMode === 'client' && selectedClient && (
          <EditPanel
            subtitle={`Cliente #${selectedClient.id}`}
            isEditing={isEditing}
            onEditToggle={handleEditToggle}
            onSave={handleEditSave}
            showDeleteButton={false}
          >
            {/* Nombre */}
            <div style={{ marginBottom: 8 }}>
              <b> Nombre:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.firstName || selectedClient.firstName}
                  onChange={e => handleEditChange('firstName', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.firstName
              )}
            </div>

            {/* Apellido */}
            <div style={{ marginBottom: 8 }}>
              <b> Apellido:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.lastName || selectedClient.lastName}
                  onChange={e => handleEditChange('lastName', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.lastName
              )}
            </div>

            {/* Email */}
            <div style={{ marginBottom: 8 }}>
              <b> Email:</b> {isEditing ? (
                <input
                  type="email"
                  value={editData.email || selectedClient.email || ''}
                  onChange={e => handleEditChange('email', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.email || 'No especificado'
              )}
            </div>

            {/* Teléfono */}
            <div style={{ marginBottom: 8 }}>
              <b> Teléfono:</b> {isEditing ? (
                <input
                  type="tel"
                  value={editData.phone || selectedClient.phone || ''}
                  onChange={e => handleEditChange('phone', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.phone || 'No especificado'
              )}
            </div>

            {/* Tipo de documento */}
            <div style={{ marginBottom: 8 }}>
              <b> Tipo de documento:</b> {isEditing ? (
                <select
                  value={editData.documentType || selectedClient.documentType}
                  onChange={e => handleEditChange('documentType', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="DNI"> DNI</option>
                  <option value="PASAPORTE"> Pasaporte</option>
                  <option value="CEDULA"> Cédula</option>
                  <option value="OTRO"> Otro</option>
                </select>
              ) : (
                selectedClient.documentType
              )}
            </div>

            {/* Número de documento */}
            <div style={{ marginBottom: 8 }}>
              <b> Número de documento:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.documentNumber || selectedClient.documentNumber || ''}
                  onChange={e => handleEditChange('documentNumber', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.documentNumber || 'No especificado'
              )}
            </div>

            {/* País */}
            <div style={{ marginBottom: 8 }}>
              <b> País:</b> {isEditing ? (
                <select
                  value={editData.country || selectedClient.country}
                  onChange={e => handleEditChange('country', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="AR"> Argentina</option>
                  <option value="BR"> Brasil</option>
                  <option value="CL"> Chile</option>
                  <option value="UY"> Uruguay</option>
                  <option value="PY"> Paraguay</option>
                  <option value="BO"> Bolivia</option>
                  <option value="PE"> Perú</option>
                  <option value="EC"> Ecuador</option>
                  <option value="CO"> Colombia</option>
                  <option value="VE"> Venezuela</option>
                  <option value="OTRO"> Otro</option>
                </select>
              ) : (
                selectedClient.country === 'AR' ? 'Argentina' :
                selectedClient.country === 'BR' ? 'Brasil' :
                selectedClient.country === 'CL' ? 'Chile' :
                selectedClient.country === 'UY' ? 'Uruguay' :
                selectedClient.country === 'PY' ? 'Paraguay' :
                selectedClient.country === 'BO' ? 'Bolivia' :
                selectedClient.country === 'PE' ? 'Perú' :
                selectedClient.country === 'EC' ? 'Ecuador' :
                selectedClient.country === 'CO' ? 'Colombia' :
                selectedClient.country === 'VE' ? 'Venezuela' :
                selectedClient.country
              )}
            </div>

            {/* Provincia */}
            <div style={{ marginBottom: 8 }}>
              <b> Provincia:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.province || selectedClient.province || ''}
                  onChange={e => handleEditChange('province', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.province || 'No especificada'
              )}
            </div>

            {/* Ciudad */}
            <div style={{ marginBottom: 8 }}>
              <b> Ciudad:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.city || selectedClient.city || ''}
                  onChange={e => handleEditChange('city', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.city || 'No especificada'
              )}
            </div>

            {/* Reservas del cliente */}
            <div style={{ marginBottom: 16 }}>
              <b> Reservas del cliente:</b>
              <div style={{ marginTop: '8px' }}>
                {reservations.filter(r => r.mainClientId === selectedClient.id).length > 0 ? (
                  reservations
                    .filter(r => r.mainClientId === selectedClient.id)
                    .map(reservation => (
                      <div key={reservation.id} style={{ 
                        marginBottom: '8px', 
                        padding: '8px', 
                        backgroundColor: '#fff', 
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleReservationClick(reservation)}
                      >
                        <div style={{ fontWeight: 'bold' }}>
                          Habitación {reservation.room?.name} - ${reservation.totalAmount?.toLocaleString('es-AR')}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                          {format(new Date(reservation.checkIn), 'dd/MM/yyyy')} - {format(new Date(reservation.checkOut), 'dd/MM/yyyy')}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                          Estado: {getStatusLabel(reservation.status)}
                        </div>
                      </div>
                    ))
                ) : (
                  <div style={{ color: '#666', fontStyle: 'italic' }}> No tiene reservas registradas</div>
                )}
              </div>
            </div>

            {/* Balance clickeable - solo en visualización, debajo de reservas */}
            {!isEditing && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <div 
                  style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  onClick={() => notify({ title: 'Próximamente', message: 'Panel de balance será implementado próximamente', type: 'info' })}
                  title="Ver detalles del balance"
                >
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}> Balance:</span>
                  <span style={{ 
                    fontWeight: 'bold', 
                    fontSize: '1.2rem',
                    color: clientBalance?.balance > 0 ? '#dc3545' : clientBalance?.balance < 0 ? '#28a745' : '#6c757d'
                  }}>
                    ${clientBalance?.balance ? Math.abs(clientBalance.balance).toLocaleString('es-AR') : '0'}
                    {clientBalance?.balance > 0 ? ' (Debe)' : clientBalance?.balance < 0 ? ' (A favor)' : ' (Saldo)'}
                  </span>
                </div>
              </div>
            )}
          </EditPanel>
        )}
      </SidePanel>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar Reserva"
        message="¿Estás seguro de que deseas eliminar esta reserva? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
      {confirmDialog}
      {noticeDialog}
    </div>
  );
}

export default ConsultasReservasView; 