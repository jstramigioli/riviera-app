import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiChevronRight, FiCopy, FiPlus, FiX } from 'react-icons/fi';
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
  collectOptionalPromoChoices,
  formatOptionalBenefitValue,
  isRemovableOptionalPromo,
  mergeManualBenefitSuggestions
} from '../utils/promoManualBenefit';
import { buildStayNightPlan } from '../utils/stayPromoPreview';
import {
  applyDistributedTotalsToNights,
  distributeStayTotal
} from '../utils/distributeStayTotal';
import styles from './ConsultaBalancePanel.module.css';

/** @typedef {'automatic' | 'manual'} PricingMode */

/**
 * Panel derecho de Consulta: tarifas, promos y datos de confirmación inline.
 */
export default function ConsultaBalancePanel({
  segments = [],
  selectedRoomsPerBlock = {},
  notes = '',
  onNotesChange,
  source = '',
  onSourceChange,
  reservationStatus = 'PENDIENTE',
  onStatusChange,
  onPromoApplyChange,
  onManualPricingChange,
  isEditing = false,
  disabled = false,
  showActions = false,
  onCopy,
  onCreateReservation,
  canConfirm = false,
  isCreatingReservation = false,
  applyRateChanges = true,
  onApplyRateChanges,
  hasClientName = false
}) {
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [segmentQuotes, setSegmentQuotes] = useState([]);
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [optionalChoices, setOptionalChoices] = useState([]);
  const [manualValues, setManualValues] = useState({});
  const [selectedOptionalIds, setSelectedOptionalIds] = useState([]);
  const [deselectedRuleIds, setDeselectedRuleIds] = useState([]);
  const [showNightBreakdown, setShowNightBreakdown] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  /** @type {[PricingMode, function]} */
  const [pricingMode, setPricingMode] = useState('automatic');
  const [manualStayTotalInput, setManualStayTotalInput] = useState('');
  const addMenuRef = useRef(null);
  const isManualPricing = pricingMode === 'manual';

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

  const applyPayload = useMemo(
    () =>
      buildBenefitApplyPayload({
        manualValues,
        selectedOptionalIds,
        deselectedRuleIds
      }),
    [manualValues, selectedOptionalIds, deselectedRuleIds]
  );

  useEffect(() => {
    onPromoApplyChange?.(applyPayload);
  }, [applyPayload, onPromoApplyChange]);

  const stayNightCount = useMemo(
    () => segmentNightGroups.reduce((sum, seg) => sum + (seg.nights?.length || 0), 0),
    [segmentNightGroups]
  );

  const manualStayTotal = useMemo(() => {
    if (manualStayTotalInput === '' || manualStayTotalInput == null) return null;
    const n = Number(manualStayTotalInput);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [manualStayTotalInput]);

  useEffect(() => {
    if (!isManualPricing) {
      onManualPricingChange?.({
        createdWithManualRate: false,
        manualStayTotal: null,
        nightAmounts: null
      });
      return;
    }
    const amounts =
      manualStayTotal == null || stayNightCount <= 0
        ? null
        : distributeStayTotal(manualStayTotal, stayNightCount);
    onManualPricingChange?.({
      createdWithManualRate: true,
      manualStayTotal,
      nightAmounts: amounts
    });
  }, [
    isManualPricing,
    manualStayTotal,
    stayNightCount,
    onManualPricingChange
  ]);

  useEffect(() => {
    setShowNightBreakdown(false);
    setManualValues({});
    setManualSuggestions([]);
    setOptionalChoices([]);
    setSelectedOptionalIds([]);
    setDeselectedRuleIds([]);
    setAddMenuOpen(false);
    setPricingMode('automatic');
    setManualStayTotalInput('');
  }, [segments, selectedRoomsPerBlock]);

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const onDocClick = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [addMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadPromoPreview = async () => {
      if (!segmentNightGroups.length || !hasSelection) {
        setSegmentQuotes([]);
        setManualSuggestions([]);
        setOptionalChoices([]);
        setPromoError(null);
        return;
      }

      // Precio manual: sin preview de promos; total = input repartido.
      if (pricingMode === 'manual') {
        if (manualStayTotal == null || stayNightCount <= 0) {
          if (!cancelled) {
            setSegmentQuotes([]);
            setManualSuggestions([]);
            setOptionalChoices([]);
            setPromoError(null);
            setPromoLoading(false);
          }
          return;
        }
        const stay = buildStayNightPlan(segmentNightGroups);
        const distributed = applyDistributedTotalsToNights(stay.nights, manualStayTotal);
        const quotes = stay.offsets.map((off) => {
          const nights = distributed.slice(off.start, off.end).map((night, local) => ({
            ...night,
            nightIndex: local,
            segmentIndex: off.segmentIndex
          }));
          const subtotal = nights.reduce((sum, n) => sum + (Number(n.finalARS) || 0), 0);
          return {
            segmentIndex: off.segmentIndex,
            subtotal,
            discountARS: 0,
            nights,
            promos: []
          };
        });
        if (!cancelled) {
          setSegmentQuotes(quotes);
          setManualSuggestions([]);
          setOptionalChoices([]);
          setPromoError(null);
          setPromoLoading(false);
        }
        return;
      }

      setPromoLoading(true);
      setPromoError(null);

      const { benefitValueByRuleId, selectedRuleIds, deselectedRuleIds: deselected } =
        applyPayload;

      try {
        const stay = buildStayNightPlan(segmentNightGroups);
        const fallbackQuotes = segmentNightGroups.map((seg) => ({
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
        }));

        if (!stay.nightPrices.length) {
          if (!cancelled) {
            setSegmentQuotes(fallbackQuotes);
            setManualSuggestions([]);
            setOptionalChoices([]);
            setPromoError(null);
          }
          return;
        }

        try {
          // Una sola evaluación RATE sobre la estadía completa (no por segmento).
          const preview = await previewPromotion({
            layer: 'RATE',
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            nights: stay.nightPrices.length,
            roomTypeId: stay.roomTypeId,
            serviceTypeId: stay.serviceTypeId,
            nightPrices: stay.nightPrices,
            hotelId: 'default-hotel',
            selectedRuleIds,
            deselectedRuleIds: deselected,
            benefitValueByRuleId,
            applySuggestedDefaults: true
          });
          const stayNightsMerged = mergeNightsWithPreview(stay.nights, preview);
          const promos = flattenPreviewAppliedRules(preview);
          const discountFromPromos = promos.reduce(
            (sum, p) => sum + (Number(p.montoARS) || 0),
            0
          );
          const stayDiscount =
            preview?.discountARS != null && Number.isFinite(Number(preview.discountARS))
              ? Number(preview.discountARS)
              : discountFromPromos;

          const quotes = stay.offsets.map((off, idx) => {
            const nights = stayNightsMerged
              .slice(off.start, off.end)
              .map((night, local) => ({
                ...night,
                nightIndex: local,
                segmentIndex: off.segmentIndex
              }));
            return {
              segmentIndex: off.segmentIndex,
              subtotal: off.subtotal,
              // Promos + descuento canónico una sola vez (estadía completa).
              discountARS: idx === 0 ? stayDiscount : 0,
              nights,
              promos: idx === 0 ? promos : []
            };
          });

          if (!cancelled) {
            setSegmentQuotes(quotes.length ? quotes : fallbackQuotes);
            setManualSuggestions(collectManualBenefitSuggestions(preview));
            setOptionalChoices(collectOptionalPromoChoices(preview, promos));
            setPromoError(null);
          }
        } catch (err) {
          console.warn('Preview promo RATE falló; se muestra tarifa sin descuento', err);
          if (!cancelled) {
            setSegmentQuotes(fallbackQuotes);
            setManualSuggestions([]);
            setOptionalChoices([]);
            setPromoError(null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPromoError('No se pudo estimar el efecto de promociones');
          setManualSuggestions([]);
          setOptionalChoices([]);
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
  }, [
    segmentNightGroups,
    applyPayload,
    hasSelection,
    pricingMode,
    manualStayTotal,
    stayNightCount
  ]);

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

  /** Noches con tarifa > 0 (oculta noche=0 del desglose). En manual muestra todas. */
  const billedNights = useMemo(() => {
    const nights = quote.nights || [];
    if (isManualPricing) return nights;
    return nights.filter((night) => Number(night.originalARS) > 0);
  }, [quote.nights, isManualPricing]);

  const setManualValue = (ruleId, value) => {
    setManualValues((prev) => ({ ...prev, [ruleId]: value }));
  };

  const addOptionalPromo = (choice) => {
    if (!choice || choice.id == null) return;
    const id = Number(choice.id);
    if (choice.defaultOn) {
      setDeselectedRuleIds((prev) => prev.filter((x) => Number(x) !== id));
    } else {
      setSelectedOptionalIds((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
    }
    setAddMenuOpen(false);
  };

  const removeOptionalPromo = (promo) => {
    const id = Number(promo?.promotionRuleId ?? promo?.id);
    if (!Number.isFinite(id)) return;
    if (promo.defaultOn || String(promo.modality || '').toUpperCase() === 'SUGERIDA') {
      setDeselectedRuleIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setSelectedOptionalIds((prev) => prev.filter((x) => Number(x) !== id));
    } else {
      setSelectedOptionalIds((prev) => prev.filter((x) => Number(x) !== id));
    }
    setManualValues((prev) => {
      if (prev[id] == null && prev[String(id)] == null) return prev;
      const next = { ...prev };
      delete next[id];
      delete next[String(id)];
      return next;
    });
  };

  const notesField = (
    <div className={styles.notesField} data-testid="balance-notes">
      <label className={styles.metaLabel} htmlFor="balance-notes">
        Notas de la reserva
      </label>
      <textarea
        id="balance-notes"
        className={styles.notesTextarea}
        value={notes || ''}
        onChange={(e) => onNotesChange?.(e.target.value)}
        placeholder="Notas de la reserva"
        rows={3}
        disabled={disabled}
      />
    </div>
  );

  const actionsFooter = showActions ? (
    <div className={styles.actionsFooter} data-testid="balance-actions">
      <button
        type="button"
        className={styles.copyIconBtn}
        onClick={onCopy}
        title="Copiar datos al portapapeles"
        aria-label="Copiar datos al portapapeles"
        disabled={disabled}
      >
        <FiCopy aria-hidden="true" />
      </button>

      {isEditing ? (
        <label
          className={styles.rateToggle}
          title="Si está apagado, podés cambiar habitación/fechas sin regenerar cargos ni tarifas"
        >
          <input
            type="checkbox"
            checked={applyRateChanges}
            onChange={(e) => onApplyRateChanges?.(e.target.checked)}
            data-testid="apply-rate-changes-toggle"
          />
          Aplicar cambios de tarifa
        </label>
      ) : null}

      {hasClientName ? (
        <button
          type="button"
          className={styles.confirmBtn}
          onClick={onCreateReservation}
          disabled={!canConfirm || isCreatingReservation || disabled}
          title={
            !canConfirm
              ? 'Seleccioná una habitación para cada segmento'
              : isEditing
                ? 'Modificar la reserva'
                : 'Crear la reserva'
          }
        >
          {isCreatingReservation
            ? isEditing
              ? 'Modificando…'
              : 'Creando…'
            : isEditing
              ? 'Modificar reserva'
              : 'Crear reserva'}
        </button>
      ) : null}
    </div>
  ) : null;

  if (!hasSelection) {
    return (
      <aside className={styles.panel} aria-label="Tarifas y promociones">
        <div className={styles.panelBody}>
          <h2 className={styles.heading}>Tarifa</h2>
          <p className={styles.emptyHint}>
            Seleccioná habitación en cada tramo para ver el desglose y las promociones.
          </p>
          {notesField}
        </div>
        {actionsFooter}
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Tarifas y promociones">
      <div className={styles.panelBody}>
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
              {quote.promos.map((promo) => {
                const removable = isRemovableOptionalPromo(promo);
                return (
                  <div
                    key={promo.promotionRuleId || promo.code}
                    className={styles.promoBlock}
                  >
                    <div className={styles.promoRow}>
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
                    {removable ? (
                      <button
                        type="button"
                        className={styles.promoRemoveBtn}
                        onClick={() => removeOptionalPromo(promo)}
                        aria-label={`Quitar ${promo.label}`}
                        disabled={disabled || promoLoading}
                        data-testid={`promo-remove-${promo.promotionRuleId}`}
                      >
                        <FiX aria-hidden="true" />
                        <span>Quitar</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className={styles.addPromoWrap} ref={addMenuRef}>
            <button
              type="button"
              className={styles.addPromoBtn}
              onClick={() => setAddMenuOpen((v) => !v)}
              aria-expanded={addMenuOpen}
              aria-haspopup="listbox"
              disabled={disabled || promoLoading || optionalChoices.length === 0}
              data-testid="add-optional-promo"
            >
              <FiPlus aria-hidden="true" />
              promoción
            </button>
            {addMenuOpen && optionalChoices.length > 0 ? (
              <ul
                className={styles.addPromoMenu}
                role="listbox"
                aria-label="Promociones opcionales"
              >
                {optionalChoices.map((choice) => {
                  const valueLabel = formatOptionalBenefitValue(choice);
                  return (
                    <li key={choice.id} role="option">
                      <button
                        type="button"
                        className={styles.addPromoOption}
                        onClick={() => addOptionalPromo(choice)}
                      >
                        <span className={styles.addPromoName}>{choice.label}</span>
                        {valueLabel ? (
                          <span className={styles.addPromoMeta}>{valueLabel}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className={`${styles.quoteRow} ${styles.quoteTotal}`}>
            <span className={styles.quoteLabel}>Total</span>
            <span className={styles.quoteValue} data-testid="confirmation-total">
              {formatConfirmationMoney(quote.totalARS)}
            </span>
          </div>

          {notesField}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="balance-meta-heading">
        <h2 id="balance-meta-heading" className={styles.heading}>
          Datos
        </h2>

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
      </div>
      {actionsFooter}
    </aside>
  );
}
