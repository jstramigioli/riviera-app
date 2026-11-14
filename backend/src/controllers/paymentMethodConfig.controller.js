const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { enrichPaymentMethodsWithRules } = require('../utils/promotionRuleSync');

function serializeConfig(row) {
  if (!row) return null;
  return {
    ...row,
    descuentoValor: row.descuentoValor != null ? Number(row.descuentoValor) : 0
  };
}

/**
 * Upsert regla PAYDISC_<code> al editar % desde Medios (compat UI).
 * Fuente de verdad = PromotionRule.
 */
async function upsertPaymentDiscountRule(tx, config, {
  descuentoActivo,
  descuentoValor,
  aplicaEnParcial,
  aplicaEnSeña
}) {
  const code = `PAYDISC_${config.code}`;
  const existing = await tx.promotionRule.findUnique({
    where: { code },
    include: { conditions: true }
  });

  if (!descuentoActivo || !(Number(descuentoValor) > 0)) {
    if (existing) {
      await tx.promotionRule.update({
        where: { id: existing.id },
        data: { activo: false }
      });
    }
    return;
  }

  const data = {
    label: `Descuento ${config.label}`,
    kind: 'DESCUENTO',
    activo: true,
    prioridad: 1000 - (config.ordenIndex || 0),
    modality: 'AUTO',
    layer: 'SETTLEMENT',
    stacking: 'EXCLUSIVE',
    aplicaEnParcial: aplicaEnParcial !== false,
    aplicaEnSeña: aplicaEnSeña !== false,
    benefitType: 'PERCENT',
    benefitValue: new Decimal(Number(descuentoValor) || 0),
    benefitBase: 'DEBT_CANCELLED',
    notas: `Sincronizado desde PaymentMethodConfig#${config.id}`
  };

  if (existing) {
    await tx.promotionRule.update({ where: { id: existing.id }, data });
    const hasPayCond = (existing.conditions || []).some((c) => c.type === 'PAYMENT_METHOD');
    if (!hasPayCond) {
      await tx.promotionCondition.create({
        data: {
          ruleId: existing.id,
          type: 'PAYMENT_METHOD',
          params: {
            paymentMethodConfigId: config.id,
            paymentMethodCode: config.code
          }
        }
      });
    }
    return;
  }

  await tx.promotionRule.create({
    data: {
      code,
      ...data,
      conditions: {
        create: [
          {
            type: 'PAYMENT_METHOD',
            params: {
              paymentMethodConfigId: config.id,
              paymentMethodCode: config.code
            }
          }
        ]
      }
    }
  });
}

exports.listPaymentMethodConfigs = async (req, res) => {
  try {
    const includeInactive = String(req.query.all || '') === '1' || String(req.query.all || '') === 'true';
    const rows = await prisma.paymentMethodConfig.findMany({
      where: includeInactive ? undefined : { activo: true },
      orderBy: [{ ordenIndex: 'asc' }, { id: 'asc' }]
    });
    let serialized = rows.map(serializeConfig);
    try {
      serialized = await enrichPaymentMethodsWithRules(prisma, serialized);
    } catch (err) {
      console.warn('enrichPaymentMethodsWithRules:', err.message);
    }
    res.json(serialized);
  } catch (error) {
    console.error('Error listando medios de pago:', error);
    res.status(500).json({ error: 'Error al listar medios de pago', details: error.message });
  }
};

exports.getPaymentMethodConfig = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await prisma.paymentMethodConfig.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'Medio de pago no encontrado' });
    let out = serializeConfig(row);
    try {
      const [enriched] = await enrichPaymentMethodsWithRules(prisma, [out]);
      out = enriched;
    } catch {
      /* ignore */
    }
    res.json(out);
  } catch (error) {
    console.error('Error obteniendo medio de pago:', error);
    res.status(500).json({ error: 'Error al obtener medio de pago', details: error.message });
  }
};

exports.createPaymentMethodConfig = async (req, res) => {
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

    const descuentoActivo = Boolean(body.descuentoActivo);
    const descuentoValor = Number(body.descuentoValor) || 0;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.paymentMethodConfig.create({
        data: {
          code,
          label,
          activo: body.activo !== false,
          ordenIndex: Number.isFinite(Number(body.ordenIndex)) ? Number(body.ordenIndex) : 100,
          requiereFacturacion: Boolean(body.requiereFacturacion),
          descuentoActivo,
          descuentoTipo: 'PERCENT',
          descuentoValor: new Decimal(descuentoValor),
          aplicaEnParcial: body.aplicaEnParcial !== false,
          aplicaEnSeña: body.aplicaEnSeña !== false,
          notas: body.notas != null ? String(body.notas).trim() || null : null
        }
      });
      await upsertPaymentDiscountRule(tx, row, {
        descuentoActivo,
        descuentoValor,
        aplicaEnParcial: body.aplicaEnParcial !== false,
        aplicaEnSeña: body.aplicaEnSeña !== false
      });
      return row;
    });
    res.status(201).json(serializeConfig(created));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un medio con ese code' });
    }
    console.error('Error creando medio de pago:', error);
    res.status(500).json({ error: 'Error al crear medio de pago', details: error.message });
  }
};

exports.updatePaymentMethodConfig = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.paymentMethodConfig.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Medio de pago no encontrado' });

    const body = req.body || {};
    const data = {};

    if (body.label != null) {
      const label = String(body.label).trim();
      if (!label) return res.status(400).json({ error: 'label no puede ser vacío' });
      data.label = label;
    }
    if (body.activo != null) data.activo = Boolean(body.activo);
    if (body.ordenIndex != null && Number.isFinite(Number(body.ordenIndex))) {
      data.ordenIndex = Number(body.ordenIndex);
    }
    if (body.requiereFacturacion != null) data.requiereFacturacion = Boolean(body.requiereFacturacion);

    const touchingDiscount =
      body.descuentoActivo != null ||
      body.descuentoValor != null ||
      body.aplicaEnParcial != null ||
      body.aplicaEnSeña != null;

    if (body.descuentoActivo != null) data.descuentoActivo = Boolean(body.descuentoActivo);
    if (body.descuentoTipo != null) {
      if (body.descuentoTipo !== 'PERCENT' && body.descuentoTipo !== 'FIXED') {
        return res.status(400).json({ error: 'descuentoTipo debe ser PERCENT o FIXED' });
      }
      data.descuentoTipo = body.descuentoTipo;
    }
    if (body.descuentoValor != null) {
      const v = Number(body.descuentoValor);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ error: 'descuentoValor inválido' });
      }
      if ((body.descuentoTipo || existing.descuentoTipo || 'PERCENT') === 'PERCENT' && v >= 100) {
        return res.status(400).json({ error: 'descuentoValor % debe ser < 100' });
      }
      data.descuentoValor = new Decimal(v);
    }
    if (body.aplicaEnParcial != null) data.aplicaEnParcial = Boolean(body.aplicaEnParcial);
    if (body.aplicaEnSeña != null) data.aplicaEnSeña = Boolean(body.aplicaEnSeña);
    if (body.notas !== undefined) {
      data.notas = body.notas != null ? String(body.notas).trim() || null : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.paymentMethodConfig.update({ where: { id }, data });
      if (touchingDiscount) {
        await upsertPaymentDiscountRule(tx, row, {
          descuentoActivo: row.descuentoActivo,
          descuentoValor: Number(row.descuentoValor),
          aplicaEnParcial: row.aplicaEnParcial,
          aplicaEnSeña: row.aplicaEnSeña
        });
      }
      return row;
    });
    res.json(serializeConfig(updated));
  } catch (error) {
    console.error('Error actualizando medio de pago:', error);
    res.status(500).json({ error: 'Error al actualizar medio de pago', details: error.message });
  }
};
