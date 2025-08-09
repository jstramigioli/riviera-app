import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchClients, fetchReservations } from '../services/api';
import ReservationPricingDetails from '../components/ReservationPricingDetails';
import styles from './CobrosPagos.module.css';

const CobrosPagos = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [error, setError] = useState(null);
  
  // Obtener parámetros de URL
  const clientId = searchParams.get('clientId');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === parseInt(clientId));
      if (client) {
        setSelectedClient(client);
        setShowClientDetails(true);
      }
    }
  }, [clientId, clients]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [clientsData, reservationsData] = await Promise.all([
        fetchClients(),
        fetchReservations()
      ]);

      setClients(clientsData);
      setReservations(reservationsData);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const calculateClientBalance = (clientId) => {
    const clientReservations = reservations.filter(r => r.mainClientId === clientId);
    return clientReservations.reduce((total, reservation) => {
      return total + (reservation.totalAmount || 0);
    }, 0);
  };

  const getClientReservations = (clientId) => {
    return reservations.filter(r => r.mainClientId === clientId);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const handleClientClick = (client) => {
    navigate(`/cobros-pagos?clientId=${client.id}`);
  };

  const handleCloseDetails = () => {
    navigate('/cobros-pagos');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando datos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
        <button onClick={loadData} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

  // Si hay un clientId en la URL, mostrar la vista de detalles del cliente
  if (showClientDetails && selectedClient) {
    return (
      <ClientDetailsView
        client={selectedClient}
        reservations={getClientReservations(selectedClient.id)}
        onClose={handleCloseDetails}
      />
    );
  }

  // Vista principal de lista de clientes
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Cobros y Pagos</h1>
        <p>Gestiona las cuentas pendientes de los clientes</p>
      </div>

      <div className={styles.content}>
        <div className={styles.clientsList}>
          <h2>Clientes con Cuentas Pendientes</h2>
          
          {clients.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay clientes registrados</p>
            </div>
          ) : (
            <div className={styles.clientsGrid}>
              {clients.map(client => {
                const balance = calculateClientBalance(client.id);
                const clientReservations = getClientReservations(client.id);
                
                if (clientReservations.length === 0) return null;

                return (
                  <div 
                    key={client.id} 
                    className={styles.clientCard}
                    onClick={() => handleClientClick(client)}
                  >
                    <div className={styles.clientInfo}>
                      <h3>{client.firstName} {client.lastName}</h3>
                      <p className={styles.clientEmail}>{client.email}</p>
                      <p className={styles.clientPhone}>{client.phone}</p>
                    </div>
                    
                    <div className={styles.balanceInfo}>
                      <div className={styles.balanceAmount}>
                        <span className={styles.label}>Total pendiente:</span>
                        <span className={styles.amount}>{formatPrice(balance)}</span>
                      </div>
                      <div className={styles.reservationsCount}>
                        <span>{clientReservations.length} reserva{clientReservations.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente de vista completa para detalles del cliente
const ClientDetailsView = ({ client, reservations, onClose }) => {
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showPricingDetails, setShowPricingDetails] = useState(false);

  const totalBalance = reservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleReservationClick = (reservation) => {
    setSelectedReservation(reservation);
    setShowPricingDetails(true);
  };

  return (
    <div className={styles.clientDetailsContainer}>
      <div className={styles.clientDetailsHeader}>
        <button onClick={onClose} className={styles.backButton}>
          ← Volver a Cobros y Pagos
        </button>
        <h1>Detalles de Cuenta - {client.firstName} {client.lastName}</h1>
      </div>

      <div className={styles.clientDetailsContent}>
        <div className={styles.clientSummary}>
          <div className={styles.summaryCard}>
            <h3>Resumen de Cuenta</h3>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.label}>Total pendiente:</span>
                <span className={styles.value}>{formatPrice(totalBalance)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.label}>Reservas activas:</span>
                <span className={styles.value}>{reservations.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.reservationsList}>
          <h3>Reservas del Cliente</h3>
          {reservations.length === 0 ? (
            <p>No hay reservas para este cliente</p>
          ) : (
            <div className={styles.reservationsGrid}>
              {reservations.map(reservation => (
                <div key={reservation.id} className={styles.reservationCard}>
                  <div className={styles.reservationInfo}>
                    <h4>Reserva #{reservation.id}</h4>
                    <p>Habitación: {reservation.room?.name}</p>
                    <p>Check-in: {formatDate(reservation.checkIn)}</p>
                    <p>Check-out: {formatDate(reservation.checkOut)}</p>
                    <p>Estado: {reservation.status}</p>
                  </div>
                  
                  <div className={styles.reservationAmount}>
                    <span className={styles.amount} onClick={() => handleReservationClick(reservation)}>
                      {formatPrice(reservation.totalAmount)}
                    </span>
                    <small>Click para ver detalles</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showPricingDetails && selectedReservation && (
          <ReservationPricingDetails
            reservationId={selectedReservation.id}
            onClose={() => setShowPricingDetails(false)}
            isExpanded={showPricingDetails}
          />
        )}
      </div>
    </div>
  );
};

export default CobrosPagos; 