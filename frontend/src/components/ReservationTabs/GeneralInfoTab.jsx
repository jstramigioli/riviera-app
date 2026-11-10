import React, { useEffect, useState } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import useReservationStatuses from '../../hooks/useReservationStatuses';
import { createClient } from '../../services/api.js';
import styles from './ReservationTabs.module.css';

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '0.95rem',
  boxSizing: 'border-box'
};

const emptyNewClient = {
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
};

const toDateInput = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

/** Noches civiles entre YYYY-MM-DD (evita desfases por timezone). */
const civilNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = String(checkIn).slice(0, 10);
  const end = String(checkOut).slice(0, 10);
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (![ys, ms, ds, ye, me, de].every(Number.isFinite)) return 0;
  const msDiff = Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds);
  return Math.max(0, Math.round(msDiff / 86400000));
};

/** Total de la estadía: nunca confundir con tarifa/noche (baseRate). */
const resolveReservationTotal = (reservation, nights) => {
  const explicit = Number(reservation?.totalAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const activeSegments = (reservation?.segments || []).filter((s) => s.isActive !== false);
  const segments = activeSegments.length > 0 ? activeSegments : (reservation?.segments || []);
  if (segments.length > 0) {
    const fromSegments = segments.reduce((sum, segment) => {
      const segNights = civilNights(segment.startDate, segment.endDate) || nights || 1;
      const rate = Number(segment.baseRate) || 0;
      return sum + rate * segNights;
    }, 0);
    if (fromSegments > 0) return fromSegments;
  }

  const nightly = Number(reservation?.averageRate || reservation?.segments?.[0]?.baseRate) || 0;
  if (nightly > 0 && nights > 0) return nightly * nights;
  return 0;
};

const GeneralInfoTab = ({ 
  reservation,
  editData,
  isEditing = false,
  rooms = [],
  clients = [],
  serviceTypes = [],
  onEditChange,
  onClientCreated,
  formatDate, 
  formatCurrency, 
  getServiceTypeLabel,
  getStatusLabel 
}) => {
  const { statuses: statusOptions } = useReservationStatuses();
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState(emptyNewClient);
  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState(null);

  const resetNewClientForm = () => {
    setShowNewClientForm(false);
    setNewClient(emptyNewClient);
    setClientError(null);
  };

  useEffect(() => {
    if (!isEditing) resetNewClientForm();
  }, [isEditing]);

  if (!reservation) return null;

  const data = isEditing && editData ? editData : reservation;

  const handleNewClientField = (field, value) => {
    setNewClient((prev) => ({ ...prev, [field]: value }));
    if (clientError) setClientError(null);
  };

  const handleSaveNewClient = async () => {
    if (!newClient.firstName.trim() || !newClient.lastName.trim()) {
      setClientError('Completá nombre y apellido del cliente.');
      return;
    }

    try {
      setSavingClient(true);
      setClientError(null);
      const created = await createClient({
        firstName: newClient.firstName.trim(),
        lastName: newClient.lastName.trim(),
        email: newClient.email.trim() || null,
        phone: newClient.phone.trim() || null
      });

      if (onClientCreated) {
        onClientCreated(created);
      } else if (onEditChange) {
        onEditChange('mainClientId', created.id);
      }

      resetNewClientForm();
    } catch (err) {
      console.error('Error creando cliente:', err);
      setClientError(err.message || 'No se pudo crear el cliente.');
    } finally {
      setSavingClient(false);
    }
  };

  const checkIn = data.checkIn || data.segments?.[0]?.startDate;
  const checkOut = data.checkOut || data.segments?.[data.segments?.length - 1]?.endDate;
  const nightsFromDates = civilNights(checkIn, checkOut);
  const nights = Number(data.days) > 0 ? Number(data.days) : nightsFromDates;
  const guestCount = data.segments?.[0]?.guestCount || data.requiredGuests || 1;
  const serviceId = data.segments?.[0]?.services?.[0] || data.reservationType || '';
  const reservationTotal = resolveReservationTotal(reservation, nights);

  const handleSegmentField = (field, value) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) segments[0] = {};
    segments[0] = { ...segments[0], [field]: value };
    onEditChange('segments', segments);
  };

  const handleServiceChange = (value) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) segments[0] = {};
    segments[0] = { ...segments[0], services: value ? [value] : [] };
    onEditChange('segments', segments);
  };

  return (
    <div className={styles.tabContent}>
      <h3 className={`${styles.sectionTitle} ${styles.generalInfoTitle}`}>Información general</h3>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Check-in:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <input
                type="date"
                value={toDateInput(checkIn)}
                onChange={(e) => {
                  onEditChange('checkIn', e.target.value);
                  handleSegmentField('startDate', e.target.value);
                }}
                style={inputStyle}
              />
            ) : (
              formatDate(checkIn)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Check-out:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <input
                type="date"
                value={toDateInput(checkOut)}
                onChange={(e) => {
                  onEditChange('checkOut', e.target.value);
                  const segments = [...(editData?.segments || reservation.segments || [])];
                  const lastIdx = Math.max(segments.length - 1, 0);
                  if (!segments[lastIdx]) segments[lastIdx] = {};
                  segments[lastIdx] = { ...segments[lastIdx], endDate: e.target.value };
                  onEditChange('segments', segments);
                }}
                style={inputStyle}
              />
            ) : (
              formatDate(checkOut)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Noches:</span>
          <span className={styles.infoValue}>{nights || '—'}</span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Estado:</span>
          <span className={`${styles.infoValue} ${!isEditing ? `${styles.statusBadge} ${styles[reservation.status]}` : ''}`}>
            {isEditing ? (
              <select
                value={data.status || reservation.status}
                onChange={(e) => onEditChange('status', e.target.value)}
                style={inputStyle}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              getStatusLabel(reservation.status)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Huéspedes:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <input
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 1;
                  handleSegmentField('guestCount', value);
                  onEditChange('requiredGuests', value);
                }}
                style={inputStyle}
              />
            ) : (
              <>
                {guestCount} persona{guestCount > 1 ? 's' : ''}
              </>
            )}
          </span>
        </div>

        <div className={`${styles.infoItem} ${isEditing && showNewClientForm ? styles.infoItemWide : ''}`}>
          <span className={styles.infoLabel}>Cliente:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              showNewClientForm ? (
                <div className={styles.newClientForm} data-testid="edit-new-client-form">
                  <div className={styles.newClientGrid}>
                    <input
                      type="text"
                      value={newClient.firstName}
                      onChange={(e) => handleNewClientField('firstName', e.target.value)}
                      placeholder="Nombre"
                      style={inputStyle}
                      aria-label="Nombre del nuevo cliente"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newClient.lastName}
                      onChange={(e) => handleNewClientField('lastName', e.target.value)}
                      placeholder="Apellido"
                      style={inputStyle}
                      aria-label="Apellido del nuevo cliente"
                    />
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => handleNewClientField('email', e.target.value)}
                      placeholder="Email"
                      style={inputStyle}
                      aria-label="Email del nuevo cliente"
                    />
                    <input
                      type="tel"
                      value={newClient.phone}
                      onChange={(e) => handleNewClientField('phone', e.target.value)}
                      placeholder="Teléfono"
                      style={inputStyle}
                      aria-label="Teléfono del nuevo cliente"
                    />
                  </div>
                  {clientError && (
                    <p className={styles.newClientError} role="alert">{clientError}</p>
                  )}
                  <div className={styles.newClientButtons}>
                    <button
                      type="button"
                      className={styles.newClientSaveBtn}
                      onClick={handleSaveNewClient}
                      disabled={savingClient}
                      data-testid="edit-save-new-client"
                    >
                      {savingClient ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      className={styles.newClientCancelBtn}
                      onClick={resetNewClientForm}
                      disabled={savingClient}
                      title="Cancelar"
                      aria-label="Cancelar creación de cliente"
                    >
                      <FaTimes aria-hidden /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.clientEditRow}>
                  <select
                    value={data.mainClientId || reservation.mainClientId || ''}
                    onChange={(e) => onEditChange('mainClientId', parseInt(e.target.value, 10))}
                    style={inputStyle}
                    data-testid="edit-client-select"
                    aria-label="Cliente de la reserva"
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.newClientButton}
                    onClick={() => {
                      setShowNewClientForm(true);
                      setClientError(null);
                    }}
                    title="Crear nuevo cliente"
                    data-testid="edit-new-client-btn"
                  >
                    <FaPlus aria-hidden /> Nuevo cliente
                  </button>
                </div>
              )
            ) : (
              `${reservation.mainClient?.firstName || ''} ${reservation.mainClient?.lastName || ''}`.trim() || '—'
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Habitación:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <select
                value={data.roomId || reservation.roomId || ''}
                onChange={(e) => onEditChange('roomId', parseInt(e.target.value, 10))}
                style={inputStyle}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            ) : reservation.room ? (
              <a href={`/rooms/${reservation.room.id}`} className={styles.link}>
                {reservation.room.name}
              </a>
            ) : (
              'Sin habitación'
            )}
          </span>
        </div>
        
        {!isEditing && reservation.room && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Tipo:</span>
            <span className={styles.infoValue}>{reservation.room.roomType?.name || 'No especificado'}</span>
          </div>
        )}
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Servicio:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <select
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar…</option>
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            ) : (
              getServiceTypeLabel(serviceId)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Total:</span>
          <span className={`${styles.infoValue} ${!isEditing ? styles.highlight : ''}`} data-testid="reservation-total">
            {isEditing ? (
              <input
                type="number"
                value={data.totalAmount ?? reservationTotal ?? 0}
                onChange={(e) => onEditChange('totalAmount', parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            ) : reservationTotal > 0 ? (
              formatCurrency(reservationTotal)
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      <div className={styles.notesBox}>
        <h4>Notas:</h4>
        {isEditing ? (
          <textarea
            value={data.notes ?? reservation.notes ?? ''}
            onChange={(e) => onEditChange('notes', e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
            placeholder="Notas adicionales…"
          />
        ) : (
          <p>{reservation.notes || 'Sin notas'}</p>
        )}
      </div>
    </div>
  );
};

export default GeneralInfoTab;
