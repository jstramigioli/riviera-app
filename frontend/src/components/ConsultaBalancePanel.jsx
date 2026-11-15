import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { RESERVATION_SOURCE_OPTIONS } from '../constants/reservationSource';
import { previewPromotion } from '../services/api';
import {
  collectSegmentNights,
  flattenPreviewAppliedRules,
  formatConfirmationMoney,
  mergeNightsWithPreview,
  summarizeConfirmationQuote
} from '../utils/reservationConfirmationQuote';
import {
  benefitUnitLabel,
  buildBenefitApplyPayload,
  collectManualBenefitSuggestions,
  mergeManualBenefitSuggestions
} from '../utils/promoManualBenefit';
import styles from './ConsultaBalancePanel.module.css';

/**
 * Panel derecho de Consulta: tarifas, promos y datos de confirmación inline.
 */
export default function ConsultaBalancePanel({
  segments = [],
  selectedRoomsPerBlock = {},
  notes = '',
  source = '',
  onSourceChange,
  reservationStatus = 'PENDIENTE',
  onStatusChange,
  onPromoApplyChange,
  isEditing = false,
  disabled = false
}) {
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [segmentQuotes, setSegmentQuotes] = useState([]);
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [manualValues, setManualValues] = useState({});
  const [showNightBreakdown, setShowNightBreakdown] = useState(false);

  const segmentNightGroups = useMemo(
    () => collectSegmentNights(segments, selectedRoomsPerBlock),
    [segments, selectedRoomsPerBlock]
  );

  const baseSubtotal = useMemo(
    () => segmentNightGroups.reduce((sum, seg) => sum + (seg.subtotal || 0), 0),
    [segmentNightGroups]
  );

  const hasSelection = segmentNightGroups.some(
    (seg) => (seg.nights && seg.nights.length > 0) || seg.subtotal > 0
  );

  const applyPayload = useMemo(() => buildBenefitApplyPayload(manualValues), [manualValues]);

  useEffect(() => {
    onPromoApplyChange?.(applyPayload);
  }, [applyPayload, onPromoApplyChange]);

  useEffect(() => {
    setShowNightBreakdown(false);
    setManualValues({});
    setManualSuggestions([]);
  }, [segments, selectedRoomsPerBlock]);

  useEffect(() => {
    let cancelled = false;

    const loadPromoPreview = async () => {
      if (!segmentNightGroups.length || !hasSelection) {
        setSegmentQuotes([]);
        setManualSuggestions([]);
        setPromoError(null);
        return;
      }

      setPromoLoading(true);
      setPromoError(null);

      const { benefitValueByRuleId, selectedRuleIds } = applyPayload;

      try {
        const results = await Promise.all(
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
                quote: {
                  segmentIndex: seg.segmentIndex,
                  subtotal: seg.subtotal,
                  discountARS: 0,
                  nights: fallbackNights,
                  promos: []
                },
                suggestions: []
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
                selectedRuleIds,
                benefitValueByRuleId,
                applySuggestedDefaults: true
              });
              const nights = mergeNightsWithPreview(seg.nights, preview);
              const promos = flattenPreviewAppliedRules(preview);
              const discountARS = nights.reduce((sum, n) => sum + (n.discountARS || 0), 0);
              return {
                quote: {
                  segmentIndex: seg.segmentIndex,
                  subtotal: seg.subtotal,
                  discountARS,
                  nights,
                  promos
                },
                suggestions: collectManualBenefitSuggestions(preview)
              };
            } catch (err) {
              console.warn('Preview promo RATE falló; se muestra tarifa sin descuento', err);
              return {
                quote: {
                  segmentIndex: seg.segmentIndex,
                  subtotal: seg.subtotal,
                  discountARS: 0,
                  nights: fallbackNights,
                  promos: []
                },
                suggestions: []
              };
            }
          })
        );

        if (!cancelled) {
          setSegmentQuotes(results.map((r) => r.quote));
          setManualSuggestions(mergeManualBenefitSuggestions(results.map((r) => r.suggestions)));
          setPromoError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPromoError('No se pudo estimar el efecto de promociones');
          setManualSuggestions([]);
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
  }, [segmentNightGroups, applyPayload, hasSelection]);

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

  /** Noches con tarifa > 0 (oculta noche=0 del desglose). */
  const billedNights = useMemo(
    () => (quote.nights || []).filter((night) => Number(night.originalARS) > 0),
    [quote.nights]
  );

  const setManualValue = (ruleId, value) => {
    setManualValues((prev) => ({ ...prev, [ruleId]: value }));
  };

  if (!hasSelection) {
    return (
      <aside className={styles.panel} aria-label="Tarifas y promociones">
        <h2 className={styles.heading}>Tarifa</h2>
        <p className={styles.emptyHint}>
          Seleccioná habitación en cada tramo para ver el desglose y las promociones.
        </p>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Tarifas y promociones">
      <section className={styles.section} aria-labelledby="balance-quote-heading">
        <div className={styles.headingRow}>
          <h2 id="balance-quote-heading" className={styles.heading}>
            Tarifa
          </h2>
          {billedNights.length > 0 ? (
            <button
              type="button"
              className={styles.breakdownIconBtn}
              onClick={() => setShowNightBreakdown((v) => !v)}
              aria-expanded={showNightBreakdown}
              aria-controls="balance-night-breakdown"
              aria-label={
                showNightBreakdown
                  ? 'Ocultar desglose por noche'
                  : 'Ver desglose por noche'
              }
              data-testid="confirmation-night-breakdown-toggle"
            >
              {showNightBreakdown ? (
                <FiChevronDown aria-hidden="true" />
              ) : (
                <FiChevronRight aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>

        <div className={styles.quoteRows}>
          {showNightBreakdown && billedNights.length > 0 ? (
            <div
              id="balance-night-breakdown"
              className={styles.breakdownBlock}
              data-testid="confirmation-night-breakdown-wrap"
            >
              <table className={styles.breakdownTable} data-testid="confirmation-night-breakdown">
                <thead>
                  <tr>
                    <th scope="col">Noche</th>
                    <th scope="col">Tarifa</th>
                  </tr>
                </thead>
                <tbody>
                  {billedNights.map((night) => (
                    <tr key={`${night.date}-${night.nightIndex}`}>
                      <td>{night.dateLabel}</td>
                      <td>{formatConfirmationMoney(night.originalARS)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className={styles.quoteRow}>
            <span className={styles.quoteLabel}>Subtotal</span>
            <span className={styles.quoteValue}>
              {formatConfirmationMoney(quote.subtotalARS)}
            </span>
          </div>

          {billedNights.length === 0 && quote.nights.length === 0 ? (
            <div className={styles.quoteHint}>No hay tarifas cargadas para los tramos</div>
          ) : null}

          {promoLoading ? (
            <div className={styles.quoteHint}>Calculando promociones…</div>
          ) : null}

          {promoError ? <div className={styles.quoteWarn}>{promoError}</div> : null}

          {manualSuggestions.length > 0 ? (
            <div className={styles.manualPromoBlock} data-testid="confirmation-manual-promos">
              <div className={styles.manualPromoTitle}>Valor al aplicar</div>
              <p className={styles.quoteHint}>
                Estas promociones no tienen valor fijo: indicá el beneficio para incluirlas.
              </p>
              {manualSuggestions.map((s) => (
                <label key={s.id} className={styles.manualPromoRow}>
                  <span className={styles.manualPromoLabel}>{s.label}</span>
                  <span className={styles.manualPromoInputWrap}>
                    <input
                      type="number"
                      min="0"
                      step={s.benefitType === 'FREE_NIGHTS' ? '1' : '0.01'}
                      className={styles.manualPromoInput}
                      value={manualValues[s.id] ?? ''}
                      onChange={(e) => setManualValue(s.id, e.target.value)}
                      placeholder="—"
                      aria-label={`Valor de ${s.label}`}
                      disabled={disabled || promoLoading}
                    />
                    <span className={styles.manualPromoUnit} aria-hidden="true">
                      {benefitUnitLabel(s.benefitType)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

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
          ) : null}

          <div className={`${styles.quoteRow} ${styles.quoteTotal}`}>
            <span className={styles.quoteLabel}>Total</span>
            <span className={styles.quoteValue} data-testid="confirmation-total">
              {formatConfirmationMoney(quote.totalARS)}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="balance-meta-heading">
        <h2 id="balance-meta-heading" className={styles.heading}>
          Datos
        </h2>

        {notes && notes.trim() !== '' ? (
          <div className={styles.metaField}>
            <span className={styles.metaLabel}>Notas</span>
            <p className={styles.notesText}>{notes}</p>
          </div>
        ) : null}

        <div className={styles.metaField}>
          <label className={styles.metaLabel} htmlFor="balance-source">
            Reservado por
          </label>
          <select
            id="balance-source"
            className={styles.statusSelect}
            value={source || ''}
            onChange={(e) => onSourceChange?.(e.target.value)}
            aria-label="Reservado por"
            disabled={disabled}
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
          <label className={styles.metaLabel} htmlFor="balance-status">
            {isEditing ? 'Estado' : 'Estado inicial'}
          </label>
          <select
            id="balance-status"
            className={styles.statusSelect}
            value={reservationStatus}
            onChange={(e) => onStatusChange?.(e.target.value)}
            disabled={disabled}
          >
            <option value="PENDIENTE">Pendiente</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="INGRESADA">Ingresada</option>
          </select>
        </div>
      </section>
    </aside>
  );
}
