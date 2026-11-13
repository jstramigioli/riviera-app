import React, { useEffect, useMemo, useState } from 'react';
import { buildReservationStayTimeline } from '../utils/reservationStayTimeline';
import styles from './ReservationStayTimeline.module.css';

const NARROW_MQ = '(max-width: 720px)';

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

const useIsNarrow = (enabled) => {
  const [matches, setMatches] = useState(() => {
    if (!enabled || typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(NARROW_MQ).matches;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.matchMedia) {
      setMatches(false);
      return undefined;
    }
    const mq = window.matchMedia(NARROW_MQ);
    const sync = () => setMatches(mq.matches);
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, [enabled]);

  return matches;
};

const SegmentCard = ({ card, vertical }) => {
  if (!card) return null;
  const guestsLabel = `${card.guests} huésped${card.guests === 1 ? '' : 'es'}`;
  const nightsLabel = `${card.nights} noche${card.nights === 1 ? '' : 's'}`;
  return (
    <div className={styles.segmentStack}>
      {!vertical ? <span className={styles.segmentConnector} aria-hidden /> : null}
      <div className={styles.segmentCard} data-testid="timeline-segment-card">
        <span className={styles.segmentRoom}>
          Habitación: {card.room} - {card.roomType || '—'}
        </span>
        <span className={styles.segmentService}>{card.service}</span>
        <span className={styles.segmentMeta}>{guestsLabel}</span>
        <span className={styles.segmentMeta}>{nightsLabel}</span>
      </div>
    </div>
  );
};

/**
 * Timeline de hitos de la estadía — contenido principal del detalle / panel Libro.
 * Header: cliente (clickeable), noches totales, monto total.
 * Cards de tramo entre check-in y check-out.
 *
 * orientation:
 * - auto (default): horizontal en ancho, vertical en viewport ≤720px
 * - vertical / horizontal: fuerza el layout
 * hideHeader: omite cliente/noches/total (el panel Libro los muestra fuera del marco)
 */
const ReservationStayTimeline = ({
  reservation,
  getServiceTypeLabel,
  formatCurrency = defaultFormatCurrency,
  onClientClick,
  orientation = 'auto',
  compact = false,
  hideHeader = false
}) => {
  const timeline = useMemo(
    () => buildReservationStayTimeline(reservation, { getServiceTypeLabel }),
    [reservation, getServiceTypeLabel]
  );

  const isNarrow = useIsNarrow(orientation === 'auto');
  const isVertical =
    orientation === 'vertical' || (orientation === 'auto' && isNarrow);

  if (!reservation) return null;

  const { header } = timeline;
  const totalLabel =
    header.totalAmount > 0 ? formatCurrency(header.totalAmount) : '—';
  const nightsLabel = header.totalNights
    ? `${header.totalNights} noche${header.totalNights === 1 ? '' : 's'}`
    : '—';
  const canOpenClient = Boolean(header.clientId && onClientClick);

  const rootClass = [
    styles.timeline,
    isVertical ? styles.timelineVertical : styles.timelineHorizontal,
    compact ? styles.timelineCompact : '',
    hideHeader ? styles.timelineNoHeader : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={rootClass}
      aria-label="Timeline de la reserva"
      data-testid="reservation-stay-timeline"
      data-orientation={isVertical ? 'vertical' : 'horizontal'}
    >
      {!hideHeader ? (
        <header className={styles.header} data-testid="timeline-header">
          <div className={styles.headerMain}>
            {canOpenClient ? (
              <button
                type="button"
                className={styles.clientNameButton}
                onClick={() => onClientClick(header.clientId)}
                title="Ver perfil del cliente"
                data-testid="timeline-client-link"
              >
                {header.clientName}
              </button>
            ) : (
              <h2 className={styles.clientName}>{header.clientName}</h2>
            )}
            <p className={styles.totalNights}>{nightsLabel}</p>
          </div>
          <div className={styles.totalBlock} data-testid="timeline-total">
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalAmount}>{totalLabel}</span>
          </div>
        </header>
      ) : null}

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
                {item.card ? (
                  <SegmentCard card={item.card} vertical={isVertical} />
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
              <div className={styles.nodeText}>
                <span className={styles.title}>{item.title}</span>
                {item.dateLabel ? (
                  <span className={styles.date}>{item.dateLabel}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReservationStayTimeline;
