/**
 * Cotización por tramos confirmados (SeasonBlock).
 * - Solo bloques isDraft=false
 * - Noche sin tramo = cerrado
 * - Servicios habilitados por tramo (BlockServiceSelection o precios existentes)
 * - Propone segmentos cuando el servicio pedido no cubre toda la estadía
 */

function parseDateOnly(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const str = String(value).slice(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function datesOverlapBlock(night, blockStart, blockEnd) {
  const n = parseDateOnly(night);
  const start = parseDateOnly(blockStart);
  const end = parseDateOnly(blockEnd);
  return n >= start && n <= end;
}

/**
 * Servicios habilitados de un bloque (ordenados).
 */
function getEnabledServicesForBlock(block) {
  if (block.useBlockServices && block.blockServiceSelections?.length > 0) {
    return block.blockServiceSelections
      .filter((s) => s.isEnabled && s.serviceType)
      .map((s) => ({
        id: s.serviceType.id,
        name: s.serviceType.name,
        orderIndex: s.orderIndex ?? s.serviceType.orderIndex ?? 0
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const byId = new Map();
  for (const price of block.seasonPrices || []) {
    const st = price.serviceType;
    if (!st) continue;
    if (!byId.has(st.id)) {
      byId.set(st.id, {
        id: st.id,
        name: st.name,
        orderIndex: st.orderIndex ?? 0
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.orderIndex - b.orderIndex);
}

function findPrice(block, roomTypeId, serviceTypeId) {
  return (block.seasonPrices || []).find(
    (p) =>
      p.roomTypeId === parseInt(roomTypeId, 10) &&
      p.serviceTypeId === serviceTypeId &&
      !p.isDraft
  );
}

/**
 * Agrupa noches consecutivas con la misma clave en segmentos propuestos.
 */
function groupIntoProposedSegments(nightAnalyses) {
  if (!nightAnalyses.length) return [];

  const segments = [];
  let current = null;

  for (const night of nightAnalyses) {
    const key = `${night.status}|${night.serviceTypeId || ''}|${night.seasonBlockId || ''}|${night.listRate ?? ''}`;
    const contiguousKey = `${night.status}|${night.serviceTypeId || ''}`;

    if (!current) {
      current = {
        checkIn: night.date,
        checkOut: formatDateOnly(addDays(parseDateOnly(night.date), 1)),
        status: night.status,
        serviceTypeId: night.serviceTypeId,
        serviceTypeName: night.serviceTypeName,
        seasonBlockId: night.seasonBlockId,
        blockName: night.blockName,
        listRate: night.listRate,
        nights: [night],
        _contiguousKey: contiguousKey
      };
      continue;
    }

    // Unir noches consecutivas con mismo status+servicio (aunque cambie el tramo de precio)
    if (current._contiguousKey === contiguousKey) {
      current.checkOut = formatDateOnly(addDays(parseDateOnly(night.date), 1));
      current.nights.push(night);
      // Si el precio cambia entre tramos, marcar como variable
      if (current.listRate !== night.listRate) {
        current.variableRate = true;
      }
      if (night.seasonBlockId && night.seasonBlockId !== current.seasonBlockId) {
        current.crossesBlocks = true;
      }
    } else {
      delete current._contiguousKey;
      segments.push(current);
      current = {
        checkIn: night.date,
        checkOut: formatDateOnly(addDays(parseDateOnly(night.date), 1)),
        status: night.status,
        serviceTypeId: night.serviceTypeId,
        serviceTypeName: night.serviceTypeName,
        seasonBlockId: night.seasonBlockId,
        blockName: night.blockName,
        listRate: night.listRate,
        nights: [night],
        _contiguousKey: contiguousKey
      };
    }
  }

  if (current) {
    delete current._contiguousKey;
    segments.push(current);
  }

  return segments.map((seg) => {
    const totalList = (seg.nights || []).reduce((sum, n) => sum + (n.listRate || 0), 0);
    const nightCount = seg.nights?.length || 0;
    return {
      checkIn: seg.checkIn,
      checkOut: seg.checkOut,
      status: seg.status,
      serviceTypeId: seg.serviceTypeId,
      serviceTypeName: seg.serviceTypeName,
      seasonBlockId: seg.seasonBlockId,
      blockName: seg.blockName,
      listRate: nightCount ? totalList / nightCount : seg.listRate,
      totalAmount: totalList,
      numberOfNights: nightCount,
      variableRate: !!seg.variableRate,
      crossesBlocks: !!seg.crossesBlocks,
      nightRates: (seg.nights || []).map((n) => ({
        date: n.date,
        listRate: n.listRate,
        seasonBlockId: n.seasonBlockId,
        blockName: n.blockName,
        serviceTypeId: n.serviceTypeId
      }))
    };
  });
}

/**
 * Cotiza un rango de fechas para un tipo de habitación y servicio solicitado.
 *
 * @returns {Promise<object>} resultado con availability y detalle
 */
async function quoteStay({
  prisma,
  hotelId,
  roomTypeId,
  startDate,
  endDate,
  serviceTypeId
}) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: 'invalid_dates', message: 'Fechas inválidas' };
  }
  if (start >= end) {
    return {
      success: false,
      error: 'invalid_range',
      message: 'La fecha de inicio debe ser anterior a la fecha de fin'
    };
  }

  const seasonBlocks = await prisma.seasonBlock.findMany({
    where: {
      hotelId,
      isDraft: false,
      startDate: { lte: end },
      endDate: { gte: start }
    },
    include: {
      seasonPrices: {
        include: { serviceType: true }
      },
      blockServiceSelections: {
        include: { serviceType: true }
      }
    },
    orderBy: { startDate: 'asc' }
  });

  const nightAnalyses = [];
  const closedDates = [];
  const missingPriceDates = [];

  for (let d = new Date(start); d < end; d = addDays(d, 1)) {
    const dateStr = formatDateOnly(d);
    const coveringBlock = seasonBlocks.find((block) =>
      datesOverlapBlock(d, block.startDate, block.endDate)
    );

    if (!coveringBlock) {
      closedDates.push(dateStr);
      nightAnalyses.push({
        date: dateStr,
        status: 'closed',
        serviceTypeId: null,
        serviceTypeName: null,
        seasonBlockId: null,
        blockName: null,
        listRate: null,
        enabledServices: []
      });
      continue;
    }

    const enabledServices = getEnabledServicesForBlock(coveringBlock);
    const requestedEnabled = enabledServices.some((s) => s.id === serviceTypeId);
    const requestedPrice = requestedEnabled
      ? findPrice(coveringBlock, roomTypeId, serviceTypeId)
      : null;

    if (requestedEnabled && requestedPrice) {
      const serviceMeta = enabledServices.find((s) => s.id === serviceTypeId);
      nightAnalyses.push({
        date: dateStr,
        status: 'ok',
        serviceTypeId,
        serviceTypeName: serviceMeta?.name || null,
        seasonBlockId: coveringBlock.id,
        blockName: coveringBlock.name,
        listRate: requestedPrice.basePrice,
        enabledServices
      });
      continue;
    }

    // Servicio no disponible esa noche: sugerir el primero habilitado con precio
    let alternative = null;
    for (const svc of enabledServices) {
      const price = findPrice(coveringBlock, roomTypeId, svc.id);
      if (price) {
        alternative = {
          serviceTypeId: svc.id,
          serviceTypeName: svc.name,
          listRate: price.basePrice
        };
        break;
      }
    }

    if (!alternative && enabledServices.length === 0) {
      missingPriceDates.push(dateStr);
    }

    nightAnalyses.push({
      date: dateStr,
      status: alternative ? 'service_unavailable' : 'no_price',
      serviceTypeId: alternative?.serviceTypeId || null,
      serviceTypeName: alternative?.serviceTypeName || null,
      seasonBlockId: coveringBlock.id,
      blockName: coveringBlock.name,
      listRate: alternative?.listRate ?? null,
      requestedServiceAvailable: false,
      enabledServices,
      suggestedServiceTypeId: alternative?.serviceTypeId || null
    });
  }

  const okNights = nightAnalyses.filter((n) => n.status === 'ok');
  const gapNights = nightAnalyses.filter(
    (n) => n.status === 'service_unavailable' || n.status === 'no_price'
  );
  const proposedSegments = groupIntoProposedSegments(nightAnalyses);

  const availableBlocks = seasonBlocks.map((block) => ({
    id: block.id,
    name: block.name,
    startDate: formatDateOnly(parseDateOnly(block.startDate)),
    endDate: formatDateOnly(parseDateOnly(block.endDate)),
    enabledServices: getEnabledServicesForBlock(block).map((s) => ({
      id: s.id,
      name: s.name
    }))
  }));

  // Cerrado: alguna noche sin tramo
  if (closedDates.length > 0) {
    return {
      success: true,
      availability: 'closed',
      message:
        'El período solicitado incluye noches sin tramo de tarifa confirmado (hotel cerrado o sin precio publicado).',
      closedDates,
      missingPriceDates,
      nightAnalyses,
      proposedSegments,
      availableBlocks,
      availablePeriods: proposedSegments
        .filter((s) => s.status === 'ok')
        .map((s) => ({
          startDate: s.checkIn,
          endDate: s.checkOut,
          blockName: s.blockName,
          serviceTypeId: s.serviceTypeId
        }))
    };
  }

  // Ninguna noche con el servicio pedido
  if (okNights.length === 0) {
    const anyOpen = nightAnalyses.some(
      (n) => n.status === 'service_unavailable' || n.status === 'no_price'
    );
    return {
      success: true,
      availability: anyOpen ? 'service_not_available' : 'no_availability',
      message: anyOpen
        ? 'El servicio solicitado no está disponible en ninguna noche del período.'
        : 'No hay tarifas disponibles para el período solicitado.',
      nightAnalyses,
      proposedSegments,
      availableBlocks,
      suggestedSegments: proposedSegments.filter((s) => s.serviceTypeId),
      suggestedAction:
        'Elegí otro servicio o dividí la reserva en tramos con los servicios habilitados.'
    };
  }

  // Parcial: algunas noches OK, otras no
  if (gapNights.length > 0) {
    const serviceName = okNights[0]?.serviceTypeName || 'solicitado';
    return {
      success: true,
      availability: 'partial_availability',
      message: `El servicio "${serviceName}" no está disponible en todas las noches del período.`,
      isPartiallyAvailable: true,
      serviceName,
      nightAnalyses,
      proposedSegments,
      availablePeriods: proposedSegments
        .filter((s) => s.status === 'ok')
        .map((s) => ({
          startDate: s.checkIn,
          endDate: s.checkOut,
          blockName: s.blockName,
          serviceTypeId: s.serviceTypeId,
          serviceTypeName: s.serviceTypeName
        })),
      suggestedSegments: proposedSegments.map((s) => ({
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        serviceTypeId: s.serviceTypeId,
        serviceTypeName: s.serviceTypeName,
        status: s.status,
        listRate: s.listRate,
        totalAmount: s.totalAmount,
        numberOfNights: s.numberOfNights,
        nightRates: s.nightRates
      })),
      availableBlocks,
      suggestedAction:
        'Podés dividir la reserva en tramos: en los gaps se sugiere el servicio habilitado del bloque.'
    };
  }

  // Éxito: todas las noches con el servicio pedido
  const rates = okNights.map((n) => ({
    date: n.date,
    baseRate: n.listRate,
    dynamicRate: n.listRate,
    listRate: n.listRate,
    serviceRate: n.listRate,
    hotelId,
    roomTypeId: parseInt(roomTypeId, 10),
    serviceTypeId: n.serviceTypeId,
    seasonBlockId: n.seasonBlockId,
    blockName: n.blockName
  }));

  const totalAmount = rates.reduce((sum, r) => sum + r.serviceRate, 0);
  const numberOfNights = rates.length;

  // Servicios comunes (intersección) para UI
  const serviceSets = seasonBlocks.map(
    (b) => new Set(getEnabledServicesForBlock(b).map((s) => s.id))
  );
  let commonServiceIds = serviceSets.length
    ? [...serviceSets[0]].filter((id) => serviceSets.every((set) => set.has(id)))
    : [];
  const serviceNameById = new Map();
  for (const block of seasonBlocks) {
    for (const s of getEnabledServicesForBlock(block)) {
      serviceNameById.set(s.id, s.name);
    }
  }

  return {
    success: true,
    availability: 'success',
    rates,
    totalAmount,
    serviceType: serviceTypeId,
    numberOfNights,
    averageRatePerNight: numberOfNights > 0 ? totalAmount / numberOfNights : 0,
    availableServices: commonServiceIds.map((id) => ({
      id,
      name: serviceNameById.get(id) || id
    })),
    proposedSegments: proposedSegments.filter((s) => s.status === 'ok'),
    availableBlocks,
    nightAnalyses
  };
}

module.exports = {
  quoteStay,
  parseDateOnly,
  formatDateOnly,
  addDays,
  getEnabledServicesForBlock,
  groupIntoProposedSegments
};
