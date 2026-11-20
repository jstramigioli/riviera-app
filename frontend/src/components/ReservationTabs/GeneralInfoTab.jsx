import React, { useMemo } from 'react';
import useReservationStatuses from '../../hooks/useReservationStatuses';
import { getDisplaySegments } from '../../utils/virtualRoomReservation';
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

/**
 * Información general reducida: fechas, estado, tipo de habitación y notas.
 * Cliente / noches / total viven en el header del panel Libro (fuera del marco
 * timeline) o en el header del timeline en la página de detalle;
 * habitación·servicio·huéspedes viven en las cards del timeline;
 * medio/origen se edita en el formulario de edición y se muestra solo lectura en el panel.
 */
const GeneralInfoTab = ({
  reservation,
  editData,
  isEditing = false,
  onEditChange,
  formatDate,
  getStatusLabel
}) => {
  const { statuses: statusOptions } = useReservationStatuses();

  const data = isEditing && editData ? editData : reservation;
  const displaySegments = useMemo(
    () => getDisplaySegments(data?.segments || reservation?.segments || []),
    [data?.segments, reservation?.segments]
  );

  if (!reservation) return null;

  const checkIn = data.checkIn || displaySegments[0]?.startDate;
  const checkOut =
    data.checkOut ||
    displaySegments[displaySegments.length - 1]?.endDate;

  const handleSegmentField = (field, value) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) segments[0] = {};
    segments[0] = { ...segments[0], [field]: value };
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

        {!isEditing && reservation.room && !displaySegments[0]?.isVirtual && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Tipo:</span>
            <span className={styles.infoValue}>{reservation.room.roomType?.name || 'No especificado'}</span>
          </div>
        )}
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
