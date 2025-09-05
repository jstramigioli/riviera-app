import React, { useState } from 'react';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { useAppData } from '../hooks/useAppData';
import { useSidePanel } from '../hooks/useSidePanel';
import { format } from 'date-fns';
import { updateReservationOnServer, updateClientOnServer } from '../utils/apiUtils';
import { deleteReservation } from '../services/api';
import { validateReservationDates, validateReservationConflict, showConflictNotification } from '../utils/reservationUtils';
import ReservationsTable from './ReservationsTable';
import SidePanel from './SidePanel';
import EditPanel from './EditPanel';
import ConfirmationModal from './ConfirmationModal';
import ErrorDisplay from './ErrorDisplay';
import styles from '../styles/App.module.css';

function ConsultasReservasView() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const {
    rooms,
    clients,
    setClients,
    reservations,
    setReservations,
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

  async function handleEditSave() {
    try {
      if (panelMode === 'reservation') {
        // Validar fechas primero
        const dateValidation = validateReservationDates(editData.checkIn, editData.checkOut);
        if (!dateValidation.isValid) {
          alert(`Error de validación: ${dateValidation.message}`);
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
          showConflictNotification(conflict.message);
          return;
        }
        
        const updated = await updateReservationOnServer(editData.id, editData, setReservations);
        setIsEditing(false);
        setSelectedReservation(updated);
        setEditData(updated);
      } else {
        // Validar email antes de guardar
        if (editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email)) {
          alert('Por favor, ingrese un formato de email válido');
          return;
        }
        
        const updated = await updateClientOnServer(editData.id, editData, setClients, setReservations);
        setIsEditing(false);
        setSelectedClient(updated);
        setEditData(updated);
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedReservation) return;
    try {
      await deleteReservation(selectedReservation.id);
      setReservations(reservations.filter(r => r.id !== selectedReservation.id));
      closePanel();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      alert(`Error al eliminar la reserva: ${error.message}`);
    }
  };

  if (loading) return <div className={styles.loading}>Cargando datos...</div>;
  if (error) return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Hotel Riviera - Consultas y Reservas</h1>
        <p className={styles.subtitle}>Consulta el listado completo de reservas con filtros y búsqueda avanzada.</p>
        <div className={styles.stats}>
          <span className={styles.statItem}>Habitaciones: {rooms.length}</span>
          <span className={styles.statItem}>Reservas: {reservations.length}</span>
          <span className={styles.statItem}>Clientes: {clients.length}</span>
        </div>
      </div>
      <div className={styles.gridWrapper}>
        <ReservationsTable 
          reservations={reservations}
          rooms={rooms}
          clients={clients}
          onReservationClick={handleReservationClick}
        />
      </div>
      <SidePanel
        open={sidePanelOpen}
        onClose={closePanel}
        title={panelMode === 'reservation' ? "DATOS DE LA RESERVA" : "DATOS DEL CLIENTE"}
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
              <b>Habitación:</b> {isEditing ? (
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
                selectedReservation.room?.name
              )}
            </div>

            {/* Cliente principal */}
            <div style={{ marginBottom: 8 }}>
              <b>Cliente principal:</b> {isEditing ? (
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
                <span 
                  style={{ cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}
                  onClick={() => handleClientClick(clients.find(c => c.id === selectedReservation.mainClientId))}
                >
                  {selectedReservation.mainClient?.firstName} {selectedReservation.mainClient?.lastName}
                </span>
              )}
            </div>

            {/* Fechas */}
            <div style={{ marginBottom: 8 }}>
              <b>Check-in:</b> {isEditing ? (
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
              <b>Check-out:</b> {isEditing ? (
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
              <b>Monto total:</b> {isEditing ? (
                <input
                  type="number"
                  value={editData.totalAmount || selectedReservation.totalAmount}
                  onChange={e => handleEditChange('totalAmount', parseFloat(e.target.value))}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                <span 
                  style={{ 
                    cursor: 'pointer', 
                    color: '#3b82f6', 
                    textDecoration: 'underline',
                    fontWeight: 'bold'
                  }}
                  onClick={() => window.location.href = `/cobros-pagos?clientId=${selectedReservation.mainClientId}`}
                  title="Ver detalles de cobros y pagos"
                >
                  ${selectedReservation.totalAmount?.toLocaleString('es-AR')}
                </span>
              )}
            </div>

            {/* Estado */}
            <div style={{ marginBottom: 8 }}>
              <b>Estado:</b> {isEditing ? (
                <select
                  value={editData.status || selectedReservation.status}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="ingresada">Ingresada</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="no presentada">No presentada</option>
                </select>
              ) : (
                getStatusLabel(selectedReservation.status)
              )}
            </div>

            {/* Tipo de reserva */}
            <div style={{ marginBottom: 8 }}>
              <b>Tipo de reserva:</b> {isEditing ? (
                <select
                  value={editData.reservationType || selectedReservation.reservationType}
                  onChange={e => handleEditChange('reservationType', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="con_desayuno">Con desayuno</option>
                  <option value="media_pension">Media pensión</option>
                  <option value="pension_completa">Pensión completa</option>
                  <option value="solo_alojamiento">Solo alojamiento</option>
                </select>
              ) : (
                selectedReservation.reservationType === 'con_desayuno' ? 'Con desayuno' :
                selectedReservation.reservationType === 'media_pension' ? 'Media pensión' :
                selectedReservation.reservationType === 'pension_completa' ? 'Pensión completa' :
                selectedReservation.reservationType === 'solo_alojamiento' ? 'Solo alojamiento' :
                selectedReservation.reservationType
              )}
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 8 }}>
              <b>Notas:</b> {isEditing ? (
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
              <b>Nombre:</b> {isEditing ? (
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
              <b>Apellido:</b> {isEditing ? (
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
              <b>Email:</b> {isEditing ? (
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
              <b>Teléfono:</b> {isEditing ? (
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
              <b>Tipo de documento:</b> {isEditing ? (
                <select
                  value={editData.documentType || selectedClient.documentType}
                  onChange={e => handleEditChange('documentType', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="DNI">DNI</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="CEDULA">Cédula</option>
                  <option value="OTRO">Otro</option>
                </select>
              ) : (
                selectedClient.documentType
              )}
            </div>

            {/* Número de documento */}
            <div style={{ marginBottom: 8 }}>
              <b>Número de documento:</b> {isEditing ? (
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
              <b>País:</b> {isEditing ? (
                <select
                  value={editData.country || selectedClient.country}
                  onChange={e => handleEditChange('country', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="AR">Argentina</option>
                  <option value="BR">Brasil</option>
                  <option value="CL">Chile</option>
                  <option value="UY">Uruguay</option>
                  <option value="PY">Paraguay</option>
                  <option value="BO">Bolivia</option>
                  <option value="PE">Perú</option>
                  <option value="EC">Ecuador</option>
                  <option value="CO">Colombia</option>
                  <option value="VE">Venezuela</option>
                  <option value="OTRO">Otro</option>
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
              <b>Provincia:</b> {isEditing ? (
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
              <b>Ciudad:</b> {isEditing ? (
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
              <b>Reservas del cliente:</b>
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
                  <div style={{ color: '#666', fontStyle: 'italic' }}>No tiene reservas registradas</div>
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
                  onClick={() => alert('Panel de balance será implementado próximamente')}
                  title="Ver detalles del balance"
                >
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Balance:</span>
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
    </div>
  );
}

export default ConsultasReservasView; 