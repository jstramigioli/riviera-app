const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');

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
    res.json(rows.map(serializeConfig));
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
    res.json(serializeConfig(row));
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

    const descuentoTipo = body.descuentoTipo === 'FIXED' ? 'FIXED' : 'PERCENT';
    if (descuentoTipo === 'FIXED') {
      return res.status(400).json({ error: 'MVP solo admite descuentoTipo PERCENT' });
    }

    const created = await prisma.paymentMethodConfig.create({
      data: {
        code,
        label,
        activo: body.activo !== false,
        ordenIndex: Number.isFinite(Number(body.ordenIndex)) ? Number(body.ordenIndex) : 100,
        requiereFacturacion: Boolean(body.requiereFacturacion),
        descuentoActivo: Boolean(body.descuentoActivo),
        descuentoTipo: 'PERCENT',
        descuentoValor: new Decimal(Number(body.descuentoValor) || 0),
        aplicaEnParcial: body.aplicaEnParcial !== false,
        aplicaEnSeña: body.aplicaEnSeña !== false,
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
    if (body.descuentoActivo != null) data.descuentoActivo = Boolean(body.descuentoActivo);
    if (body.descuentoTipo != null) {
      if (body.descuentoTipo !== 'PERCENT') {
        return res.status(400).json({ error: 'MVP solo admite descuentoTipo PERCENT' });
      }
      data.descuentoTipo = 'PERCENT';
    }
    if (body.descuentoValor != null) {
      const v = Number(body.descuentoValor);
      if (!Number.isFinite(v) || v < 0 || v >= 100) {
        return res.status(400).json({ error: 'descuentoValor debe ser >= 0 y < 100' });
      }
      data.descuentoValor = new Decimal(v);
    }
    if (body.aplicaEnParcial != null) data.aplicaEnParcial = Boolean(body.aplicaEnParcial);
    if (body.aplicaEnSeña != null) data.aplicaEnSeña = Boolean(body.aplicaEnSeña);
    if (body.notas !== undefined) {
      data.notas = body.notas != null ? String(body.notas).trim() || null : null;
    }
    // code inmutable en update (clave estable)

    const updated = await prisma.paymentMethodConfig.update({
      where: { id },
      data
    });
    res.json(serializeConfig(updated));
  } catch (error) {
    console.error('Error actualizando medio de pago:', error);
    res.status(500).json({ error: 'Error al actualizar medio de pago', details: error.message });
  }
};
