import React, { useState, useEffect } from 'react';
import { getStatusColor } from "../utils/reservationStatusUtils";
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientBalance } from '../services/api.js';
import styles from './ClientDetails.module.css';

const ClientDetails = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [clientBalance, setClientBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadClientData = async () => {
      try {
        setLoading(true);
        
        // Cargar datos del cliente desde localStorage o context
        const allClients = JSON.parse(localStorage.getItem('clients') || '[]');
        const foundClient = allClients.find(c => c.id === parseInt(clientId));
        
        if (!foundClient) {
          setError('Cliente no encontrado');
          setLoading(false);
          return;
        }
        
        setClient(foundClient);
        
        // Cargar reservas del cliente
        const allReservations = JSON.parse(localStorage.getItem('reservations') || '[]');
        const clientReservations = allReservations.filter(r => r.mainClientId === parseInt(clientId));
        setReservations(clientReservations);
        
        // Cargar balance del cliente
        try {
          const balance = await getClientBalance(parseInt(clientId));
          setClientBalance(balance);
        } catch (error) {
          console.warn('No se pudo cargar el balance del cliente:', error);
          setClientBalance({ balance: 0 });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos del cliente:', error);
        setError('Error al cargar los datos del cliente');
        setLoading(false);
      }
    };

    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getDocumentAbbreviation = (documentType) => {
    const abbreviations = {
      'DNI': 'DNI',
      'CÉDULA DE IDENTIDAD': 'Cédula',
      'CUIT': 'CUIT',
      'LIBRETA CÍVICA': 'Lib. Cívica',
      'LIBRETA DE ENROLAMENTO': 'Lib. Enrolamiento',
      'LIBRETA DE EMBARQUE': 'Lib. Embarque',
      'PASAPORTE': 'Pasaporte',
      'OTRO': 'Otro'
    };
    return abbreviations[documentType] || documentType;
  };

  const getReservationStatusLabel = (status) => getStatusLabel(status);

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleReservationClick = (reservation) => {
    // Aquí podrías navegar a los detalles de la reserva
    console.log('Click en reserva:', reservation.id);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando datos del cliente...</div>
      </div>
    );
  }

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

  if (!client) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Cliente no encontrado</h2>
          <p>El cliente con ID {clientId} no existe.</p>
          <button onClick={handleBackClick} className={styles.backButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={handleBackClick} className={styles.backButton}>
          ← Volver
        </button>
        <h1 className={styles.title}>Detalles del Cliente</h1>
      </div>

      {/* Información Principal del Cliente */}
      <div className={styles.clientCard}>
        <div className={styles.clientHeader}>
          <div className={styles.clientAvatar}>
            {client.firstName?.[0]?.toUpperCase()}{client.lastName?.[0]?.toUpperCase()}
          </div>
          <div className={styles.clientInfo}>
            <h2 className={styles.clientName}>
              {client.firstName} {client.lastName}
            </h2>
            <p className={styles.clientId}>ID: #{client.id}</p>
          </div>
        </div>

        {/* Balance del Cliente */}
        {clientBalance && (
          <div className={styles.balanceSection}>
            <h3>Balance</h3>
            <div className={styles.balanceAmount}>
              <span className={styles.balanceLabel}>Saldo:</span>
              <span 
                className={styles.balanceValue}
                style={{ 
                  color: clientBalance.balance > 0 ? '#dc3545' : 
                         clientBalance.balance < 0 ? '#28a745' : '#6c757d' 
                }}
              >
                ${clientBalance.balance ? Math.abs(clientBalance.balance).toLocaleString('es-AR') : '0'}
                {clientBalance.balance > 0 ? ' (Debe)' : 
                 clientBalance.balance < 0 ? ' (A favor)' : ' (Saldo)'}
              </span>
            </div>
          </div>
        )}

        {/* Información de Contacto */}
        <div className={styles.contactSection}>
          <h3>Información de Contacto</h3>
          <div className={styles.contactGrid}>
            {client.email && (
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Email:</span>
                <span className={styles.contactValue}>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Teléfono:</span>
                <span className={styles.contactValue}>{client.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Información de Documento */}
        <div className={styles.documentSection}>
          <h3>Documento</h3>
          <div className={styles.documentInfo}>
            <span className={styles.documentLabel}>Tipo:</span>
            <span className={styles.documentValue}>{client.documentType || 'No especificado'}</span>
          </div>
          {client.documentNumber && (
            <div className={styles.documentInfo}>
              <span className={styles.documentLabel}>Número:</span>
              <span className={styles.documentValue}>{client.documentNumber}</span>
            </div>
          )}
        </div>

        {/* Información de Ubicación */}
        {(client.country || client.province || client.city) && (
          <div className={styles.locationSection}>
            <h3>Ubicación</h3>
            <div className={styles.locationInfo}>
              {client.country && (
                <div className={styles.locationItem}>
                  <span className={styles.locationLabel}>País:</span>
                  <span className={styles.locationValue}>{client.country}</span>
                </div>
              )}
              {client.province && (
                <div className={styles.locationItem}>
                  <span className={styles.locationLabel}>Provincia:</span>
                  <span className={styles.locationValue}>{client.province}</span>
                </div>
              )}
              {client.city && (
                <div className={styles.locationItem}>
                  <span className={styles.locationLabel}>Ciudad:</span>
                  <span className={styles.locationValue}>{client.city}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notas */}
        {client.notes && (
          <div className={styles.notesSection}>
            <h3>Notas</h3>
            <p className={styles.notesText}>{client.notes}</p>
          </div>
        )}
      </div>

      {/* Reservas del Cliente */}
      <div className={styles.reservationsSection}>
        <h3>Reservas del Cliente</h3>
        {reservations.length === 0 ? (
          <div className={styles.noReservations}>
            <p>Este cliente no tiene reservas registradas.</p>
          </div>
        ) : (
          <div className={styles.reservationsGrid}>
            {reservations.map(reservation => (
              <div 
                key={reservation.id} 
                className={styles.reservationCard}
                onClick={() => handleReservationClick(reservation)}
              >
                <div className={styles.reservationHeader}>
                  <h4 className={styles.reservationId}>Reserva #{reservation.id}</h4>
                  <span 
                    className={styles.reservationStatus}
                    style={{ backgroundColor: getReservationStatusColor(reservation.status) }}
                  >
                    {getReservationStatusLabel(reservation.status)}
                  </span>
                </div>
                
                <div className={styles.reservationDetails}>
                  <div className={styles.reservationInfo}>
                    <span className={styles.infoLabel}>Habitación:</span>
                    <span className={styles.infoValue}>
                      {reservation.room?.name || `ID: ${reservation.roomId}`}
                    </span>
                  </div>
                  
                  <div className={styles.reservationInfo}>
                    <span className={styles.infoLabel}>Fechas:</span>
                    <span className={styles.infoValue}>
                      {formatDate(reservation.checkIn)} - {formatDate(reservation.checkOut)}
                    </span>
                  </div>
                  
                  <div className={styles.reservationInfo}>
                    <span className={styles.infoLabel}>Huéspedes:</span>
                    <span className={styles.infoValue}>
                      {reservation.requiredGuests || reservation.guestCount || 1}
                    </span>
                  </div>
                  
                  {reservation.totalAmount && (
                    <div className={styles.reservationInfo}>
                      <span className={styles.infoLabel}>Total:</span>
                      <span className={styles.infoValue}>
                        ${reservation.totalAmount.toLocaleString('es-AR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetails; 