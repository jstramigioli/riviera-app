/**
 * Cotización previa al crear/modificar reserva (modal de confirmación).
 * Arma shape de timeline + desglose de tarifas + preview de promos RATE.
 */

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const dateKey = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const formatNightLabel = (value) => {
  const key = dateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return value || '—';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
};

/** Precio de una noche desde ratesData canónico. */
export function nightPriceFromRate(rate) {
  if (!rate) return 0;
  return money(rate.serviceRate ?? rate.finalRate ?? rate.baseRate ?? rate.price ?? 0);
}

/**
 * Noches cotizadas por segmento desde selectedRoomsPerBlock[].ratesData.
 */
export function collectSegmentNights(segments = [], selectedRoomsPerBlock = []) {
  return (segments || []).map((segment, index) => {
    const room = selectedRoomsPerBlock?.[index] || null;
    const rates = Array.isArray(room?.ratesData?.rates) ? room.ratesData.rates : [];
    const nights = rates.map((rate, nightIndex) => {
      const date = rate.dateString || rate.date || null;
      const price = nightPriceFromRate(rate);
      return {
        nightIndex,
        date,
        dateLabel: formatNightLabel(date),
        originalARS: price,
        seasonBlockName: rate.seasonBlockName || rate.blockName || null
      };
    });
    const subtotal = money(
      nights.reduce((sum, n) => sum + n.originalARS, 0) ||
        Number(room?.ratesData?.totalAmount) ||
        Number(room?.price) ||
        0
    );
    return {
      segmentIndex: index,
      checkIn: segment?.checkIn || null,
      checkOut: segment?.checkOut || null,
      roomTypeId: room?.roomType?.id || room?.roomTypeId || segment?.roomTypeId || null,
      serviceTypeId: segment?.serviceType || null,
      roomName: room?.name || null,
      nights,
      nightPrices: nights.map((n) => n.originalARS),
      subtotal
    };
  });
}

/**
 * Shape compatible con ReservationStayTimeline / buildReservationStayTimeline.
 */
export function buildDraftReservationForTimeline({
  mainClient,
  segments = [],
  selectedRoomsPerBlock = [],
  totalAmount
} = {}) {
  const mappedSegments = (segments || []).map((segment, index) => {
    const room = selectedRoomsPerBlock?.[index] || null;
    return {
      startDate: segment.checkIn,
      endDate: segment.checkOut,
      checkIn: segment.checkIn,
      checkOut: segment.checkOut,
      guestCount: segment.requiredGuests,
      requiredGuests: segment.requiredGuests,
      serviceType: segment.serviceType,
      services: segment.serviceType ? [segment.serviceType] : [],
      requiredRoomId: segment.requiredRoomId || null,
      fixed: Boolean(segment.fixed || segment.requiredRoomId),
      roomId: room?.id ?? null,
      room,
      roomType: room?.roomType || null,
      baseRate: money(
        room?.ratesData?.averageRatePerNight ||
          (room?.price && segment.checkIn && segment.checkOut
            ? null
            : room?.price) ||
          0
      ) || undefined
    };
  });

  return {
    mainClient: mainClient || null,
    checkIn: mappedSegments[0]?.startDate || null,
    checkOut: mappedSegments[mappedSegments.length - 1]?.endDate || null,
    totalAmount: money(totalAmount),
    requiredGuests: mappedSegments[0]?.guestCount || 1,
    segments: mappedSegments
  };
}

/**
 * Agrega appliedRules de una respuesta preview RATE (stay con nightPrices o noche suelta).
 * Importante: en stay preview, `appliedRules` (top) suele espejar `freeNights.appliedRules`.
 * No sumar ambas fuentes o FREE_NIGHTS con benefitValue=1 aparece como 2 noches gratis.
 */
export function flattenPreviewAppliedRules(preview) {
  if (!preview) return [];
  const fromFree = Array.isArray(preview.freeNights?.appliedRules)
    ? preview.freeNights.appliedRules
    : [];
  const freeIds = new Set(
    fromFree.map((r) => r?.promotionRuleId ?? r?.id ?? r?.code).filter((id) => id != null)
  );
  const fromTop = (Array.isArray(preview.appliedRules) ? preview.appliedRules : []).filter((r) => {
    const id = r?.promotionRuleId ?? r?.id ?? r?.code;
    // Ya contadas vía freeNights.appliedRules (espejo del motor stay).
    return id == null || !freeIds.has(id);
  });
  const topIds = new Set(
    fromTop.map((r) => r?.promotionRuleId ?? r?.id ?? r?.code).filter((id) => id != null)
  );
  // Solo usar appliedRules por noche si el top no trae esa regla (evita doble conteo %).
  const fromNights = Array.isArray(preview.nights)
    ? preview.nights.flatMap((n) => (Array.isArray(n.appliedRules) ? n.appliedRules : [])).filter(
        (r) => {
          const id = r?.promotionRuleId ?? r?.id ?? r?.code;
          if (id == null) return false;
          if (freeIds.has(id) || topIds.has(id)) return false;
          return true;
        }
      )
    : [];

  const merged = [...fromFree, ...fromTop, ...fromNights];
  const byId = new Map();
  for (const rule of merged) {
    if (!rule) continue;
    const id = rule.promotionRuleId ?? rule.id ?? rule.code;
    if (id == null) continue;
    const prev = byId.get(id);
    const monto = money(rule.montoARS ?? rule.discountARS ?? 0);
    const freeCount = Number(rule.freeNightCount || (rule.freeNight ? 1 : 0) || 0);
    if (!prev) {
      byId.set(id, {
        promotionRuleId: rule.promotionRuleId ?? rule.id ?? null,
        code: rule.code || null,
        label: rule.label || rule.code || `Promo #${id}`,
        montoARS: monto,
        porcentaje: rule.porcentaje ?? rule.percent ?? null,
        benefitType: rule.benefitType || null,
        freeNightCount: freeCount
      });
    } else if (freeCount > 0 && (prev.freeNightCount || 0) > 0) {
      // Misma FREE_NIGHTS repetida por fuentes espejo: no acumular.
      prev.montoARS = Math.max(prev.montoARS, monto);
      prev.freeNightCount = Math.max(prev.freeNightCount || 0, freeCount);
    } else {
      prev.montoARS = money(prev.montoARS + monto);
      if (freeCount > 0) {
        prev.freeNightCount = (prev.freeNightCount || 0) + freeCount;
      }
    }
  }
  return Array.from(byId.values()).filter((r) => r.montoARS > 0 || r.freeNightCount > 0);
}

/**
 * Une noches del segmento con el preview RATE (por índice).
 */
export function mergeNightsWithPreview(segmentNights, preview) {
  const previewNights = Array.isArray(preview?.nights) ? preview.nights : [];
  const freeByIndex = preview?.freeNights?.byIndex || {};
  return (segmentNights || []).map((night, index) => {
    const fromPreview = previewNights.find((n) => n.nightIndex === index) || previewNights[index];
    const free = freeByIndex[index] || freeByIndex[String(index)];
    const discount = money(fromPreview?.discountARS ?? free?.discountARS ?? 0);
    const finalARS = money(
      fromPreview?.finalARS ??
        free?.finalARS ??
        Math.max(0, night.originalARS - discount)
    );
    const ruleLabel =
      free?.label ||
      fromPreview?.label ||
      (fromPreview?.appliedRules?.[0]?.label) ||
      null;
    return {
      ...night,
      discountARS: discount,
      finalARS,
      freeNight: Boolean(free?.freeNight || fromPreview?.freeNight),
      promoLabel: ruleLabel
    };
  });
}

/**
 * Resume cotización: subtotal, descuentos, total, noches y promos.
 */
export function summarizeConfirmationQuote(segmentQuotes = []) {
  const nights = [];
  const promos = [];
  let subtotal = 0;
  let discount = 0;

  for (const seg of segmentQuotes) {
    subtotal = money(subtotal + money(seg.subtotal));
    discount = money(discount + money(seg.discountARS));
    for (const night of seg.nights || []) nights.push(night);
    for (const promo of seg.promos || []) promos.push(promo);
  }

  const promoById = new Map();
  for (const promo of promos) {
    const id = promo.promotionRuleId ?? promo.code;
    if (id == null) continue;
    const prev = promoById.get(id);
    if (!prev) {
      promoById.set(id, { ...promo });
    } else {
      prev.montoARS = money(prev.montoARS + money(promo.montoARS));
      prev.freeNightCount = (prev.freeNightCount || 0) + (promo.freeNightCount || 0);
    }
  }

  const finalTotal = money(Math.max(0, subtotal - discount));
  return {
    subtotalARS: subtotal,
    discountARS: discount,
    totalARS: finalTotal,
    nights,
    promos: Array.from(promoById.values()),
    hasPromos: promoById.size > 0 && discount > 0
  };
}

export function formatConfirmationMoney(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(money(amount));
}
