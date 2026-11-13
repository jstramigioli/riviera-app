import React, { useState } from 'react';
import { getStatusLabel } from "./utils/reservationStatusUtils";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Header from './components/Header';
import LibroReservasBoard from './components/LibroReservasBoard';
import RoomList from './components/RoomList';
import SidePanel from './components/SidePanel';
import EditPanel from './components/EditPanel';
import ConfirmationModal from './components/ConfirmationModal';
import CalendarioGestion from './pages/CalendarioGestion';
import LocationSelector from './components/LocationSelector';
import ConfiguracionView from './pages/Configuracion';
import EstadisticasView from './pages/Estadisticas';
import ConsultasReservasView from './components/ConsultasReservasView';
import CobrosPagos from './pages/CobrosPagos';
import Consulta from './pages/Consulta';
import ErrorDisplay from './components/ErrorDisplay';
import { TagsProvider } from './contexts/TagsContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import { useAppData } from './hooks/useAppData.js';
import { useSidePanel } from './hooks/useSidePanel.js';
import { updateReservationOnServer, updateClientOnServer, updateReservationStatusOnServer } from './utils/apiUtils.js';
import { validateReservationConflict, validateReservationDates, showConflictNotification } from './utils/reservationUtils.js';
import { buildConsultaEditPath, buildConsultaEditState } from './utils/consultaNavigation.js';
import { deleteReservation } from './services/api.js';
import styles from './styles/App.module.css';
import './index.css';
import ReservationDetailsPanel from './components/ReservationDetailsPanel';
import ConsumptionOrderModal from './components/ConsumptionOrderModal';
import NotificationModal from './components/NotificationModal';
import ClientDetails from './pages/ClientDetails';
import ReservationDetails from './pages/ReservationDetails';
import RoomDetails from './pages/RoomDetails';
import PublicCheckIn from './pages/PublicCheckIn';

function firstRoomIdFromReservation(reservation) {
  const segments = reservation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const withRoom = segments.find((s) => s?.roomId != null);
  return withRoom?.roomId ?? null;
}

function ReservationsView() {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [consumptionPreset, setConsumptionPreset] = useState(null);
  const [notificationModal, setNotificationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const openConsumptionModal = (preset = null) => {
    setConsumptionPreset(preset);
    setConsumptionOpen(true);
  };

  const closeConsumptionModal = () => {
    setConsumptionOpen(false);
    setConsumptionPreset(null);
  };

  const showNotification = (title, message, type = 'success') => {
    setNotificationModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const closeNotification = () => {
    setNotificationModal(prev => ({ ...prev, isOpen: false }));
  };
  
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
          showNotification('Validación', dateValidation.message, 'warning');
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
          showNotification('Conflicto', notice.message, 'error');
          return;
        }
        
        const updated = await updateReservationOnServer(editData.id, editData, setReservations);
        setIsEditing(false);
        setSelectedReservation(updated);
        setEditData(updated);
      } else {
        // Validar email antes de guardar
        if (editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email)) {
          showNotification('Validación', 'Por favor, ingrese un formato de email válido', 'warning');
          return;
        }
        
        const updated = await updateClientOnServer(editData.id, editData, setClients, setReservations);
        setIsEditing(false);
        setSelectedClient(updated);
        setEditData(updated);
      }
    } catch (error) {
      console.error('Error saving:', error);
      showNotification('Error', error.message || 'Error de conexión. Los cambios se han revertido.', 'error');
    }
  }

  // Eliminado: handleDeleteClick no utilizado

  const handleDeleteConfirm = async () => {
    if (!selectedReservation) return;
    try {
      await deleteReservation(selectedReservation.id);
      setReservations(reservations.filter(r => r.id !== selectedReservation.id));
      setCalendarRefreshToken((t) => t + 1);
      closePanel();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      showNotification(
        "Error",
        `Error al eliminar la reserva: ${error.message}`,
        "error"
      );
    }
  };

  const handleStatusChange = async (reservationId, newStatus, actionType) => {
    try {
      // Llamar al API específico para actualizar solo el estado
      await updateReservationStatusOnServer(reservationId, newStatus, setReservations);
      
      // Actualizar la reserva seleccionada si es la misma
      if (selectedReservation && selectedReservation.id === reservationId) {
        const updatedReservation = { ...selectedReservation, status: newStatus };
        setSelectedReservation(updatedReservation);
      }

      // Refrescar Libro para que canceladas / no-show desaparezcan al instante
      setCalendarRefreshToken((t) => t + 1);
      
      // Mostrar notificación de éxito
      const actionMessages = {
        "confirm": "Reserva confirmada exitosamente",
        "cancel": "Reserva cancelada exitosamente",
        "check-in": "Check-in registrado exitosamente",
        "check-out": "Check-out registrado exitosamente",
        "no-show": "Reserva marcada como no presentada",
        "reopen": "Estadía reabierta exitosamente",
        "reactivate": "Reserva reactivada exitosamente",
        "set-status": "Estado actualizado exitosamente"
      };
      
      showNotification(
        "¡Éxito!",
        actionMessages[actionType] || "Estado actualizado exitosamente",
        "success"
      );
      
    } catch (error) {
      console.error("Error updating reservation status:", error);
      showNotification(
        "Error",
        `Error al actualizar el estado de la reserva: ${error.message}`,
        "error"
      );
    }
  };

  if (loading) return <div className={styles.loading}> Cargando datos...</div>;
  if (error) return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className={styles.appContainer}>
      <div className={styles.gridWrapper}>
        <LibroReservasBoard
          onReservationClick={handleReservationClick}
          reservationsForDayInfo={reservations}
          refreshToken={calendarRefreshToken}
          onCreateConsumption={() => openConsumptionModal(null)}
        />
      </div>
      <ConsumptionOrderModal
        open={consumptionOpen}
        preset={consumptionPreset}
        onClose={closeConsumptionModal}
        onSaved={() => setCalendarRefreshToken((n) => n + 1)}
      />
      <SidePanel
        open={sidePanelOpen}
        onClose={closePanel}
        title=""
        width={600}
        hideHeader={panelMode === 'reservation'}
      >
        {panelMode === 'reservation' && selectedReservation && (
          <ReservationDetailsPanel
            reservation={selectedReservation}
            onStatusChange={handleStatusChange}
            onDelete={() => setShowDeleteModal(true)}
            onClose={closePanel}
            onAddConsumo={(res) => {
              openConsumptionModal({
                reservationId: res.id,
                roomId: firstRoomIdFromReservation(res)
              });
            }}
            onOpenFullEdit={(id) => {
              closePanel();
              navigate(buildConsultaEditPath(id), {
                state: buildConsultaEditState(id)
              });
            }}
          />
        )}

        {panelMode === 'client' && selectedClient && (
          <EditPanel
            data={editData}
            onChange={handleEditChange}
            isEditing={isEditing}
            onToggleEdit={handleEditToggle}
            onSave={handleEditSave}
            type="client"
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
                  value={editData.email || selectedClient.email}
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
                  value={editData.phone || selectedClient.phone}
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
                  <option value="Pasaporte"> Pasaporte</option>
                  <option value="Cédula"> Cédula</option>
                  <option value="Otro"> Otro</option>
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
                  value={editData.documentNumber || selectedClient.documentNumber}
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
                <input
                  type="text"
                  value={editData.country || selectedClient.country}
                  onChange={e => handleEditChange('country', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.country || 'No especificado'
              )}
            </div>

            {/* Provincia */}
            <div style={{ marginBottom: 8 }}>
              <b> Provincia:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.province || selectedClient.province}
                  onChange={e => handleEditChange('province', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.province || 'No especificado'
              )}
            </div>

            {/* Ciudad */}
            <div style={{ marginBottom: 8 }}>
              <b> Ciudad:</b> {isEditing ? (
                <input
                  type="text"
                  value={editData.city || selectedClient.city}
                  onChange={e => handleEditChange('city', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              ) : (
                selectedClient.city || 'No especificado'
              )}
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 8 }}>
              <b> Notas:</b> {isEditing ? (
                <textarea
                  value={editData.notes || selectedClient.notes}
                  onChange={e => handleEditChange('notes', e.target.value)}
                  style={{ fontSize: '1rem', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
                  placeholder="Agregar notas..."
                />
              ) : (
                selectedClient.notes || 'Sin notas'
              )}
            </div>

            {/* Reservas del cliente - solo en visualización */}
            {!isEditing && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
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
                  onClick={() => showNotification('Próximamente', 'Panel de balance será implementado próximamente', 'info')}
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
      
      <NotificationModal
        isOpen={notificationModal.isOpen}
        onClose={closeNotification}
        title={notificationModal.title}
        message={notificationModal.message}
        type={notificationModal.type}
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

function CobrosPagosView() {
  return <CobrosPagos />;
}

function AppShell({ children }) {
  return (
    <div className={styles.app}>
      <Header />
      {children}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <TagsProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/check-in/:token" element={<PublicCheckIn />} />
            <Route
              path="/"
              element={(
                <ProtectedRoute permission="reservas">
                  <AppShell><ReservationsView /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/libro-de-reservas"
              element={(
                <ProtectedRoute permission="reservas">
                  <AppShell><ReservationsView /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/consultas-reservas"
              element={(
                <ProtectedRoute permission="reservas">
                  <AppShell><ConsultasReservasViewWrapper /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/consulta/:reservationId?"
              element={(
                <ProtectedRoute permission="reservas">
                  <AppShell><Consulta /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/reservations/:reservationId"
              element={(
                <ProtectedRoute permission="reservas">
                  <AppShell><ReservationDetails /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/clients/:clientId"
              element={(
                <ProtectedRoute permission="clientes">
                  <AppShell><ClientDetails /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/rooms/:roomId"
              element={(
                <ProtectedRoute permission="reservas">
                  <AppShell><RoomDetails /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/tarifas"
              element={<Navigate to="/configuracion?tab=cargos-tarifas" replace />}
            />
            <Route
              path="/tarifas/calendario"
              element={<Navigate to="/configuracion?tab=cargos-tarifas" replace />}
            />
            <Route
              path="/precios-inteligentes"
              element={<Navigate to="/configuracion?tab=cargos-tarifas" replace />}
            />
            <Route
              path="/cobros-pagos"
              element={(
                <ProtectedRoute permission="finanzas">
                  <AppShell><CobrosPagosView /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/estadisticas"
              element={(
                <ProtectedRoute permission="reportes">
                  <AppShell><EstadisticasView /></AppShell>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/auditoria"
              element={<Navigate to="/configuracion?tab=auditoria" replace />}
            />
            <Route
              path="/configuracion"
              element={(
                <ProtectedRoute permission={['settings', 'auditoria']}>
                  <AppShell><ConfiguracionView /></AppShell>
                </ProtectedRoute>
              )}
            />
          </Routes>
        </Router>
      </TagsProvider>
    </AuthProvider>
  );
}

export default App;
