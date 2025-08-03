import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { format } from 'date-fns';
import Header from './components/Header';
import ReservationBar from './components/ReservationBar';
import ReservationGrid from './components/ReservationGrid';
import RoomList from './components/RoomList';
import SidePanel from './components/SidePanel';
import EditPanel from './components/EditPanel';
import ConfirmationModal from './components/ConfirmationModal';
import CalendarioGestion from './pages/CalendarioGestion';
import LocationSelector from './components/LocationSelector';
import ConfiguracionView from './pages/Configuracion';
import EstadisticasView from './pages/Estadisticas';
import RatesCalendar from './components/RatesCalendar';
import ConsultasReservasView from './components/ConsultasReservasView';
import CobrosPagos from './pages/CobrosPagos';
import { TagsProvider } from './contexts/TagsContext';
import { useAppData } from './hooks/useAppData.js';
import { useSidePanel } from './hooks/useSidePanel.js';
import { updateReservationOnServer, updateClientOnServer } from './utils/apiUtils.js';
import { getDocumentAbbreviation } from './utils/documentUtils.js';
import { validateReservationConflict, validateReservationDates, showConflictNotification } from './utils/reservationUtils.js';
import { deleteReservation } from './services/api.js';
import styles from './styles/App.module.css';
import './index.css';

function ReservationsView() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const {
    rooms,
    clients,
    setClients,
    reservations,
    setReservations,
    operationalPeriods,
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
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Hotel Riviera - Gestión de Reservas</h1>
        <p className={styles.subtitle}>¡Bienvenido! Aquí podrás gestionar habitaciones, clientes y reservas.</p>
        <div className={styles.stats}>
          <span className={styles.statItem}>Habitaciones: {rooms.length}</span>
          <span className={styles.statItem}>Reservas: {reservations.length}</span>
          <span className={styles.statItem}>Clientes: {clients.length}</span>
        </div>
      </div>
      <div className={styles.gridWrapper}>
        <ReservationGrid 
          rooms={rooms} 
          reservations={reservations}
          setReservations={setReservations}
          updateReservation={(id, data) => updateReservationOnServer(id, data, setReservations)}
          onReservationClick={handleReservationClick}
          operationalPeriods={operationalPeriods}
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

            {/* Estado */}
            <div style={{ marginBottom: 8 }}>
              <b>Estado:</b> {isEditing ? (
                <select
                  value={editData.status || selectedReservation.status}
                  onChange={e => handleEditChange('status', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="active">Activa</option>
                  <option value="finished">Finalizada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              ) : (
                selectedReservation.status === 'active' ? 'Activa' : 
                selectedReservation.status === 'finished' ? 'Finalizada' : 'Cancelada'
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
                  placeholder="0.00"
                  step="0.01"
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

            {/* Notas */}
            <div style={{ marginBottom: 8 }}>
              <b>Notas:</b> {isEditing ? (
                <textarea
                  value={editData.notes || selectedReservation.notes || ''}
                  onChange={e => handleEditChange('notes', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px', resize: 'vertical' }}
                  placeholder="Notas adicionales..."
                />
              ) : (
                selectedReservation.notes || 'Sin notas'
              )}
            </div>

            {/* Huéspedes */}
            <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <b>Huéspedes:</b>
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>Cantidad:</span>
                    <input
                      type="number"
                      min="1"
                      value={editData.requiredGuests || selectedReservation.requiredGuests || 1}
                      onChange={e => handleEditChange('requiredGuests', parseInt(e.target.value))}
                      style={{ 
                        fontSize: '1rem', 
                        width: '60px', 
                        padding: '4px 8px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>
                    {(selectedReservation.guests?.length || 0) + 1} persona{(selectedReservation.guests?.length || 0) + 1 > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              <div style={{ marginTop: '8px' }}>
                {/* Cliente principal */}
                <div style={{ 
                  marginBottom: '8px', 
                  padding: '8px', 
                  backgroundColor: '#fff', 
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  borderLeft: '4px solid #007bff'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#007bff' }}>
                    {selectedReservation.mainClient?.firstName} {selectedReservation.mainClient?.lastName} (Cliente principal)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {selectedReservation.mainClient?.documentType} {selectedReservation.mainClient?.documentNumber}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {selectedReservation.mainClient?.email} • {selectedReservation.mainClient?.phone}
                  </div>
                </div>
                
                {/* Huéspedes adicionales */}
                {selectedReservation.guests && selectedReservation.guests.length > 0 ? (
                  selectedReservation.guests.map(guest => (
                    <div key={guest.id} style={{ 
                      marginBottom: '8px', 
                      padding: '8px', 
                      backgroundColor: '#fff', 
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {guest.firstName} {guest.lastName}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {guest.documentType} {guest.documentNumber}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {guest.email} • {guest.phone}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ 
                    marginBottom: '8px', 
                    padding: '8px', 
                    backgroundColor: '#fff', 
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    borderStyle: 'dashed',
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: '#666',
                    fontStyle: 'italic'
                  }}
                  onClick={() => alert('Funcionalidad para completar datos de huéspedes será implementada próximamente')}
                  title="Completar datos de huéspedes"
                  >
                    + Completar datos de huéspedes
                  </div>
                )}
              </div>
            </div>
          </EditPanel>
        )}

        {panelMode === 'client' && selectedClient && (
          <EditPanel
            subtitle={`Cliente #${selectedClient.id}`}
            isEditing={isEditing}
            onEditToggle={handleEditToggle}
            onSave={handleEditSave}
          >
            {/* Nombre y Apellido */}
            <div style={{ marginBottom: 16 }}>
              {isEditing ? (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>Nombre:</label>
                    <input
                      type="text"
                      value={editData.firstName || ''}
                      onChange={e => handleEditChange('firstName', e.target.value)}
                      style={{ fontWeight: 600, fontSize: '1.2rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      placeholder="Nombre"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>Apellido:</label>
                    <input
                      type="text"
                      value={editData.lastName || ''}
                      onChange={e => handleEditChange('lastName', e.target.value)}
                      style={{ fontWeight: 600, fontSize: '1.2rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      placeholder="Apellido"
                    />
                  </div>
                </div>
              ) : (
                <div style={{ fontWeight: 600, fontSize: '1.35rem', marginBottom: 12 }}>
                  {selectedClient.firstName} {selectedClient.lastName}
                </div>
              )}
            </div>

            {/* Documento - solo en edición */}
            {isEditing && (
              <div style={{ marginBottom: 16 }}>
                <b>Documento:</b>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '4px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>Tipo:</label>
                    <select
                      value={editData.documentType || 'DNI'}
                      onChange={e => handleEditChange('documentType', e.target.value)}
                      style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="DNI">DNI</option>
                      <option value="CÉDULA DE IDENTIDAD">CÉDULA DE IDENTIDAD</option>
                      <option value="CUIT">CUIT</option>
                      <option value="LIBRETA CÍVICA">LIBRETA CÍVICA</option>
                      <option value="LIBRETA DE ENROLAMENTO">LIBRETA DE ENROLAMENTO</option>
                      <option value="LIBRETA DE EMBARQUE">LIBRETA DE EMBARQUE</option>
                      <option value="PASAPORTE">PASAPORTE</option>
                      <option value="OTRO">OTRO</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>Número:</label>
                    <input
                      type="text"
                      value={editData.documentNumber || ''}
                      onChange={e => handleEditChange('documentNumber', e.target.value)}
                      style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      placeholder="12345678"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Documento en visualización - sin palabra "Documento" y con abreviación */}
            {!isEditing && (
              <div style={{ marginBottom: 8, fontSize: '1rem', color: '#666' }}>
                {getDocumentAbbreviation(selectedClient.documentType || 'DNI')} {selectedClient.documentNumber || 'No especificado'}
              </div>
            )}

            {/* Email con validación */}
            <div style={{ marginBottom: 8 }}>
              <b>Email:</b> {isEditing ? (
                <div>
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={e => handleEditChange('email', e.target.value)}
                    style={{ 
                      fontSize: '1rem', 
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      borderColor: editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email) ? '#ff4444' : '#ddd'
                    }}
                    placeholder="ejemplo@email.com"
                  />
                  {editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email) && (
                    <div style={{ fontSize: '0.8rem', color: '#ff4444', marginTop: '4px' }}>
                      Formato de email inválido
                    </div>
                  )}
                </div>
              ) : (
                selectedClient.email || 'No especificado'
              )}
            </div>

            {/* Teléfono */}
            <div style={{ marginBottom: 8 }}>
              <b>Teléfono:</b> {isEditing ? (
                <input
                  type="tel"
                  value={editData.phone || ''}
                  onChange={e => handleEditChange('phone', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  placeholder="+54 11 1234-5678"
                />
              ) : (
                selectedClient.phone || 'No especificado'
              )}
            </div>

            {/* Ubicación */}
            <div style={{ marginBottom: 8 }}>
              <b>Ubicación:</b> {isEditing ? (
                <div style={{ marginTop: '8px' }}>
                  <LocationSelector
                    country={editData.country || ''}
                    province={editData.province || ''}
                    city={editData.city || ''}
                    onCountryChange={(value) => handleEditChange('country', value)}
                    onProvinceChange={(value) => handleEditChange('province', value)}
                    onCityChange={(value) => handleEditChange('city', value)}
                  />
                </div>
              ) : (
                <div>
                  {selectedClient.country && (
                    <div>País: {selectedClient.country}</div>
                  )}
                  {selectedClient.province && (
                    <div>Provincia: {selectedClient.province}</div>
                  )}
                  {selectedClient.city && (
                    <div>Ciudad: {selectedClient.city}</div>
                  )}
                  {!selectedClient.country && !selectedClient.province && !selectedClient.city && (
                    <span>No especificada</span>
                  )}
                </div>
              )}
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 8 }}>
              <b>Notas:</b> {isEditing ? (
                <textarea
                  value={editData.notes || selectedClient.notes || ''}
                  onChange={e => handleEditChange('notes', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px', resize: 'vertical' }}
                  placeholder="Notas sobre el cliente..."
                />
              ) : (
                selectedClient.notes || 'Sin notas'
              )}
            </div>

            {/* Reservas del cliente - solo en visualización */}
            {!isEditing && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
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
                            Estado: {reservation.status === 'active' ? 'Activa' : reservation.status === 'finished' ? 'Finalizada' : 'Cancelada'}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>No tiene reservas registradas</div>
                  )}
                </div>
              </div>
            )}

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

function CalendarioGestionView() {
  return <CalendarioGestion />;
}

function ConsultasReservasViewWrapper() {
  return <ConsultasReservasView />;
}

function TarifasView() {
  return <RatesCalendar />;
}

function CobrosPagosView() {
  return <CobrosPagos />;
}

function App() {
  return (
    <TagsProvider>
      <Router>
        <div className={styles.app}>
          <Header />
          <Routes>
            <Route path="/" element={<ReservationsView />} />
            <Route path="/libro-de-reservas" element={<ReservationsView />} />
            <Route path="/consultas-reservas" element={<ConsultasReservasViewWrapper />} />
            <Route path="/tarifas" element={<TarifasView />} />
            <Route path="/cobros-pagos" element={<CobrosPagosView />} />
            <Route path="/estadisticas" element={<EstadisticasView />} />
            <Route path="/configuracion" element={<ConfiguracionView />} />
          </Routes>
        </div>
      </Router>
    </TagsProvider>
  );
}

export default App;
