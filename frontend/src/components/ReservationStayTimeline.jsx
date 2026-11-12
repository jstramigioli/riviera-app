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

/**
 * Timeline de hitos de la estadía (arriba del detalle).
 * Nodos: creación, check-in, cambios multi-tramo, check-out.
 * Entre nodos: «habitación · servicio».
 */
const ReservationStayTimeline = ({ reservation, getServiceTypeLabel }) => {
  const timeline = useMemo(
    () => buildReservationStayTimeline(reservation, { getServiceTypeLabel }),
    [reservation, getServiceTypeLabel]
  );

  if (!reservation) return null;

  return (
    <section
      className={styles.timeline}
      aria-label="Timeline de la reserva"
      data-testid="reservation-stay-timeline"
    >
      <div className={styles.track} role="list">
        {timeline.items.map((item) => {
          if (item.type === 'edge') {
            return (
              <div
                key={item.id}
                className={styles.itemEdge}
                role="listitem"
                data-testid={`timeline-edge-${item.id}`}
              >
                <div className={styles.line} aria-hidden />
                {item.label ? (
                  <span className={styles.edgeLabel} title={item.label}>
                    {item.label}
                  </span>
                ) : null}
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
