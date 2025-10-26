import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchClients, fetchReservations, getReservationsWithBalances } from '../services/api';
import PaymentForm from '../components/PaymentForm';
import styles from './CobrosPagos.module.css';

const CobrosPagos = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [reservationsWithBalances, setReservationsWithBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [clientsData, reservationsData, balancesData] = await Promise.all([
        fetchClients(),
        fetchReservations(),
        getReservationsWithBalances()
      ]);

      setClients(clientsData);
      setReservations(reservationsData);
      setReservationsWithBalances(balancesData);
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
    navigate(`/clients/${client.id}`);
  };

  const handleAddPayment = (reservation) => {
    setSelectedReservation(reservation);
    setShowPaymentForm(true);
  };

  const handleClosePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedReservation(null);
  };

  const handlePaymentSuccess = () => {
    loadData(); // Recargar datos después de crear un pago
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

  // Vista principal de reservas con saldos
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Cobros y Pagos</h1>
        <p>Gestiona los pagos y saldos de las reservas</p>
      </div>

      <div className={styles.content}>
        <div className={styles.reservationsList}>
          <h2>Reservas con Saldos</h2>
          
          {reservationsWithBalances.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay reservas registradas</p>
            </div>
          ) : (
            <div className={styles.reservationsGrid}>
              {reservationsWithBalances.map(reservation => {
                const getStatusColor = (estado) => {
                  switch (estado) {
                    case 'PENDIENTE': return '#dc2626';
                    case 'PAGADO': return '#059669';
                    case 'A_FAVOR': return '#d97706';
                    default: return '#6b7280';
                  }
                };

                return (
                  <div 
                    key={reservation.id} 
                    className={styles.reservationCard}
                  >
                    <div className={styles.reservationInfo}>
                      <h3>Reserva #{reservation.id}</h3>
                      <p className={styles.clientName}>
                        {reservation.mainClient.firstName} {reservation.mainClient.lastName}
                      </p>
                      <p className={styles.clientEmail}>{reservation.mainClient.email}</p>
                      <p className={styles.guestsCount}>
                        {reservation.cantidadHuespedes} huésped{reservation.cantidadHuespedes !== 1 ? 'es' : ''}
                      </p>
                    </div>
                    
                    <div className={styles.balanceInfo}>
                      <div className={styles.balanceAmount}>
                        <span className={styles.label}>Saldo:</span>
                        <span 
                          className={styles.amount}
                          style={{ color: getStatusColor(reservation.estadoPago) }}
                        >
                          {formatPrice(reservation.saldo)}
                        </span>
                      </div>
                      <div className={styles.statusBadge} style={{ backgroundColor: getStatusColor(reservation.estadoPago) }}>
                        {reservation.estadoPago}
                      </div>
                      <div className={styles.totalsInfo}>
                        <small>Cargos: {formatPrice(reservation.totalCargos)}</small>
                        <small>Pagos: {formatPrice(reservation.totalPagos)}</small>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <button
                        className={styles.paymentButton}
                        onClick={() => handleAddPayment(reservation)}
                        disabled={reservation.estadoPago === 'PAGADO'}
                      >
                        + Agregar Pago
                      </button>
                      <button
                        className={styles.detailsButton}
                        onClick={() => handleClientClick(reservation.mainClient)}
                      >
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulario de pagos */}
      {showPaymentForm && selectedReservation && (
        <PaymentForm
          reservaId={selectedReservation.id}
          onClose={handleClosePaymentForm}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};


export default CobrosPagos; 