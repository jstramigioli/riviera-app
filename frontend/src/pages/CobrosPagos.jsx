import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchClients, fetchReservations } from '../services/api';
import styles from './CobrosPagos.module.css';

const CobrosPagos = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

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
    navigate(`/clients/${client.id}`);
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


export default CobrosPagos; 