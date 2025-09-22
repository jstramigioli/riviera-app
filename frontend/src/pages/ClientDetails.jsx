import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchClients, fetchReservations } from '../services/api';
import ReservationPricingDetails from '../components/ReservationPricingDetails';
import FieldEditor from '../components/FieldEditor';
import styles from './ClientDetails.module.css';

const ClientDetails = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('personal');
  const [editingField, setEditingField] = useState(null);

  const loadClientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [clientsData, reservationsData] = await Promise.all([
        fetchClients(),
        fetchReservations()
      ]);

      const foundClient = clientsData.find(c => c.id === parseInt(clientId));
      const clientReservations = reservationsData.filter(r => r.mainClientId === parseInt(clientId));

      if (!foundClient) {
        setError('Cliente no encontrado');
        return;
      }

      setClient(foundClient);
      setReservations(clientReservations);
    } catch (err) {
      console.error('Error cargando datos del cliente:', err);
      setError('Error al cargar los datos del cliente');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId, loadClientData]);

  const handleEditField = (fieldName) => {
    setEditingField(fieldName);
  };

  const handleSaveField = (updatedClient) => {
    setClient(updatedClient);
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  const handleEmailClick = () => {
    if (client.email) {
      alert(`Funcionalidad de email próximamente disponible.\n\nSe enviará un email a: ${client.email}`);
    } else {
      alert('Este cliente no tiene email registrado. Actualiza su información para poder contactarlo por email.');
    }
  };

  const handleWhatsAppClick = () => {
    if (client.phone) {
      alert(`Funcionalidad de WhatsApp próximamente disponible.\n\nSe enviará un mensaje al: ${client.phone}`);
    } else {
      alert('Este cliente no tiene teléfono registrado. Actualiza su información para poder contactarlo por WhatsApp.');
    }
  };

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

  const getStatusLabel = (status) => {
    const statusLabels = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmada',
      'ingresada': 'Ingresada',
      'checked_out': 'Check-out',
      'cancelled': 'Cancelada'
    };
    return statusLabels[status] || status;
  };

  const calculateTotalBalance = () => {
    return reservations.reduce((total, reservation) => {
      return total + (reservation.totalAmount || 0);
    }, 0);
  };

  const getActiveReservations = () => {
    return reservations.filter(r => !['checked_out', 'cancelled'].includes(r.status));
  };

  const getCompletedReservations = () => {
    return reservations.filter(r => ['checked_out'].includes(r.status));
  };

  const getCurrentStatus = () => {
    const activeReservations = getActiveReservations();
    if (activeReservations.length === 0) {
      return 'Sin reservas';
    }
    
    // Buscar reservas que estén actualmente activas (check-in pasado, check-out futuro)
    const now = new Date();
    const currentReservation = activeReservations.find(r => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      return now >= checkIn && now <= checkOut;
    });
    
    if (currentReservation) {
      return 'Alojado';
    }
    
    // Si hay reservas futuras, calcular días hasta la próxima
    const futureReservations = activeReservations.filter(r => new Date(r.checkIn) > now);
    if (futureReservations.length > 0) {
      const nextReservation = futureReservations.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0];
      const daysUntilArrival = Math.ceil((new Date(nextReservation.checkIn) - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilArrival >= 30) {
        const months = Math.floor(daysUntilArrival / 30);
        const remainingDays = daysUntilArrival % 30;
        if (remainingDays === 0) {
          return `Llega en ${months} mes${months > 1 ? 'es' : ''}`;
        } else {
          return `Llega en ${months} mes${months > 1 ? 'es' : ''} y ${remainingDays} día${remainingDays > 1 ? 's' : ''}`;
        }
      } else if (daysUntilArrival >= 7) {
        const weeks = Math.floor(daysUntilArrival / 7);
        const remainingDays = daysUntilArrival % 7;
        if (remainingDays === 0) {
          return `Llega en ${weeks} semana${weeks > 1 ? 's' : ''}`;
        } else {
          return `Llega en ${weeks} semana${weeks > 1 ? 's' : ''} y ${remainingDays} día${remainingDays > 1 ? 's' : ''}`;
        }
      } else {
        return `Llega en ${daysUntilArrival} día${daysUntilArrival > 1 ? 's' : ''}`;
      }
    }
    
    return 'Sin reservas';
  };


  if (loading) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.loadingContainer}>
          <div className={styles.loading}>Cargando datos del cliente...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>{error}</div>
          <button onClick={loadClientData} className={styles.retryButton}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>Cliente no encontrado</div>
          <button onClick={() => navigate('/cobros-pagos')} className={styles.retryButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const totalBalance = calculateTotalBalance();
  const activeReservations = getActiveReservations();
  const completedReservations = getCompletedReservations();
  const currentStatus = getCurrentStatus();

  return (
    <div className={styles.newLayout}>
      {/* Side Panel Izquierdo */}
      <div className={styles.sidePanel}>
        {/* Header del side panel */}
        <div className={styles.sidePanelHeader}>
          <h2>Cliente #{client.id}</h2>
          <div className={styles.guestInfo}>
            <div className={styles.guestName}>
              {client.firstName} {client.lastName}
            </div>
            <div className={styles.guestDates}>
              Cliente desde {new Date(client.createdAt).getFullYear()}
            </div>
            <div className={styles.guestStatus}>
              <span className={styles.statusValue}>
                {currentStatus}
              </span>
            </div>
            <div className={styles.guestStatus}>
              <span className={styles.statusValue}>
                {totalBalance > 0 ? 'Cuenta Pendiente' : 'Cuenta al Día'}
              </span>
            </div>
          </div>

          {/* Botones de contacto */}
          <div className={styles.contactButtons}>
            <button 
              className={styles.contactButton}
              onClick={() => handleEmailClick()}
              title="Enviar email"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </button>
            <button 
              className={styles.contactButton}
              onClick={() => handleWhatsAppClick()}
              title="Enviar WhatsApp"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido del side panel - Menú de pestañas */}
        <div className={styles.sidePanelContent}>
          <div className={styles.sectionMenu}>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'personal' ? styles.active : ''}`}
              onClick={() => setActiveSection('personal')}
            >
              👤 Información Personal
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'reservations' ? styles.active : ''}`}
              onClick={() => setActiveSection('reservations')}
            >
              📋 Reservas
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'balance' ? styles.active : ''}`}
              onClick={() => setActiveSection('balance')}
            >
              💰 Balance de Pagos
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'documents' ? styles.active : ''}`}
              onClick={() => setActiveSection('documents')}
            >
              📄 Documentación Asociada
            </button>
          </div>
        </div>

      </div>

      {/* Main Content Derecho */}
      <div className={styles.mainContent}>
        {/* Contenido principal */}
        <div className={styles.mainContentBody}>
          {/* Sección de Información Personal */}
          {activeSection === 'personal' && (
            <div className={styles.section}>
              <h2>Información Personal</h2>
              <div className={styles.personalInfoContainer}>
                <div className={styles.personalInfoGrid}>
                  <div className={styles.personalInfoCard}>
                    <h3>Datos Personales</h3>
                    <div className={styles.infoList}>
                      <div className={styles.infoItem} onClick={() => handleEditField('firstName')}>
                        <span className={styles.label}>Nombre:</span>
                        <span className={styles.value}>{client.firstName}</span>
                      </div>
                      <div className={styles.infoItem} onClick={() => handleEditField('lastName')}>
                        <span className={styles.label}>Apellido:</span>
                        <span className={styles.value}>{client.lastName}</span>
                      </div>
                      <div className={styles.infoItem} onClick={() => handleEditField('email')}>
                        <span className={styles.label}>Email:</span>
                        <span className={styles.value}>{client.email || 'Sin email'}</span>
                      </div>
                      <div className={styles.infoItem} onClick={() => handleEditField('phone')}>
                        <span className={styles.label}>Teléfono:</span>
                        <span className={styles.value}>{client.phone || 'Sin teléfono'}</span>
                      </div>
                      <div className={styles.infoItem} onClick={() => handleEditField('document')}>
                        <span className={styles.label}>Documento:</span>
                        <span className={styles.value}>{client.documentType && client.documentNumber ? `${client.documentType} ${client.documentNumber}` : 'Sin documento'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.personalInfoCard}>
                    <h3>Domicilio</h3>
                    <div className={styles.infoList}>
                      <div className={styles.infoItem} onClick={() => handleEditField('country')}>
                        <span className={styles.label}>País:</span>
                        <span className={styles.value}>{client.country || 'Sin país'}</span>
                      </div>
                      <div className={styles.infoItem} onClick={() => handleEditField('province')}>
                        <span className={styles.label}>Provincia:</span>
                        <span className={styles.value}>{client.province || 'Sin provincia'}</span>
                      </div>
                      <div className={styles.infoItem} onClick={() => handleEditField('city')}>
                        <span className={styles.label}>Ciudad:</span>
                        <span className={styles.value}>{client.city || 'Sin ciudad'}</span>
                      </div>
                    </div>
                  </div>
                  
                  
                  <div className={styles.personalInfoCard}>
                    <h3>Resumen de Cuenta</h3>
                    <div className={styles.infoList}>
                      <div className={`${styles.infoItem} ${styles.infoItemNonEditable}`}>
                        <span className={styles.label}>Total Pendiente:</span>
                        <span className={styles.value}>{formatPrice(totalBalance)}</span>
                      </div>
                      <div className={`${styles.infoItem} ${styles.infoItemNonEditable}`}>
                        <span className={styles.label}>Reservas Activas:</span>
                        <span className={styles.value}>{activeReservations.length}</span>
                      </div>
                      <div className={`${styles.infoItem} ${styles.infoItemNonEditable}`}>
                        <span className={styles.label}>Reservas Completadas:</span>
                        <span className={styles.value}>{completedReservations.length}</span>
                      </div>
                      <div className={`${styles.infoItem} ${styles.infoItemNonEditable}`}>
                        <span className={styles.label}>Total de Reservas:</span>
                        <span className={styles.value}>{reservations.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección de Reservas */}
          {activeSection === 'reservations' && (
            <div className={styles.section}>
              <h2>Reservas del Cliente</h2>
              {reservations.length === 0 ? (
                <div className={styles.noDataMessage}>
                  Este cliente no tiene reservas registradas
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.reservationsTable}>
                    <thead className={styles.tableHeader}>
                      <tr>
                        <th>ID</th>
                        <th>Habitación</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {reservations.map(reservation => (
                        <tr 
                          key={reservation.id} 
                          className={styles.reservationRow}
                          onClick={() => navigate(`/reservations/${reservation.id}`)}
                        >
                          <td>#{reservation.id}</td>
                          <td>{reservation.room?.name || 'Sin asignar'}</td>
                          <td>{formatDate(reservation.checkIn)}</td>
                          <td>{formatDate(reservation.checkOut)}</td>
                          <td>
                            <span className={`${styles.statusValue} ${styles[reservation.status]}`}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </td>
                          <td className={styles.totalAmount}>
                            {formatPrice(reservation.totalAmount || 0)}
                          </td>
                          <td>
                            <button 
                              className={styles.viewButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/reservations/${reservation.id}`);
                              }}
                            >
                              Ver Detalles
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sección de Balance de Pagos */}
          {activeSection === 'balance' && (
            <div className={styles.section}>
              <h2>Balance de Pagos</h2>
              <div className={styles.balanceGrid}>
                <div className={styles.balanceCard}>
                  <h3>Resumen Financiero</h3>
                  <div className={styles.balanceDetails}>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Total Pendiente:</span>
                      <span className={`${styles.value} ${totalBalance > 0 ? styles.negative : styles.positive}`}>
                        {formatPrice(totalBalance)}
                      </span>
                    </div>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Reservas Activas:</span>
                      <span className={styles.value}>{activeReservations.length}</span>
                    </div>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Última Actividad:</span>
                      <span className={styles.value}>
                        {reservations.length > 0 ? formatDate(reservations[0].createdAt) : 'Sin actividad'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.balanceCard}>
                  <h3>Desglose por Estado</h3>
                  <div className={styles.statusBreakdown}>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>Pendientes:</span>
                      <span className={styles.value}>
                        {reservations.filter(r => r.status === 'pending').length}
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>Confirmadas:</span>
                      <span className={styles.value}>
                        {reservations.filter(r => r.status === 'confirmed').length}
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>Ingresadas:</span>
                      <span className={styles.value}>
                        {reservations.filter(r => r.status === 'ingresada').length}
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>Completadas:</span>
                      <span className={styles.value}>
                        {completedReservations.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Sección de Documentación Asociada */}
          {activeSection === 'documents' && (
            <div className={styles.section}>
              <h2>Documentación Asociada</h2>
              <div className={styles.documentsContainer}>
                <div className={styles.documentsGrid}>
                  <div className={styles.documentCard}>
                    <div className={styles.documentIcon}>🆔</div>
                    <div className={styles.documentInfo}>
                      <h3>Documento de Identidad</h3>
                      <p>Foto del DNI o documento de identidad del cliente</p>
                      <div className={styles.documentActions}>
                        <button className={styles.uploadButton}>
                          📤 Subir Foto
                        </button>
                        <button className={styles.viewButton}>
                          👁️ Ver Documento
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.documentCard}>
                    <div className={styles.documentIcon}>💰</div>
                    <div className={styles.documentInfo}>
                      <h3>Comprobantes de Pago</h3>
                      <p>Recibos y comprobantes de pago</p>
                      <div className={styles.documentActions}>
                        <button className={styles.uploadButton}>
                          📤 Subir Comprobante
                        </button>
                        <button className={styles.viewButton}>
                          👁️ Ver Comprobantes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modal de edición */}
      {editingField && (
        <FieldEditor
          fieldName={editingField}
          currentValue={client[editingField]}
          onSave={handleSaveField}
          onCancel={handleCancelEdit}
          clientId={client.id}
          client={client}
        />
      )}
    </div>
  );
};

export default ClientDetails;