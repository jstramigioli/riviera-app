import { FiHome } from 'react-icons/fi';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RESERVATION_SOURCE_OPTIONS } from '../constants/reservationSource';
import { previewPromotion } from '../services/api';
import {
  buildDraftReservationForTimeline,
  collectSegmentNights,
  flattenPreviewAppliedRules,
  formatConfirmationMoney,
  mergeNightsWithPreview,
  summarizeConfirmationQuote
} from '../utils/reservationConfirmationQuote';
import ReservationStayTimeline from './ReservationStayTimeline';
import styles from './ReservationConfirmationModal.module.css';

const STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'INGRESADA', label: 'Ingresada' }
];

const ReservationConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  reservationData,
  isLoading = false,
  isEditing = false,
  source = '',
  onSourceChange
}) => {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [reservationStatus, setReservationStatus] = useState('PENDIENTE');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [segmentQuotes, setSegmentQuotes] = useState([]);
  const [showNightBreakdown, setShowNightBreakdown] = useState(false);

  const segments = reservationData?.segments || [];
  const selectedRoomsPerBlock = reservationData?.selectedRoomsPerBlock || [];

  const segmentNightGroups = useMemo(
    () => collectSegmentNights(segments, selectedRoomsPerBlock),
    [segments, selectedRoomsPerBlock]
  );

  const baseSubtotal = useMemo(
    () => segmentNightGroups.reduce((sum, seg) => sum + (seg.subtotal || 0), 0),
    [segmentNightGroups]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    const loadServiceTypes = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/service-types?hotelId=default-hotel');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setServiceTypes(data.data || []);
      } catch (error) {
        console.error('Error loading service types:', error);
      }
    };

    loadServiceTypes();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setReservationStatus('PENDIENTE');
    setShowNightBreakdown(false);
  }, [isOpen, reservationData]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    const loadPromoPreview = async () => {
      if (!segmentNightGroups.length) {
        setSegmentQuotes([]);
        setPromoError(null);
        return;
      }

      setPromoLoading(true);
      setPromoError(null);

      try {
        const quotes = await Promise.all(
          segmentNightGroups.map(async (seg) => {
            const fallbackNights = (seg.nights || []).map((night) => ({
              ...night,
              discountARS: 0,
              finalARS: night.originalARS,
              freeNight: false,
              promoLabel: null
            }));

            if (!seg.nightPrices.length) {
              return {
                segmentIndex: seg.segmentIndex,
                subtotal: seg.subtotal,
                discountARS: 0,
                nights: fallbackNights,
                promos: []
              };
            }

            try {
              const preview = await previewPromotion({
                layer: 'RATE',
                checkIn: seg.checkIn,
                checkOut: seg.checkOut,
                nights: seg.nightPrices.length,
                roomTypeId: seg.roomTypeId,
                serviceTypeId: seg.serviceTypeId,
                nightPrices: seg.nightPrices,
                hotelId: 'default-hotel',
                selectedRuleIds: []
              });
              const nights = mergeNightsWithPreview(seg.nights, preview);
              const promos = flattenPreviewAppliedRules(preview);
              const discountARS = nights.reduce((sum, n) => sum + (n.discountARS || 0), 0);
              return {
                segmentIndex: seg.segmentIndex,
                subtotal: seg.subtotal,
                discountARS,
                nights,
                promos
              };
            } catch (err) {
              console.warn('Preview promo RATE falló; se muestra tarifa sin descuento', err);
              return {
                segmentIndex: seg.segmentIndex,
                subtotal: seg.subtotal,
                discountARS: 0,
                nights: fallbackNights,
                promos: []
              };
            }
          })
        );

        if (!cancelled) {
          setSegmentQuotes(quotes);
          setPromoError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPromoError('No se pudo estimar el efecto de promociones');
          setSegmentQuotes(
            segmentNightGroups.map((seg) => ({
              segmentIndex: seg.segmentIndex,
              subtotal: seg.subtotal,
              discountARS: 0,
              nights: (seg.nights || []).map((night) => ({
                ...night,
                discountARS: 0,
                finalARS: night.originalARS,
                freeNight: false,
                promoLabel: null
              })),
              promos: []
            }))
          );
        }
      } finally {
        if (!cancelled) setPromoLoading(false);
      }
    };

    loadPromoPreview();
    return () => {
      cancelled = true;
    };
  }, [isOpen, segmentNightGroups]);

  const quote = useMemo(() => {
    if (segmentQuotes.length) return summarizeConfirmationQuote(segmentQuotes);
    return {
      subtotalARS: baseSubtotal,
      discountARS: 0,
      totalARS: baseSubtotal,
      nights: segmentNightGroups.flatMap((s) => s.nights || []),
      promos: [],
      hasPromos: false
    };
  }, [segmentQuotes, baseSubtotal, segmentNightGroups]);

  const timelineReservation = useMemo(
    () =>
      buildDraftReservationForTimeline({
        mainClient: reservationData?.mainClient,
        segments,
        selectedRoomsPerBlock,
        totalAmount: quote.totalARS
      }),
    [reservationData?.mainClient, segments, selectedRoomsPerBlock, quote.totalARS]
  );

  const getServiceTypeLabel = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find((st) => st.id === serviceTypeId);
    if (!serviceType) return `Servicio inválido (ID: ${serviceTypeId})`;
    return serviceType.name;
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(reservationStatus);
  };

  const handleClientClick = (clientId) => {
    if (clientId) navigate(`/clients/${clientId}`);
  };

  const title = isEditing ? 'Modificar reserva' : 'Confirmar reserva';

  return (
    <div className={styles.modal} role="presentation">
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-confirm-title"
      >
        <div className={styles.header}>
          <div className={styles.icon} aria-hidden="true">
            <FiHome />
          </div>
          <h2 id="reservation-confirm-title" className={styles.title}>
            {title}
          </h2>
        </div>

        <div className={styles.body}>
          <ReservationStayTimeline
            reservation={timelineReservation}
            getServiceTypeLabel={getServiceTypeLabel}
            onClientClick={handleClientClick}
            orientation="vertical"
            compact
            formatCurrency={formatConfirmationMoney}
          />

          <section className={styles.quoteSection} aria-labelledby="quote-heading">
            <h3 id="quote-heading" className={styles.sectionHeading}>
              Tarifa
            </h3>

            <div className={styles.quoteRows}>
              <div className={styles.quoteRow}>
                <span className={styles.quoteLabel}>Subtotal</span>
                <span className={styles.quoteValue}>
                  {formatConfirmationMoney(quote.subtotalARS)}
                </span>
              </div>

              {promoLoading ? (
                <div className={styles.quoteHint}>Calculando promociones…</div>
              ) : null}

              {promoError ? <div className={styles.quoteWarn}>{promoError}</div> : null}

              {quote.hasPromos ? (
                <div className={styles.promoList} data-testid="confirmation-promos">
                  {quote.promos.map((promo) => (
                    <div
                      key={promo.promotionRuleId || promo.code}
                      className={styles.promoRow}
                    >
                      <span className={styles.quoteLabel}>
                        {promo.label}
                        {promo.porcentaje != null ? ` (${promo.porcentaje}%)` : ''}
                        {promo.freeNightCount
                          ? ` · ${promo.freeNightCount} noche${promo.freeNightCount === 1 ? '' : 's'} sin cargo`
                          : ''}
                      </span>
                      <span className={styles.promoValue}>
                        −{formatConfirmationMoney(promo.montoARS)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                !promoLoading && (
                  <div className={styles.quoteHint}>Sin promociones RATE aplicadas</div>
                )
              )}

              <div className={`${styles.quoteRow} ${styles.quoteTotal}`}>
                <span className={styles.quoteLabel}>Total</span>
                <span className={styles.quoteValue} data-testid="confirmation-total">
                  {formatConfirmationMoney(quote.totalARS)}
                </span>
              </div>
            </div>

            {quote.nights.length > 0 ? (
              <div className={styles.breakdownBlock}>
                <button
                  type="button"
                  className={styles.breakdownToggle}
                  onClick={() => setShowNightBreakdown((v) => !v)}
                  aria-expanded={showNightBreakdown}
                >
                  {showNightBreakdown ? 'Ocultar desglose por noche' : 'Ver desglose por noche'}
                </button>
                {showNightBreakdown ? (
                  <table className={styles.breakdownTable} data-testid="confirmation-night-breakdown">
                    <thead>
                      <tr>
                        <th scope="col">Noche</th>
                        <th scope="col">Tarifa</th>
                        <th scope="col">Promo</th>
                        <th scope="col">Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.nights.map((night) => (
                        <tr key={`${night.date}-${night.nightIndex}`}>
                          <td>{night.dateLabel}</td>
                          <td>{formatConfirmationMoney(night.originalARS)}</td>
                          <td>
                            {night.discountARS > 0
                              ? `−${formatConfirmationMoney(night.discountARS)}`
                              : '—'}
                          </td>
                          <td>{formatConfirmationMoney(night.finalARS ?? night.originalARS)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            ) : (
              <div className={styles.quoteHint}>No hay tarifas cargadas para los tramos</div>
            )}
          </section>

          <section className={styles.metaSection} aria-labelledby="meta-heading">
            <h3 id="meta-heading" className={styles.sectionHeading}>
              Datos
            </h3>

            {reservationData?.notes && reservationData.notes.trim() !== '' ? (
              <div className={styles.metaField}>
                <span className={styles.metaLabel}>Notas</span>
                <p className={styles.notesText}>{reservationData.notes}</p>
              </div>
            ) : null}

            <div className={styles.metaField}>
              <label className={styles.metaLabel} htmlFor="confirm-source">
                Reservado por
              </label>
              <select
                id="confirm-source"
                className={styles.statusSelect}
                value={source || ''}
                onChange={(e) => onSourceChange?.(e.target.value)}
                aria-label="Reservado por"
              >
                <option value="">No especificado</option>
                {RESERVATION_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.metaField}>
              <label className={styles.metaLabel} htmlFor="confirm-status">
                Estado inicial
              </label>
              <select
                id="confirm-status"
                className={styles.statusSelect}
                value={reservationStatus}
                onChange={(e) => setReservationStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={styles.confirmButton}
            disabled={isLoading}
          >
            {isLoading
              ? isEditing
                ? 'Modificando…'
                : 'Creando…'
              : isEditing
                ? 'Modificar reserva'
                : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmationModal;
