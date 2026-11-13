import React, { useMemo } from 'react';
import { buildReservationStayTimeline } from '../utils/reservationStayTimeline';
import styles from './ReservationStayTimeline.module.css';

const circleClass = (kind) => {
  if (kind === 'checkin') return `${styles.circle} ${styles.circleCheckin}`;
  if (kind === 'checkout') return `${styles.circle} ${styles.circleCheckout}`;
  if (kind && String(kind).startsWith('change')) {
    return `${styles.circle} ${styles.circleChange}`;
  }
  return styles.circle;
};

const defaultFormatCurrency = (amount) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(amount);

const SegmentCard = ({ card }) => {
  if (!card) return null;
  const guestsLabel = `${card.guests} huésped${card.guests === 1 ? '' : 'es'}`;
  const nightsLabel = `${card.nights} noche${card.nights === 1 ? '' : 's'}`;
  return (
    <div className={styles.segmentCard} data-testid="timeline-segment-card">
      <span className={styles.segmentRoom}>{card.room}</span>
      <span className={styles.segmentService}>{card.service}</span>
      <span className={styles.segmentMeta}>{guestsLabel}</span>
      <span className={styles.segmentMeta}>{nightsLabel}</span>
    </div>
  );
};

/**
 * Timeline de hitos de la estadía — contenido principal del detalle.
 * Header: cliente, noches totales, monto total.
 * Cards de tramo entre check-in y check-out.
 */
const ReservationStayTimeline = ({
  reservation,
  getServiceTypeLabel,
  formatCurrency = defaultFormatCurrency
}) => {
  const timeline = useMemo(
    () => buildReservationStayTimeline(reservation, { getServiceTypeLabel }),
    [reservation, getServiceTypeLabel]
  );

  if (!reservation) return null;

  const { header } = timeline;
  const totalLabel =
    header.totalAmount > 0 ? formatCurrency(header.totalAmount) : '—';
  const nightsLabel = header.totalNights
    ? `${header.totalNights} noche${header.totalNights === 1 ? '' : 's'}`
    : '—';

  return (
    <section
      className={styles.timeline}
      aria-label="Timeline de la reserva"
      data-testid="reservation-stay-timeline"
    >
      <header className={styles.header} data-testid="timeline-header">
        <div className={styles.headerMain}>
          <h2 className={styles.clientName}>{header.clientName}</h2>
          <p className={styles.totalNights}>{nightsLabel}</p>
        </div>
        <div className={styles.totalBlock} data-testid="timeline-total">
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalAmount}>{totalLabel}</span>
        </div>
      </header>

      <div className={styles.track} role="list">
        {timeline.items.map((item) => {
          if (item.type === 'edge') {
            const edgeClass = [
              styles.itemEdge,
              item.compact ? styles.itemEdgeCompact : '',
              item.card ? styles.itemEdgeWithCard : ''
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={item.id}
                className={edgeClass}
                role="listitem"
                data-testid={`timeline-edge-${item.id}`}
              >
                <div className={styles.line} aria-hidden />
                {item.card ? <SegmentCard card={item.card} /> : null}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={styles.itemNode}
              role="listitem"
              data-testid={`timeline-node-${item.id}`}
            >
              <span className={circleClass(item.kind)} aria-hidden />
              <span className={styles.title}>{item.title}</span>
              {item.dateLabel ? (
                <span className={styles.date}>{item.dateLabel}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReservationStayTimeline;
