/**
 * Mirror PaymentMethodConfig.descuento* desde reglas con condición PAYMENT_METHOD.
 * Fuente de verdad = PromotionRule; columnas legacy solo para UI/preview compat.
 */

const { Decimal } = require('@prisma/client/runtime/library');
const { toNumber } = require('./paymentDiscount');

function parseParams(params) {
  if (params == null) return {};
  if (typeof params === 'string') {
    try {
      return JSON.parse(params);
    } catch {
      return {};
    }
  }
  return typeof params === 'object' ? params : {};
}

function paymentMethodIdFromRule(rule) {
  const conditions = rule.conditions || [];
  for (const c of conditions) {
    if (c.type !== 'PAYMENT_METHOD') continue;
    const p = parseParams(c.params);
    if (p.paymentMethodConfigId != null) return Number(p.paymentMethodConfigId);
  }
  return null;
}

/**
 * Tras crear/editar/borrar reglas, resincroniza mirrors de medios tocados.
 */
async function syncPaymentMethodMirrors(db, { paymentMethodConfigIds } = {}) {
  const ids =
    paymentMethodConfigIds && paymentMethodConfigIds.length
      ? [...new Set(paymentMethodConfigIds.map(Number).filter(Number.isFinite))]
      : (
          await db.paymentMethodConfig.findMany({ select: { id: true } })
        ).map((r) => r.id);

  const rules = await db.promotionRule.findMany({
    where: {
      activo: true,
      layer: 'SETTLEMENT',
      modality: 'AUTO'
    },
    include: { conditions: true },
    orderBy: [{ prioridad: 'desc' }, { id: 'asc' }]
  });

  for (const methodId of ids) {
    const matching = rules.filter((r) => paymentMethodIdFromRule(r) === methodId);
    const primary = matching[0] || null;
    if (!primary) {
      await db.paymentMethodConfig.update({
        where: { id: methodId },
        data: {
          descuentoActivo: false,
          descuentoTipo: 'PERCENT',
          descuentoValor: new Decimal(0),
          aplicaEnParcial: true,
          aplicaEnSeña: true
        }
      });
      continue;
    }
    const tipo =
      primary.benefitType === 'FIXED' || primary.benefitType === 'FIXED_PER_NIGHT'
        ? 'FIXED'
        : 'PERCENT';
    await db.paymentMethodConfig.update({
      where: { id: methodId },
      data: {
        descuentoActivo: true,
        descuentoTipo: tipo,
        descuentoValor: new Decimal(toNumber(primary.benefitValue)),
        aplicaEnParcial: primary.aplicaEnParcial !== false,
        aplicaEnSeña: primary.aplicaEnSeña !== false
      }
    });
  }
}

async function enrichPaymentMethodsWithRules(db, rows) {
  const rules = await db.promotionRule.findMany({
    where: { layer: 'SETTLEMENT' },
    include: { conditions: true },
    orderBy: [{ prioridad: 'desc' }, { id: 'asc' }]
  });
  return rows.map((row) => {
    const linked = rules.filter((r) => paymentMethodIdFromRule(r) === row.id);
    return {
      ...row,
      linkedPromotionRules: linked.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.label,
        activo: r.activo,
        modality: r.modality,
        benefitType: r.benefitType,
        benefitValue: toNumber(r.benefitValue),
        prioridad: r.prioridad
      }))
    };
  });
}

module.exports = {
  paymentMethodIdFromRule,
  syncPaymentMethodMirrors,
  enrichPaymentMethodsWithRules,
  parseParams
};
