import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  fetchReservations,
  fetchRooms,
  fetchClients,
  updateReservation,
  API_URL,
  getReservationFinancialSummary,
  createCargo,
  updateCargo,
  deleteCargo
} from '../services/api.js';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import { validateReservationDates, validateReservationConflict, showConflictNotification } from '../utils/reservationUtils';
import ReservationStatusButtons from '../components/ReservationStatusButtons';
import GeneralInfoTab from '../components/ReservationTabs/GeneralInfoTab';
import EstadoFinancieroTab from '../components/ReservationTabs/EstadoFinancieroTab';
import HuespedesTab from '../components/ReservationTabs/HuespedesTab';
import { FaTrash, FaPen, FaTimes, FaSave } from 'react-icons/fa';
import styles from './ReservationDetails.module.css';

const ReservationDetails = () => {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estado principal
  const [reservation, setReservation] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [clients, setClients] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado de pestañas (puede venir del panel del Libro vía location.state)
  const [activeTab, setActiveTab] = useState(
    location.state?.activeTab === 'financiero' ? 'financiero' : 'general'
  );
  const [pendingFinancialAction, setPendingFinancialAction] = useState(
    location.state?.financialAction || null
  );
  
  // Estado financiero
  const [financialSummary, setFinancialSummary] = useState(null);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  
  // Estado para modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estado para tipos de servicio
  const [serviceTypes, setServiceTypes] = useState([]);

  // Edición
  const [isEditing, setIsEditing] = useState(Boolean(location.state?.isEditing));
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const loadReservationData = async () => {
      try {
        setLoading(true);
        
        const [reservationsData, roomsData, clientsData, serviceTypesResponse] = await Promise.all([
          fetchReservations(),
          fetchRooms(),
          fetchClients(),
          fetch('http://localhost:3001/api/service-types?hotelId=default-hotel').then(res => res.json())
        ]);
        
        const foundReservation = reservationsData.find(r => r.id === parseInt(reservationId));
        
        if (!foundReservation) {
          setError('Reserva no encontrada');
          setLoading(false);
          return;
        }
        
        setReservation(foundReservation);
        setEditData(foundReservation);
        setAllReservations(reservationsData);
        setRooms(roomsData);
        setClients(clientsData);
        setServiceTypes(serviceTypesResponse.data || []);
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos de la reserva:', error);
        setError('Error al cargar los datos de la reserva');
        setLoading(false);
      }
    };

    if (reservationId) {
      loadReservationData();
    }
  }, [reservationId]);

  useEffect(() => {
    if (location.state?.isEditing) {
      setIsEditing(true);
      setActiveTab('general');
    }
  }, [location.state?.isEditing]);

  useEffect(() => {
    if (location.state?.activeTab === 'financiero' || location.state?.financialAction) {
      setActiveTab('financiero');
      if (location.state?.financialAction) {
        setPendingFinancialAction(location.state.financialAction);
      }
      // Limpiar state para no re-disparar al volver con el historial
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.activeTab, location.state?.financialAction, location.pathname, navigate]);

  // Cargar datos financieros en la pestaña Estado financiero
  useEffect(() => {
    if (activeTab === 'financiero' && reservation) {
      loadFinancialData();
    }
  }, [activeTab, reservation]);

  const loadFinancialData = async () => {
    if (!reservation) return;
    
    try {
      setLoadingFinancial(true);
      const summary = await getReservationFinancialSummary(reservation.id);
      setFinancialSummary(summary);
    } catch (error) {
      console.error('Error cargando datos financieros:', error);
    } finally {
      setLoadingFinancial(false);
    }
  };

  const handleAddCargo = async (cargoData) => {
    try {
      await createCargo(reservation.id, cargoData);
      await loadFinancialData();
      alert('Cargo agregado exitosamente');
    } catch (error) {
      console.error('Error agregando cargo:', error);
      alert(`Error: ${error.message}`);
      throw error;
    }
  };

  const handleUpdateCargo = async (cargoId, cargoData) => {
    try {
      await updateCargo(cargoId, cargoData);
      await loadFinancialData();
    } catch (error) {
      console.error('Error actualizando cargo:', error);
      alert(`Error: ${error.message}`);
      throw error;
    }
  };

  const handleDeleteCargo = async (cargoId) => {
    try {
      await deleteCargo(cargoId);
      await loadFinancialData();
    } catch (error) {
      console.error('Error eliminando cargo:', error);
      alert(`Error: ${error.message}`);
      throw error;
    }
  };

  // Utilidades
  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    try {
      // Fechas civiles yyyy-MM-dd: parsear en local para evitar off-by-one UTC
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateString))) {
        const [y, m, d] = String(dateString).split('-').map(Number);
        return format(new Date(y, m - 1, d), 'dd/MM/yyyy', { locale: es });
      }
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getServiceTypeLabel = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    return serviceType ? serviceType.name : serviceTypeId;
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleClientClick = () => {
    if (reservation?.mainClient?.id) {
      navigate(`/clients/${reservation.mainClient.id}`);
    }
  };

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...(prev || reservation), [field]: value }));
  };

  const handleClientCreated = (createdClient) => {
    if (!createdClient?.id) return;
    setClients((prev) => {
      if (prev.some((c) => c.id === createdClient.id)) return prev;
      return [...prev, createdClient].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es')
      );
    });
    setEditData((prev) => ({
      ...(prev || reservation),
      mainClientId: createdClient.id,
      mainClient: createdClient
    }));
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditData(reservation);
      setIsEditing(false);
      return;
    }
    setEditData(reservation);
    setIsEditing(true);
    setActiveTab('general');
  };

  const handleEditSave = async () => {
    if (!editData) return;

    const dateValidation = validateReservationDates(editData.checkIn, editData.checkOut);
    if (!dateValidation.isValid) {
      alert(`Error de validación: ${dateValidation.message}`);
      return;
    }

    const conflict = validateReservationConflict(
      allReservations,
      editData.roomId,
      editData.checkIn,
      editData.checkOut,
      editData.id
    );

    if (conflict.hasConflict) {
      showConflictNotification(conflict.message);
      return;
    }

    try {
      setSaving(true);
      const updated = await updateReservation(editData.id, editData);
      setReservation(updated);
      setEditData(updated);
      setAllReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setIsEditing(false);
      alert('Reserva actualizada');
    } catch (err) {
      console.error('Error guardando reserva:', err);
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReservation = async () => {
    try {
      const response = await fetch(`${API_URL}/reservations/${reservationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la reserva');
      }

      navigate(-1);
    } catch (error) {
      console.error('Error eliminando reserva:', error);
      alert('Error al eliminar la reserva');
    }
  };

  const handleStatusChange = async (reservationId, newStatus, actionType) => {
    try {
      console.log('Status change:', reservationId, newStatus, actionType);
      
      // Enviar petición al backend para actualizar el estado
      const response = await fetch(`${API_URL}/reservations/${reservationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el estado de la reserva');
      }

      const updatedReservation = await response.json();
      console.log('Reserva actualizada:', updatedReservation);
      
      // Actualizar el estado local
      setReservation(updatedReservation);
    } catch (error) {
      console.error('Error actualizando estado de la reserva:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Renderizar contenido de cada pestaña
  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralInfoTab
            reservation={reservation}
            editData={editData}
            isEditing={isEditing}
            rooms={rooms}
            clients={clients}
            serviceTypes={serviceTypes}
            onEditChange={handleEditChange}
            onClientCreated={handleClientCreated}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            getServiceTypeLabel={getServiceTypeLabel}
            getStatusLabel={getStatusLabel}
          />
        );
      case 'financiero':
        return (
          <EstadoFinancieroTab
            reservation={reservation}
            financialSummary={financialSummary}
            loadingFinancial={loadingFinancial}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            onFinancialChange={loadFinancialData}
            onAddCargo={handleAddCargo}
            onUpdateCargo={handleUpdateCargo}
            onDeleteCargo={handleDeleteCargo}
            pendingAction={pendingFinancialAction}
            onPendingActionHandled={() => setPendingFinancialAction(null)}
          />
        );
      case 'huespedes':
        return (
          <HuespedesTab
            reservation={reservation}
            onClientClick={handleClientClick}
          />
        );
      default:
        return null;
    }
  };

  // Componente de loading
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando detalles de la reserva...</div>
      </div>
    );
  }

  // Componente de error
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleBackClick} className={styles.backButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Componente si no encuentra la reserva
  if (!reservation) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Reserva no encontrada</h2>
          <p>La reserva con ID {reservationId} no existe.</p>
          <button onClick={handleBackClick} className={styles.backButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Render principal
  return (
    <div className={styles.newLayout}>
      {/* Side / top panel */}
      <div className={styles.sidePanel}>
        <div className={styles.sidePanelHeader}>
          <div className={styles.sidePanelHeaderTop}>
            <h2>Reserva #{reservation.id}</h2>
            <div className={styles.headerActions}>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    className={styles.headerIconBtn}
                    disabled={saving}
                    title={saving ? 'Guardando…' : 'Guardar cambios'}
                    aria-label="Guardar cambios"
                  >
                    <FaSave />
                  </button>
                  <button
                    type="button"
                    onClick={handleEditToggle}
                    className={`${styles.headerIconBtn} ${styles.headerIconBtnDanger}`}
                    title="Salir de edición"
                    aria-label="Salir de edición"
                  >
                    <FaTimes />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEditToggle}
                  className={styles.headerIconBtn}
                  title="Editar reserva"
                  aria-label="Editar reserva"
                >
                  <FaPen />
                </button>
              )}
            </div>
          </div>
          <div className={styles.guestInfo}>
            <div className={styles.guestName}>
              {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
            </div>
            <div className={styles.guestDates}>
              {formatDate(reservation.checkIn)} / {formatDate(reservation.checkOut)}
            </div>
            <div className={styles.guestStatus}>
              <span className={`${styles.statusValue} ${styles[reservation.status]}`}>
                {getStatusLabel(reservation.status)}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.sidePanelContent}>
          <div className={styles.sectionMenu}>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'general' ? styles.active : ''}`}
              onClick={() => setActiveTab('general')}
            >
              Información general
            </button>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'financiero' ? styles.active : ''}`}
              onClick={() => setActiveTab('financiero')}
            >
              Estado financiero
            </button>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'huespedes' ? styles.active : ''}`}
              onClick={() => setActiveTab('huespedes')}
            >
              Huéspedes
            </button>
          </div>
        </div>

        {!isEditing && (
          <div className={styles.sidePanelFooter}>
            <div className={styles.actionButtons}>
              <div className={styles.statusButtons}>
                <ReservationStatusButtons
                  reservation={reservation}
                  onStatusChange={handleStatusChange}
                  onDelete={() => setShowDeleteModal(true)}
                  variant="dark"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          {renderTabContent()}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>⚠️ Confirmar Eliminación</h3>
            </div>
            <div className={styles.modalBody}>
              <p>
                ¿Estás seguro de eliminar la reserva #{reservation.id}?
              </p>
              <p>
                Esta acción no se puede deshacer y eliminará todos los registros relacionados.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button 
                onClick={handleDeleteReservation}
                className={`${styles.modalButton} ${styles.deleteButton}`}
              >
                <FaTrash />
                Eliminar Definitivamente
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className={`${styles.modalButton} ${styles.cancelButton}`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationDetails;
