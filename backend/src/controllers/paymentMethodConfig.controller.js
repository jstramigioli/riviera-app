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

    // Descuentos solo vía PromotionRule (Config → Promociones). Mirror queda en 0.
    const created = await prisma.paymentMethodConfig.create({
      data: {
        code,
        label,
        activo: body.activo !== false,
        ordenIndex: Number.isFinite(Number(body.ordenIndex)) ? Number(body.ordenIndex) : 100,
        requiereFacturacion: Boolean(body.requiereFacturacion),
        descuentoActivo: false,
        descuentoTipo: 'PERCENT',
        descuentoValor: new Decimal(0),
        aplicaEnParcial: true,
        aplicaEnSeña: true,
        notas: body.notas != null ? String(body.notas).trim() || null : null
      }
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
    if (body.notas !== undefined) {
      data.notas = body.notas != null ? String(body.notas).trim() || null : null;
    }

    // Ignorar descuento* / aplicaEn* del body: fuente de verdad = Promociones (motor).
    const updated = await prisma.paymentMethodConfig.update({ where: { id }, data });
    res.json(serializeConfig(updated));
  } catch (error) {
    console.error('Error actualizando medio de pago:', error);
    res.status(500).json({ error: 'Error al actualizar medio de pago', details: error.message });
  }
};
