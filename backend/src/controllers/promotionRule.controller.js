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

const CONDITION_TYPES = new Set([
  'DATE_RANGE',
  'MIN_NIGHTS',
  'MAX_NIGHTS',
  'ROOM_TYPE',
  'SERVICE_TYPE',
  'PAYMENT_METHOD',
  'OCCUPANCY_HOTEL_MAX',
  'OCCUPANCY_HOTEL_MIN'
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
    const benefitBase = String(body.benefitBase || 'DEBT_CANCELLED').toUpperCase();
    const layer = String(body.layer || 'SETTLEMENT').toUpperCase();
    const modality = String(body.modality || 'AUTO').toUpperCase();
    const stacking = String(body.stacking || 'EXCLUSIVE').toUpperCase();
    const kind = String(body.kind || 'DESCUENTO').toUpperCase();

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
        benefitValue: new Decimal(Number(body.benefitValue) || 0),
        benefitBase,
        benefitCapARS:
          body.benefitCapARS != null && body.benefitCapARS !== ''
            ? new Decimal(Number(body.benefitCapARS))
            : null,
        notas: body.notas != null ? String(body.notas).trim() || null : null,
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
    if (body.layer != null) data.layer = String(body.layer).toUpperCase();
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
    if (body.benefitBase != null) data.benefitBase = String(body.benefitBase).toUpperCase();
    if (body.benefitValue != null) data.benefitValue = new Decimal(Number(body.benefitValue) || 0);
    if (body.benefitCapARS !== undefined) {
      data.benefitCapARS =
        body.benefitCapARS != null && body.benefitCapARS !== ''
          ? new Decimal(Number(body.benefitCapARS))
          : null;
    }
    if (body.notas !== undefined) {
      data.notas = body.notas != null ? String(body.notas).trim() || null : null;
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

    // Soft-delete: desactivar (conserva trazabilidad en DiscountApplication)
    const updated = await prisma.promotionRule.update({
      where: { id },
      data: { activo: false },
      include: { conditions: true }
    });
    await syncPaymentMethodMirrors(prisma, {
      paymentMethodConfigIds: touchedMethodIds(existing)
    });
    res.json(serializeRule(updated));
  } catch (error) {
    console.error('Error desactivando promoción:', error);
    res.status(500).json({ error: 'Error al desactivar promoción', details: error.message });
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
      occupancyPercent = await computeHotelOccupancyPercent(prisma, {
        hotelId: body.hotelId,
        date: body.checkIn || body.asOfDate || new Date()
      });
    }

    const ctx = {
      layer,
      asOfDate: body.asOfDate || new Date(),
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      nights: body.nights,
      roomTypeId: body.roomTypeId,
      serviceTypeId: body.serviceTypeId,
      paymentMethodConfigId: methodConfig?.id ?? body.paymentMethodConfigId,
      paymentMethodCode: methodConfig?.code,
      occupancyPercent,
      selectedRuleIds: body.selectedRuleIds || [],
      motivo: body.motivo || 'Pago',
      dineroARS: body.dineroARS,
      saldoPendiente: body.saldoPendiente,
      mode: body.mode || 'received',
      nightPrice: body.nightPrice
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
