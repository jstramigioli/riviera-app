const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const {
  syncPaymentMethodMirrors,
  paymentMethodIdFromRule,
  parseParams
} = require('../utils/promotionRuleSync');
const {
  evaluateSettlementRules,
  evaluateRateRules,
  loadActivePromotionRules,
  computeHotelOccupancyPercent
} = require('../utils/promotionEngine');
const { resolvePaymentMethodConfig } = require('../utils/paymentMethodService');
const { resolveLayerAndBenefitBase } = require('../utils/promotionRuleLayer');

const CONDITION_TYPES = new Set([
  'DATE_RANGE', // fecha creación reserva
  'STAY_DATE', // fecha estadía: entre / incluye / no incluye — siempre rango from/to (mismo día = inicio=fin)
  'NIGHTS',
  'MIN_NIGHTS',
  'MAX_NIGHTS',
  'ROOM_TYPE',
  'SERVICE_TYPE',
  'PAYMENT_METHOD',
  'OCCUPANCY_HOTEL',
  'OCCUPANCY_HOTEL_MAX',
  'OCCUPANCY_HOTEL_MIN',
  'DAYS_OF_WEEK' // días semana L M X J V S D; incluye / no incluye (independiente de fechas)
]);

function serializeRule(row) {
  if (!row) return null;
  return {
    ...row,
    benefitValue: row.benefitValue != null ? Number(row.benefitValue) : 0,
    benefitCapARS: row.benefitCapARS != null ? Number(row.benefitCapARS) : null,
    conditions: (row.conditions || []).map((c) => ({
      ...c,
      params: parseParams(c.params)
    }))
  };
}

/** Valor manual off → benefitValue obligatorio y válido. */
function validateBenefitValue({ benefitValueManual, benefitValue, benefitType }) {
  if (benefitValueManual) return null;
  const raw = benefitValue;
  if (raw === '' || raw == null) {
    return benefitType === 'FREE_NIGHTS'
      ? 'Indicá cuántas noches gratis'
      : 'Indicá el valor del beneficio';
  }
  const benefit = Number(raw);
  if (Number.isNaN(benefit)) {
    return benefitType === 'FREE_NIGHTS'
      ? 'Indicá cuántas noches gratis'
      : 'Indicá el valor del beneficio';
  }
  if (benefitType === 'FREE_NIGHTS') {
    if (!Number.isInteger(benefit) || benefit < 1) {
      return 'Indicá cuántas noches gratis (entero ≥ 1)';
    }
  } else if (benefit < 0) {
    return 'El beneficio no puede ser negativo';
  } else if (benefitType === 'PERCENT' && benefit > 100) {
    return 'El porcentaje no puede ser mayor a 100';
  }
  return null;
}

function normalizeConditions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const type = String(c.type || '').toUpperCase();
      if (!CONDITION_TYPES.has(type)) return null;
      return {
        type,
        params: c.params && typeof c.params === 'object' ? c.params : {}
      };
    })
    .filter(Boolean);
}

function touchedMethodIds(rule) {
  const id = paymentMethodIdFromRule(rule);
  return id != null ? [id] : [];
}

exports.listPromotionRules = async (req, res) => {
  try {
    if (!prisma.promotionRule?.findMany) {
      return res.status(503).json({
        error: 'Error al listar promociones',
        details:
          'Cliente Prisma sin modelo PromotionRule. En backend ejecutá: npx prisma generate y reiniciá el API.'
      });
    }
    const includeInactive =
      String(req.query.all || '') === '1' || String(req.query.all || '') === 'true';
    const layer = req.query.layer ? String(req.query.layer).toUpperCase() : null;
    const rows = await prisma.promotionRule.findMany({
      where: {
        ...(includeInactive ? {} : { activo: true }),
        ...(layer ? { layer } : {})
      },
      include: { conditions: true },
      orderBy: [{ prioridad: 'desc' }, { id: 'asc' }]
    });
    res.json(rows.map(serializeRule));
  } catch (error) {
    console.error('Error listando promociones:', error);
    res.status(500).json({ error: 'Error al listar promociones', details: error.message });
  }
};

exports.getPromotionRule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await prisma.promotionRule.findUnique({
      where: { id },
      include: { conditions: true }
    });
    if (!row) return res.status(404).json({ error: 'Regla no encontrada' });
    res.json(serializeRule(row));
  } catch (error) {
    console.error('Error obteniendo promoción:', error);
    res.status(500).json({ error: 'Error al obtener promoción', details: error.message });
  }
};

exports.createPromotionRule = async (req, res) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    const label = String(body.label || '').trim();
    if (!code || !label) {
      return res.status(400).json({ error: 'code y label son requeridos' });
    }

    const conditions = normalizeConditions(body.conditions);
    const benefitType = String(body.benefitType || 'PERCENT').toUpperCase();
    const modality = String(body.modality || 'AUTO').toUpperCase();
    const stacking = String(body.stacking || 'EXCLUSIVE').toUpperCase();
    const kind = String(body.kind || 'DESCUENTO').toUpperCase();
    const { layer, benefitBase } = resolveLayerAndBenefitBase({
      kind,
      benefitType,
      layer: body.layer,
      benefitBase: body.benefitBase
    });
    const benefitValueManual = Boolean(body.benefitValueManual);
    const benefitValueError = validateBenefitValue({
      benefitValueManual,
      benefitValue: body.benefitValue,
      benefitType
    });
    if (benefitValueError) {
      return res.status(400).json({ error: benefitValueError });
    }

    const created = await prisma.promotionRule.create({
      data: {
        code,
        label,
        kind,
        activo: body.activo !== false,
        prioridad: Number.isFinite(Number(body.prioridad)) ? Number(body.prioridad) : 100,
        modality,
        layer,
        stacking,
        stackingGroup: body.stackingGroup ? String(body.stackingGroup).trim() : null,
        vigenteDesde: body.vigenteDesde ? new Date(body.vigenteDesde) : null,
        vigenteHasta: body.vigenteHasta ? new Date(body.vigenteHasta) : null,
        aplicaEnParcial: body.aplicaEnParcial !== false,
        aplicaEnSeña: body.aplicaEnSeña !== false,
        benefitType,
        benefitValue: new Decimal(benefitValueManual ? 0 : Number(body.benefitValue) || 0),
        benefitValueManual,
        benefitBase,
        benefitCapARS:
          body.benefitCapARS != null && body.benefitCapARS !== ''
            ? new Decimal(Number(body.benefitCapARS))
            : null,
        descripcionInterna:
          body.descripcionInterna != null
            ? String(body.descripcionInterna).trim() || null
            : body.notas != null
              ? String(body.notas).trim() || null
              : null,
        conditions: {
          create: conditions.map((c) => ({
            type: c.type,
            params: c.params
          }))
        }
      },
      include: { conditions: true }
    });

    await syncPaymentMethodMirrors(prisma, {
      paymentMethodConfigIds: touchedMethodIds(created)
    });

    res.status(201).json(serializeRule(created));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una regla con ese code' });
    }
    console.error('Error creando promoción:', error);
    res.status(500).json({ error: 'Error al crear promoción', details: error.message });
  }
};

exports.updatePromotionRule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.promotionRule.findUnique({
      where: { id },
      include: { conditions: true }
    });
    if (!existing) return res.status(404).json({ error: 'Regla no encontrada' });

    const body = req.body || {};
    const data = {};
    if (body.label != null) {
      const label = String(body.label).trim();
      if (!label) return res.status(400).json({ error: 'label no puede ser vacío' });
      data.label = label;
    }
    if (body.kind != null) data.kind = String(body.kind).toUpperCase();
    if (body.activo != null) data.activo = Boolean(body.activo);
    if (body.prioridad != null && Number.isFinite(Number(body.prioridad))) {
      data.prioridad = Number(body.prioridad);
    }
    if (body.modality != null) data.modality = String(body.modality).toUpperCase();
    if (body.stacking != null) data.stacking = String(body.stacking).toUpperCase();
    if (body.stackingGroup !== undefined) {
      data.stackingGroup = body.stackingGroup ? String(body.stackingGroup).trim() : null;
    }
    if (body.vigenteDesde !== undefined) {
      data.vigenteDesde = body.vigenteDesde ? new Date(body.vigenteDesde) : null;
    }
    if (body.vigenteHasta !== undefined) {
      data.vigenteHasta = body.vigenteHasta ? new Date(body.vigenteHasta) : null;
    }
    if (body.aplicaEnParcial != null) data.aplicaEnParcial = Boolean(body.aplicaEnParcial);
    if (body.aplicaEnSeña != null) data.aplicaEnSeña = Boolean(body.aplicaEnSeña);
    if (body.benefitType != null) data.benefitType = String(body.benefitType).toUpperCase();
    if (
      body.kind != null ||
      body.benefitType != null ||
      body.layer != null ||
      body.benefitBase != null
    ) {
      const resolved = resolveLayerAndBenefitBase({
        kind: data.kind != null ? data.kind : existing.kind,
        benefitType: data.benefitType != null ? data.benefitType : existing.benefitType,
        layer: body.layer != null ? body.layer : existing.layer,
        benefitBase: body.benefitBase != null ? body.benefitBase : existing.benefitBase
      });
      data.layer = resolved.layer;
      data.benefitBase = resolved.benefitBase;
    }
    if (body.benefitValueManual != null) {
      data.benefitValueManual = Boolean(body.benefitValueManual);
    }
    if (body.benefitValue != null || body.benefitValueManual != null) {
      const manual =
        body.benefitValueManual != null
          ? Boolean(body.benefitValueManual)
          : Boolean(existing.benefitValueManual);
      const benefitType =
        body.benefitType != null
          ? String(body.benefitType).toUpperCase()
          : String(existing.benefitType || 'PERCENT').toUpperCase();
      const resolvedValue =
        body.benefitValue != null ? body.benefitValue : existing.benefitValue;
      const benefitValueError = validateBenefitValue({
        benefitValueManual: manual,
        benefitValue: resolvedValue,
        benefitType
      });
      if (benefitValueError) {
        return res.status(400).json({ error: benefitValueError });
      }
      data.benefitValue = new Decimal(manual ? 0 : Number(resolvedValue) || 0);
    }
    if (body.benefitCapARS !== undefined) {
      data.benefitCapARS =
        body.benefitCapARS != null && body.benefitCapARS !== ''
          ? new Decimal(Number(body.benefitCapARS))
          : null;
    }
    if (body.descripcionInterna !== undefined) {
      data.descripcionInterna =
        body.descripcionInterna != null
          ? String(body.descripcionInterna).trim() || null
          : null;
    } else if (body.notas !== undefined) {
      // Compat temporal: clients antiguos enviaban `notas`.
      data.descripcionInterna =
        body.notas != null ? String(body.notas).trim() || null : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.conditions)) {
        await tx.promotionCondition.deleteMany({ where: { ruleId: id } });
        const conditions = normalizeConditions(body.conditions);
        if (conditions.length) {
          await tx.promotionCondition.createMany({
            data: conditions.map((c) => ({
              ruleId: id,
              type: c.type,
              params: c.params
            }))
          });
        }
      }
      return tx.promotionRule.update({
        where: { id },
        data,
        include: { conditions: true }
      });
    });

    const methodIds = [
      ...touchedMethodIds(existing),
      ...touchedMethodIds(updated)
    ];
    await syncPaymentMethodMirrors(prisma, { paymentMethodConfigIds: methodIds });

    res.json(serializeRule(updated));
  } catch (error) {
    console.error('Error actualizando promoción:', error);
    res.status(500).json({ error: 'Error al actualizar promoción', details: error.message });
  }
};

exports.deletePromotionRule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.promotionRule.findUnique({
      where: { id },
      include: { conditions: true }
    });
    if (!existing) return res.status(404).json({ error: 'Regla no encontrada' });

    const methodIds = touchedMethodIds(existing);
    // Hard delete: condiciones en cascade; DiscountApplication.promotionRuleId → SetNull (historial intacto)
    await prisma.promotionRule.delete({ where: { id } });
    await syncPaymentMethodMirrors(prisma, { paymentMethodConfigIds: methodIds });
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Error eliminando promoción:', error);
    res.status(500).json({ error: 'Error al eliminar promoción', details: error.message });
  }
};

/**
 * Preview de aplicación (settlement o rate) sin persistir.
 */
exports.previewPromotion = async (req, res) => {
  try {
    const body = req.body || {};
    const layer = String(body.layer || 'SETTLEMENT').toUpperCase();
    const rules = await loadActivePromotionRules(prisma, { layer });
    const methodConfig = await resolvePaymentMethodConfig(prisma, {
      paymentMethodConfigId: body.paymentMethodConfigId,
      metodo: body.metodo
    });

    let occupancyPercent = body.occupancyPercent;
    if (occupancyPercent == null && (body.hotelId || body.checkIn)) {
      try {
        occupancyPercent = await computeHotelOccupancyPercent(prisma, {
          hotelId: body.hotelId,
          date: body.checkIn || body.asOfDate || new Date()
        });
      } catch (occErr) {
        // Occupancy is optional for most RATE rules (e.g. FREE_NIGHTS 4x3).
        // Never fail the whole preview if occupancy lookup breaks.
        console.warn('Preview: ocupación hotel no disponible', occErr?.message || occErr);
        occupancyPercent = null;
      }
    }

    const ctx = {
      layer,
      asOfDate: body.asOfDate || new Date(),
      reservationDate: body.reservationDate || body.createdAt || body.bookingCreatedAt,
      createdAt: body.createdAt || body.reservationDate || body.bookingCreatedAt,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      nights: body.nights,
      roomTypeId: body.roomTypeId,
      serviceTypeId: body.serviceTypeId,
      paymentMethodConfigId: methodConfig?.id ?? body.paymentMethodConfigId,
      paymentMethodCode: methodConfig?.code,
      occupancyPercent,
      selectedRuleIds: body.selectedRuleIds || [],
      deselectedRuleIds: Array.isArray(body.deselectedRuleIds) ? body.deselectedRuleIds : [],
      // RATE cotización: SUGERIDA aplica por defecto (p.ej. Promo 4x3). SETTLEMENT: solo si se pide.
      applySuggestedDefaults:
        body.applySuggestedDefaults != null
          ? Boolean(body.applySuggestedDefaults)
          : layer === 'RATE',
      applyAutomatics:
        body.applyAutomatics != null ? Boolean(body.applyAutomatics) : true,
      benefitValueByRuleId:
        body.benefitValueByRuleId && typeof body.benefitValueByRuleId === 'object'
          ? body.benefitValueByRuleId
          : {},
      motivo: body.motivo || 'Pago',
      dineroARS: body.dineroARS,
      saldoPendiente: body.saldoPendiente,
      mode: body.mode || 'received',
      nightPrice: body.nightPrice,
      nightPrices: Array.isArray(body.nightPrices) ? body.nightPrices : undefined
    };

    if (layer === 'RATE') {
      return res.json(evaluateRateRules(rules, ctx));
    }
    return res.json(evaluateSettlementRules(rules, ctx));
  } catch (error) {
    console.error('Error preview promoción:', error);
    res.status(500).json({ error: 'Error en preview de promoción', details: error.message });
  }
};
