import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  fetchReservations, 
  fetchRooms, 
  API_URL,
  getReservationFinancialSummary,
  getPagosByReserva,
  createPago,
  deletePago,
  getCargosByReserva,
  createCargo,
  deleteCargo
} from '../services/api.js';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import ReservationStatusButtons from '../components/ReservationStatusButtons';
import GeneralInfoTab from '../components/ReservationTabs/GeneralInfoTab';
import PagosTab from '../components/ReservationTabs/PagosTab';
import CargosTab from '../components/ReservationTabs/CargosTab';
import HuespedesTab from '../components/ReservationTabs/HuespedesTab';
import ServiciosTab from '../components/ReservationTabs/ServiciosTab';
import { FaTrash } from 'react-icons/fa';
import styles from './ReservationDetails.module.css';

const ReservationDetails = () => {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  
  // Estado principal
  const [reservation, setReservation] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado de pestañas
  const [activeTab, setActiveTab] = useState('general');
  
  // Estado financiero
  const [financialSummary, setFinancialSummary] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  
  // Estado para modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estado para tipos de servicio
  const [serviceTypes, setServiceTypes] = useState([]);
  const [tags, setTags] = useState([]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadReservationData = async () => {
      try {
        setLoading(true);
        
        const [reservationsData, roomsData, serviceTypesResponse, tagsResponse] = await Promise.all([
          fetchReservations(),
          fetchRooms(),
          fetch('http://localhost:3001/api/service-types?hotelId=default-hotel').then(res => res.json()),
          fetch('http://localhost:3001/api/tags').then(res => res.json())
        ]);
        
        const foundReservation = reservationsData.find(r => r.id === parseInt(reservationId));
        
        if (!foundReservation) {
          setError('Reserva no encontrada');
          setLoading(false);
          return;
        }
        
        setReservation(foundReservation);
        setRooms(roomsData);
        setServiceTypes(serviceTypesResponse.data || []);
        setTags(tagsResponse || []);
        
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

  // Cargar datos financieros cuando se acceda a esas pestañas
  useEffect(() => {
    if ((activeTab === 'pagos' || activeTab === 'cargos' || activeTab === 'general') && reservation) {
      loadFinancialData();
    }
  }, [activeTab, reservation]);

  const loadFinancialData = async () => {
    if (!reservation) return;
    
    try {
      setLoadingFinancial(true);
      const [summary, pagosData, cargosData] = await Promise.all([
        getReservationFinancialSummary(reservation.id),
        getPagosByReserva(reservation.id),
        getCargosByReserva(reservation.id)
      ]);
      
      setFinancialSummary(summary);
      setPagos(pagosData);
      setCargos(cargosData);
    } catch (error) {
      console.error('Error cargando datos financieros:', error);
    } finally {
      setLoadingFinancial(false);
    }
  };

  // Handlers para pagos
  const handleAddPago = async (pagoData) => {
    try {
      await createPago(reservation.id, pagoData);
      await loadFinancialData();
      alert('Pago agregado exitosamente');
    } catch (error) {
      console.error('Error agregando pago:', error);
      alert(`Error: ${error.message}`);
      throw error;
    }
  };

  const handleDeletePago = async (pagoId) => {
    if (!confirm('¿Estás seguro de eliminar este pago?')) return;
    
    try {
      await deletePago(pagoId);
      await loadFinancialData();
      alert('Pago eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando pago:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Handlers para cargos
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

  const handleDeleteCargo = async (cargoId) => {
    if (!confirm('¿Estás seguro de eliminar este cargo?')) return;
    
    try {
      await deleteCargo(cargoId);
      await loadFinancialData();
      alert('Cargo eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando cargo:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Utilidades
  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    try {
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
            financialSummary={financialSummary}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            getServiceTypeLabel={getServiceTypeLabel}
            getStatusLabel={getStatusLabel}
          />
        );
      case 'pagos':
        return (
          <PagosTab
            reservation={reservation}
            pagos={pagos}
            financialSummary={financialSummary}
            loadingFinancial={loadingFinancial}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            onAddPago={handleAddPago}
            onDeletePago={handleDeletePago}
          />
        );
      case 'cargos':
        return (
          <CargosTab
            cargos={cargos}
            financialSummary={financialSummary}
            loadingFinancial={loadingFinancial}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            onAddCargo={handleAddCargo}
            onDeleteCargo={handleDeleteCargo}
          />
        );
      case 'huespedes':
        return (
          <HuespedesTab
            reservation={reservation}
            onClientClick={handleClientClick}
          />
        );
      case 'servicios':
        return (
          <ServiciosTab
            reservation={reservation}
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
      {/* Side Panel Izquierdo */}
      <div className={styles.sidePanel}>
        {/* Header del side panel */}
        <div className={styles.sidePanelHeader}>
          <h2>Reserva #{reservation.id}</h2>
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

        {/* Contenido del side panel - Menú de pestañas */}
        <div className={styles.sidePanelContent}>
          <div className={styles.sectionMenu}>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'general' ? styles.active : ''}`}
              onClick={() => setActiveTab('general')}
            >
              Información General
            </button>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'pagos' ? styles.active : ''}`}
              onClick={() => setActiveTab('pagos')}
            >
              Pagos
            </button>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'cargos' ? styles.active : ''}`}
              onClick={() => setActiveTab('cargos')}
            >
              Cargos / Consumos
            </button>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'huespedes' ? styles.active : ''}`}
              onClick={() => setActiveTab('huespedes')}
            >
              Huéspedes
            </button>
            <button 
              className={`${styles.sectionButton} ${activeTab === 'servicios' ? styles.active : ''}`}
              onClick={() => setActiveTab('servicios')}
            >
              Servicios / Mantenimiento
            </button>
          </div>
        </div>

        {/* Footer con botones de acción */}
        <div className={styles.sidePanelFooter}>
          <div className={styles.actionButtons}>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className={styles.deleteButton}
              title="Eliminar reserva"
            >
              Eliminar
            </button>
            <button 
              onClick={handleBackClick}
              className={styles.backButton}
            >
              Volver
            </button>
          </div>
          <div className={styles.statusButtons}>
            <ReservationStatusButtons 
              reservation={reservation} 
              onStatusChange={handleStatusChange} 
            />
          </div>
        </div>
      </div>

      {/* Main Content Derecho */}
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
