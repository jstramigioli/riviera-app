import React from 'react';
import styles from './ReservationTabs.module.css';

const GeneralInfoTab = ({ 
  reservation, 
  financialSummary, 
  formatDate, 
  formatCurrency, 
  getServiceTypeLabel,
  getStatusLabel 
}) => {
  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className={styles.tabContent}>
      <h3 className={styles.sectionTitle}>📋 Información General</h3>
      
      {/* Resumen Financiero */}
      {financialSummary && (
        <div className={styles.financialAlert}>
          <div className={styles.financialAlertHeader}>💰 Estado Financiero</div>
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
              {financialSummary.resumen.estadoPago === 'PENDIENTE' && '⚠️ Pendiente de pago'}
              {financialSummary.resumen.estadoPago === 'PAGADO' && '✅ Pagado completamente'}
              {financialSummary.resumen.estadoPago === 'A_FAVOR' && '💵 Saldo a favor'}
            </div>
          </div>
        </div>
      )}

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Check-in:</span>
          <span className={styles.infoValue}>{formatDate(reservation.checkIn)}</span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Check-out:</span>
          <span className={styles.infoValue}>{formatDate(reservation.checkOut)}</span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Noches:</span>
          <span className={styles.infoValue}>{nights}</span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Estado:</span>
          <span className={`${styles.infoValue} ${styles.statusBadge} ${styles[reservation.status]}`}>
            {getStatusLabel(reservation.status)}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Huéspedes:</span>
          <span className={styles.infoValue}>
            {reservation.segments?.[0]?.guestCount || reservation.requiredGuests || 1} persona{(reservation.segments?.[0]?.guestCount || reservation.requiredGuests || 1) > 1 ? 's' : ''}
          </span>
        </div>
        
        {reservation.room && (
          <>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Habitación:</span>
              <span className={styles.infoValue}>
                <a href={`/rooms/${reservation.room.id}`} className={styles.link}>
                  {reservation.room.name}
                </a>
              </span>
            </div>
            
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Tipo:</span>
              <span className={styles.infoValue}>{reservation.room.roomType?.name || 'No especificado'}</span>
            </div>
          </>
        )}
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Servicio:</span>
          <span className={styles.infoValue}>
            {getServiceTypeLabel(reservation.segments?.[0]?.services?.[0] || reservation.reservationType)}
          </span>
        </div>
        
        {reservation.totalAmount && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Tarifa Base:</span>
            <span className={`${styles.infoValue} ${styles.highlight}`}>
              {formatCurrency(reservation.totalAmount)}
            </span>
          </div>
        )}
      </div>

      {reservation.notes && (
        <div className={styles.notesBox}>
          <h4>📝 Notas:</h4>
          <p>{reservation.notes}</p>
        </div>
      )}
    </div>
  );
};

export default GeneralInfoTab;


