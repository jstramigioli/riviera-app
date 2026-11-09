import React from 'react';
import useReservationStatuses from '../../hooks/useReservationStatuses';
import styles from './ReservationTabs.module.css';

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '0.95rem',
  boxSizing: 'border-box'
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

const GeneralInfoTab = ({ 
  reservation,
  editData,
  isEditing = false,
  rooms = [],
  clients = [],
  serviceTypes = [],
  onEditChange,
  financialSummary, 
  formatDate, 
  formatCurrency, 
  getServiceTypeLabel,
  getStatusLabel 
}) => {
  const { statuses: statusOptions } = useReservationStatuses();

  if (!reservation) return null;

  const data = isEditing && editData ? editData : reservation;

  const checkIn = data.segments?.[0]?.startDate || data.checkIn;
  const checkOut = data.segments?.[data.segments?.length - 1]?.endDate || data.checkOut;
  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    : 0;
  const guestCount = data.segments?.[0]?.guestCount || data.requiredGuests || 1;
  const serviceId = data.segments?.[0]?.services?.[0] || data.reservationType || '';

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
      <h3 className={styles.sectionTitle}>Información General</h3>
      
      {financialSummary && (
        <div className={styles.financialAlert}>
          <div className={styles.financialAlertHeader}>Estado Financiero</div>
          <div className={styles.financialAlertBody}>
            <div className={styles.financialRow}>
              <span>Total Cargos:</span>
              <strong>{formatCurrency(financialSummary.resumen.totalCargos)}</strong>
            </div>
            <div className={styles.financialRow}>
              <span>Total Pagos:</span>
              <strong>{formatCurrency(financialSummary.resumen.totalPagos)}</strong>
            </div>
            <div className={`${styles.financialRow} ${styles.saldoRow} ${styles[financialSummary.resumen.estadoPago]}`}>
              <span>Saldo:</span>
              <strong>{formatCurrency(financialSummary.resumen.saldo)}</strong>
            </div>
            <div className={styles.estadoPagoTag}>
              {financialSummary.resumen.estadoPago === 'PENDIENTE' && 'Pendiente de pago'}
              {financialSummary.resumen.estadoPago === 'PAGADO' && 'Pagado completamente'}
              {financialSummary.resumen.estadoPago === 'A_FAVOR' && 'Saldo a favor'}
            </div>
          </div>
        </div>
      )}

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

        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Cliente:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <select
                value={data.mainClientId || reservation.mainClientId || ''}
                onChange={(e) => onEditChange('mainClientId', parseInt(e.target.value, 10))}
                style={inputStyle}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </option>
                ))}
              </select>
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
          <span className={styles.infoLabel}>Tarifa Base:</span>
          <span className={`${styles.infoValue} ${!isEditing ? styles.highlight : ''}`}>
            {isEditing ? (
              <input
                type="number"
                value={data.totalAmount ?? reservation.totalAmount ?? 0}
                onChange={(e) => onEditChange('totalAmount', parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            ) : reservation.totalAmount != null ? (
              formatCurrency(reservation.totalAmount)
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
