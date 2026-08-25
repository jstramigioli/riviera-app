const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  parseDateOnly,
  formatDateOnly,
  addDays
} = require('../services/tariffQuoteService');

/**
 * Obtiene los datos calculados de una reserva desde sus segmentos
 */
function getReservationData(reservation) {
  if (!reservation.segments || reservation.segments.length === 0) {
    return null;
  }

  const activeSegments = reservation.segments.filter((s) => s.isActive);

  if (activeSegments.length === 0) {
    return null;
  }

  const checkIn = new Date(Math.min(...activeSegments.map((s) => new Date(s.startDate))));
  const checkOut = new Date(Math.max(...activeSegments.map((s) => new Date(s.endDate))));

  const lodgingTotal = activeSegments.reduce((sum, segment) => {
    if (Array.isArray(segment.nightRates) && segment.nightRates.length > 0) {
      return sum + segment.nightRates.reduce((s, n) => s + (Number(n.finalRate) || 0), 0);
    }
    const days = Math.ceil(
      (new Date(segment.endDate) - new Date(segment.startDate)) / (1000 * 60 * 60 * 24)
    );
    return sum + days * segment.baseRate;
  }, 0);

  let discountAmount = 0;
  if (reservation.discountType === 'PERCENT' && reservation.discountValue) {
    discountAmount = lodgingTotal * (Number(reservation.discountValue) / 100);
  } else if (reservation.discountType === 'FIXED' && reservation.discountValue) {
    discountAmount = Number(reservation.discountValue);
  }

  const totalAmount = Math.max(0, lodgingTotal - discountAmount);
  const firstSegment = activeSegments[0];

  const roomData = firstSegment.room
    ? {
        ...firstSegment.room,
        roomType: firstSegment.roomType || firstSegment.room.roomType
      }
    : null;

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  return {
    id: reservation.id,
    mainClientId: reservation.mainClientId,
    checkIn,
    checkOut,
    totalAmount,
    lodgingTotal,
    discountType: reservation.discountType || null,
    discountValue: reservation.discountValue ?? null,
    discountReason: reservation.discountReason || null,
    discountAmount,
    status: reservation.status,
    notes: reservation.notes,
    isMultiRoom: reservation.isMultiRoom,
    parentReservationId: reservation.parentReservationId,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    roomId: firstSegment.roomId,
    reservationType: firstSegment.services[0],
    requiredGuests: firstSegment.guestCount,
    days: nights,
    averageRate: nights > 0 ? lodgingTotal / nights : 0,
    mainClient: reservation.mainClient,
    guests: reservation.guests,
    segments: activeSegments,
    childReservations: reservation.childReservations,
    nightRates: reservation.nightRates || undefined,
    room: roomData
  };
}

async function getReservationWithData(reservationId) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: parseInt(reservationId, 10) },
    include: {
      mainClient: true,
      guests: true,
      nightRates: { orderBy: { date: 'asc' } },
      segments: {
        where: { isActive: true },
        include: {
          room: true,
          roomType: true
        },
        orderBy: { startDate: 'asc' }
      },
      childReservations: {
        include: {
          segments: {
            where: { isActive: true },
            include: {
              room: true,
              roomType: true
            },
            orderBy: { startDate: 'asc' }
          }
        }
      }
    }
  });

  if (!reservation) {
    return null;
  }

  return getReservationData(reservation);
}

async function getAllReservationsWithData() {
  const reservations = await prisma.reservation.findMany({
    include: {
      mainClient: true,
      guests: true,
      segments: {
        where: { isActive: true },
        include: {
          room: true,
          roomType: true
        },
        orderBy: { startDate: 'asc' }
      },
      childReservations: {
        include: {
          segments: {
            where: { isActive: true },
            include: {
              room: true,
              roomType: true
            },
            orderBy: { startDate: 'asc' }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return reservations.map((reservation) => getReservationData(reservation)).filter(Boolean);
}

/**
 * Expande un segmento a noches con listRate/finalRate.
 * Preferir nightRates del payload; si no, aplicar baseRate plano.
 */
function expandSegmentNightRates(segmentData) {
  const start = parseDateOnly(segmentData.startDate || segmentData.checkIn);
  const end = parseDateOnly(segmentData.endDate || segmentData.checkOut);
  const serviceTypeId =
    Array.isArray(segmentData.services) && segmentData.services[0]
      ? segmentData.services[0]
      : segmentData.serviceTypeId || null;

  const provided = Array.isArray(segmentData.nightRates) ? segmentData.nightRates : null;
  const nights = [];

  for (let d = new Date(start); d < end; d = addDays(d, 1)) {
    const dateStr = formatDateOnly(d);
    const fromPayload = provided?.find((n) => String(n.date).slice(0, 10) === dateStr);

    const listRate = fromPayload
      ? Number(fromPayload.listRate ?? fromPayload.finalRate ?? segmentData.listRate ?? segmentData.baseRate)
      : Number(segmentData.listRate ?? segmentData.baseRate);

    const finalRate = fromPayload
      ? Number(fromPayload.finalRate ?? fromPayload.listRate ?? segmentData.baseRate)
      : Number(segmentData.baseRate);

    nights.push({
      date: dateStr,
      listRate,
      finalRate,
      seasonBlockId: fromPayload?.seasonBlockId || null,
      serviceTypeId: fromPayload?.serviceTypeId || serviceTypeId,
      manualOverride: !!(segmentData.isManualRate || fromPayload?.manualOverride)
    });
  }

  return nights;
}

async function resolveServiceTypeLabel(serviceTypeId) {
  if (!serviceTypeId) return 'Servicio';
  try {
    const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
    if (serviceType) return serviceType.name;
  } catch {
    // ignore
  }
  return serviceTypeId;
}

/**
 * Crea cargos de alojamiento + nightRates snapshot + descuento opcional.
 */
async function createLodgingChargesAndSnapshot({
  reservationId,
  segments,
  discount
}) {
  let lodgingTotal = 0;

  for (const segment of segments) {
    const roomTypeId = segment.roomTypeId || segment.room?.roomTypeId || null;
    const nights = expandSegmentNightRates({
      startDate: segment.startDate,
      endDate: segment.endDate,
      baseRate: segment.baseRate,
      listRate: segment.listRate,
      isManualRate: segment.isManualRate,
      services: segment.services,
      nightRates: segment.nightRates
    });

    for (let i = 0; i < nights.length; i++) {
      const night = nights[i];
      const nightDate = parseDateOnly(night.date);
      const serviceTypeId = night.serviceTypeId || (segment.services && segment.services[0]) || null;
      const serviceTypeLabel = await resolveServiceTypeLabel(serviceTypeId);
      const dateStr = nightDate.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      lodgingTotal += night.finalRate;

      await prisma.cargo.create({
        data: {
          reservaId: reservationId,
          roomTypeId: roomTypeId ? parseInt(roomTypeId, 10) : null,
          serviceTypeId: serviceTypeId || null,
          descripcion: `Alojamiento - ${dateStr} (${serviceTypeLabel})`,
          monto: night.finalRate,
          notas: night.manualOverride
            ? `Noche ${i + 1}/${nights.length} - Precio manual - Hab. ${segment.room?.name || 'N/A'}`
            : `Noche ${i + 1}/${nights.length} - Hab. ${segment.room?.name || 'N/A'}`,
          fecha: nightDate
        }
      });

      await prisma.reservationNightRate.upsert({
        where: {
          reservationId_date: {
            reservationId,
            date: nightDate
          }
        },
        update: {
          baseRate: night.listRate,
          dynamicRate: night.finalRate,
          finalRate: night.finalRate,
          listRate: night.listRate,
          serviceType: serviceTypeId || 'unknown',
          serviceRate: night.finalRate,
          seasonBlockId: night.seasonBlockId,
          manualOverride: night.manualOverride
        },
        create: {
          reservationId,
          date: nightDate,
          baseRate: night.listRate,
          dynamicRate: night.finalRate,
          finalRate: night.finalRate,
          listRate: night.listRate,
          serviceType: serviceTypeId || 'unknown',
          serviceRate: night.finalRate,
          seasonBlockId: night.seasonBlockId,
          manualOverride: night.manualOverride
        }
      });
    }
  }

  let discountAmount = 0;
  if (discount?.type === 'PERCENT' && discount.value) {
    discountAmount = lodgingTotal * (Number(discount.value) / 100);
  } else if (discount?.type === 'FIXED' && discount.value) {
    discountAmount = Number(discount.value);
  }

  if (discountAmount > 0) {
    const reason = discount.reason || 'Descuento aplicado';
    const label =
      discount.type === 'PERCENT'
        ? `Descuento ${discount.value}% (${reason})`
        : `Descuento (${reason})`;

    await prisma.cargo.create({
      data: {
        reservaId: reservationId,
        descripcion: label,
        monto: -Math.abs(discountAmount),
        notas: `Tipo: ${discount.type}, valor: ${discount.value}`,
        fecha: new Date()
      }
    });
  }

  return { lodgingTotal, discountAmount };
}

/**
 * Crea una nueva reserva con sus segmentos, snapshot y cargos.
 */
async function createReservationWithSegments(reservationData) {
  const {
    mainClientId,
    segments,
    status = 'PENDIENTE',
    notes,
    isMultiRoom = false,
    parentReservationId = null,
    discountType = null,
    discountValue = null,
    discountReason = null,
    discount = null
  } = reservationData;

  const resolvedDiscount = discount || {
    type: discountType,
    value: discountValue,
    reason: discountReason
  };

  const reservation = await prisma.reservation.create({
    data: {
      mainClientId: parseInt(mainClientId, 10),
      status,
      notes,
      isMultiRoom: segments.length > 1 || isMultiRoom,
      parentReservationId: parentReservationId ? parseInt(parentReservationId, 10) : null,
      discountType: resolvedDiscount?.type || null,
      discountValue:
        resolvedDiscount?.value !== undefined && resolvedDiscount?.value !== null
          ? parseFloat(resolvedDiscount.value)
          : null,
      discountReason: resolvedDiscount?.reason || null
    }
  });

  const createdSegments = [];
  for (const segmentData of segments) {
    if (!segmentData.services || !Array.isArray(segmentData.services) || segmentData.services.length === 0) {
      throw new Error('Cada segmento debe tener al menos un servicio especificado');
    }

    const expandedNights = expandSegmentNightRates(segmentData);
    const listRateAvg =
      expandedNights.length > 0
        ? expandedNights.reduce((s, n) => s + n.listRate, 0) / expandedNights.length
        : parseFloat(segmentData.listRate ?? segmentData.baseRate);

    const segment = await prisma.reservationSegment.create({
      data: {
        reservationId: reservation.id,
        startDate: new Date(segmentData.startDate),
        endDate: new Date(segmentData.endDate),
        roomId: parseInt(segmentData.roomId, 10),
        roomTypeId: segmentData.roomTypeId ? parseInt(segmentData.roomTypeId, 10) : null,
        services: segmentData.services,
        baseRate: parseFloat(segmentData.baseRate),
        listRate: listRateAvg,
        isManualRate: !!segmentData.isManualRate,
        pricingNotes: segmentData.pricingNotes || null,
        nightRates: expandedNights,
        guestCount: parseInt(segmentData.guestCount, 10),
        requiredTags: segmentData.requiredTags || [],
        requiredRoomId: segmentData.requiredRoomId
          ? parseInt(segmentData.requiredRoomId, 10)
          : null,
        reason: segmentData.reason || 'Segmento de reserva',
        notes: segmentData.notes || 'Segmento creado automáticamente',
        isActive: true
      },
      include: {
        room: true,
        roomType: true
      }
    });
    createdSegments.push(segment);
  }

  try {
    await createLodgingChargesAndSnapshot({
      reservationId: reservation.id,
      segments: createdSegments.map((seg, idx) => ({
        ...seg,
        nightRates: expandSegmentNightRates(segments[idx]),
        isManualRate: !!segments[idx].isManualRate
      })),
      discount: resolvedDiscount?.type ? resolvedDiscount : null
    });
  } catch (cargoError) {
    console.error('❌ Error creando cargos/snapshot de reserva:', cargoError);
  }

  return getReservationWithData(reservation.id);
}

async function createReservationWithSegment(reservationData) {
  const {
    mainClientId,
    roomId,
    checkIn,
    checkOut,
    totalAmount,
    status = 'PENDIENTE',
    reservationType = 'con_desayuno',
    notes,
    requiredGuests = 1,
    isMultiRoom = false,
    parentReservationId = null,
    discountType,
    discountValue,
    discountReason
  } = reservationData;

  const days = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
  const baseRate = totalAmount / days;

  return createReservationWithSegments({
    mainClientId,
    status,
    notes,
    isMultiRoom,
    parentReservationId,
    discountType,
    discountValue,
    discountReason,
    segments: [
      {
        roomId,
        startDate: checkIn,
        endDate: checkOut,
        services: [reservationType],
        baseRate,
        listRate: baseRate,
        guestCount: requiredGuests
      }
    ]
  });
}

async function updateReservationWithSegments(reservationId, updateData) {
  const { status, notes, segments, discountType, discountValue, discountReason } = updateData;

  await prisma.reservation.update({
    where: { id: parseInt(reservationId, 10) },
    data: {
      status: status || undefined,
      notes: notes !== undefined ? notes : undefined,
      discountType: discountType !== undefined ? discountType : undefined,
      discountValue: discountValue !== undefined ? discountValue : undefined,
      discountReason: discountReason !== undefined ? discountReason : undefined
    }
  });

  if (segments && Array.isArray(segments)) {
    await prisma.reservationSegment.updateMany({
      where: {
        reservationId: parseInt(reservationId, 10),
        isActive: true
      },
      data: { isActive: false }
    });

    for (const segmentData of segments) {
      const expandedNights = expandSegmentNightRates(segmentData);
      await prisma.reservationSegment.create({
        data: {
          reservationId: parseInt(reservationId, 10),
          startDate: new Date(segmentData.startDate),
          endDate: new Date(segmentData.endDate),
          roomId: parseInt(segmentData.roomId, 10),
          roomTypeId: segmentData.roomTypeId ? parseInt(segmentData.roomTypeId, 10) : null,
          services: segmentData.services || ['con_desayuno'],
          baseRate: parseFloat(segmentData.baseRate),
          listRate: segmentData.listRate != null ? parseFloat(segmentData.listRate) : null,
          isManualRate: !!segmentData.isManualRate,
          pricingNotes: segmentData.pricingNotes || null,
          nightRates: expandedNights,
          guestCount: parseInt(segmentData.guestCount, 10),
          reason: segmentData.reason,
          notes: segmentData.notes
        }
      });
    }
  }

  return getReservationWithData(reservationId);
}

async function checkRoomAvailability(roomId, checkIn, checkOut, excludeReservationId = null) {
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: parseInt(roomId, 10),
      isActive: true,
      reservation: {
        status: { in: ['PENDIENTE', 'CONFIRMADA', 'INGRESADA'] },
        id: excludeReservationId ? { not: parseInt(excludeReservationId, 10) } : undefined
      },
      OR: [
        {
          AND: [
            { startDate: { lte: new Date(checkIn) } },
            { endDate: { gt: new Date(checkIn) } }
          ]
        },
        {
          AND: [
            { startDate: { lt: new Date(checkOut) } },
            { endDate: { gte: new Date(checkOut) } }
          ]
        },
        {
          AND: [
            { startDate: { gte: new Date(checkIn) } },
            { endDate: { lte: new Date(checkOut) } }
          ]
        }
      ]
    },
    include: {
      reservation: {
        include: {
          mainClient: true
        }
      }
    }
  });

  return {
    available: conflictingSegments.length === 0,
    conflicts: conflictingSegments
  };
}

module.exports = {
  getReservationData,
  getReservationWithData,
  getAllReservationsWithData,
  createReservationWithSegment,
  createReservationWithSegments,
  updateReservationWithSegments,
  checkRoomAvailability,
  expandSegmentNightRates,
  createLodgingChargesAndSnapshot
};
