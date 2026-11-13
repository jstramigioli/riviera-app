const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { calculateReservationBalance } = require('../utils/reservationBalance');
const { allocateNextPagoCodigo } = require('../utils/pagoCodigo');
const { roleHasPermission } = require('../auth/permissions');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { civilFromDb } = require('../utils/calendarDates');
const {
  INVOICE_TYPES,
  DEFAULT_IVA_CONDITION,
  DEFAULT_PAGO_MOTIVO,
  methodRequiresBilling,
  isCardMethod,
  isDevolucionMotivo,
  normalizePagoMotivo
} = require('../utils/billingConstants');
const {
  ADJUNTO_TIPOS,
  assertAdjuntoTipo,
  assertMimeForTipo,
  saveUploadedFile,
  absolutePath,
  deleteStoredFile,
  toPublicAdjunto
} = require('../utils/pagoAdjuntos');

function canSeeFacturacion(user) {
  return roleHasPermission(user?.role, 'facturacion');
}

/** Datos de PagoFactura solo para admin; el resto recibe factura: null. */
function redactFacturaIfNeeded(pagos, user) {
  if (canSeeFacturacion(user)) return pagos;
  return (pagos || []).map((pago) => ({ ...pago, factura: null }));
}

const PAGO_ADJUNTO_INCLUDE = {
  adjuntos: {
    orderBy: { createdAt: 'asc' }
  }
};

function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
}

function normalizeOptionalString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function buildFacturaData(facturaInput, metodo, numeroTarjetaPago) {
  if (!facturaInput || typeof facturaInput !== 'object') {
    return { error: 'Datos de facturación requeridos' };
  }

  const tipo = String(facturaInput.tipo || '').toUpperCase();
  if (!INVOICE_TYPES.includes(tipo)) {
    return { error: 'Tipo de factura inválido. Debe ser A o B' };
  }

  let fecha = new Date();
  if (facturaInput.fecha) {
    const raw = String(facturaInput.fecha).trim();
    const dayOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayOnly) {
      fecha = new Date(
        Number(dayOnly[1]),
        Number(dayOnly[2]) - 1,
        Number(dayOnly[3]),
        12,
        0,
        0,
        0
      );
    } else {
      fecha = new Date(raw);
    }
  }
  if (Number.isNaN(fecha.getTime())) {
    return { error: 'Fecha de factura inválida' };
  }

  const cardFromPayment = isCardMethod(metodo)
    ? normalizeOptionalString(numeroTarjetaPago)
    : null;
  const cardNumber =
    cardFromPayment ||
    normalizeOptionalString(facturaInput.cardNumber || facturaInput.tarjetaNumero);

  const base = {
    tipo,
    fecha,
    motivo: normalizeOptionalString(facturaInput.motivo),
    cardNumber,
    email: normalizeOptionalString(facturaInput.email)
  };

  if (tipo === 'B') {
    return {
      data: {
        ...base,
        firstName: normalizeOptionalString(facturaInput.firstName || facturaInput.nombre),
        lastName: normalizeOptionalString(facturaInput.lastName || facturaInput.apellido),
        documentType: normalizeOptionalString(facturaInput.documentType || facturaInput.tipoDocumento) || 'DNI',
        documentNumber: normalizeOptionalString(facturaInput.documentNumber || facturaInput.numeroDocumento),
        address: normalizeOptionalString(facturaInput.address || facturaInput.domicilio),
        businessName: null,
        cuit: null,
        commercialAddress: null,
        ivaCondition: null
      }
    };
  }

  return {
    data: {
      ...base,
      firstName: null,
      lastName: null,
      documentType: null,
      documentNumber: null,
      address: null,
      businessName: normalizeOptionalString(facturaInput.businessName || facturaInput.razonSocial),
      cuit: normalizeOptionalString(facturaInput.cuit),
      commercialAddress: normalizeOptionalString(
        facturaInput.commercialAddress || facturaInput.domicilioComercial
      ),
      ivaCondition:
        normalizeOptionalString(facturaInput.ivaCondition || facturaInput.condicionIva) ||
        DEFAULT_IVA_CONDITION
    }
  };
}

function buildBillingProfileUpsert(clientId, facturaData) {
  const isB = facturaData.tipo === 'B';
  return {
    where: { clientId },
    create: {
      clientId,
      lastInvoiceType: facturaData.tipo,
      firstName: isB ? facturaData.firstName : undefined,
      lastName: isB ? facturaData.lastName : undefined,
      documentType: isB ? facturaData.documentType : undefined,
      documentNumber: isB ? facturaData.documentNumber : undefined,
      address: isB ? facturaData.address : undefined,
      email: facturaData.email,
      businessName: !isB ? facturaData.businessName : undefined,
      cuit: !isB ? facturaData.cuit : undefined,
      commercialAddress: !isB ? facturaData.commercialAddress : undefined,
      ivaCondition: !isB ? facturaData.ivaCondition : DEFAULT_IVA_CONDITION,
      cardNumber: facturaData.cardNumber
    },
    update: {
      lastInvoiceType: facturaData.tipo,
      email: facturaData.email,
      cardNumber: facturaData.cardNumber,
      ...(isB
        ? {
            firstName: facturaData.firstName,
            lastName: facturaData.lastName,
            documentType: facturaData.documentType,
            documentNumber: facturaData.documentNumber,
            address: facturaData.address
          }
        : {
            businessName: facturaData.businessName,
            cuit: facturaData.cuit,
            commercialAddress: facturaData.commercialAddress,
            ivaCondition: facturaData.ivaCondition
          })
    }
  };
}

// ============================================
// CONTROLADORES DE PAGOS
// ============================================

// Obtener historial global de pagos (con reserva y cliente)
exports.getAllPagos = async (req, res) => {
  try {
    const pagos = await prisma.pago.findMany({
      include: {
        factura: true,
        ...PAGO_ADJUNTO_INCLUDE,
        reserva: {
          select: {
            id: true,
            status: true,
            mainClient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
    res.json(redactFacturaIfNeeded(pagos, req.user));
  } catch (error) {
    console.error('Error obteniendo historial de pagos:', error);
    res.status(500).json({ error: 'Error al obtener el historial de pagos', details: error.message });
  }
};

// Obtener todos los pagos de una reserva
exports.getPagosByReserva = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const pagos = await prisma.pago.findMany({
      where: { reservaId: parseInt(reservaId) },
      include: { factura: true, ...PAGO_ADJUNTO_INCLUDE },
      orderBy: { fecha: 'desc' }
    });
    res.json(redactFacturaIfNeeded(pagos, req.user));
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ error: 'Error al obtener los pagos', details: error.message });
  }
};

// Crear un nuevo pago para una reserva
exports.createPago = async (req, res) => {
  const { reservaId } = req.params;
  const {
    monto,
    moneda,
    tipoCambio,
    metodo,
    tipoTarjeta,
    numeroTarjeta,
    empresa,
    referencia,
    notas,
    motivo,
    requiereFacturacion,
    factura
  } = req.body;
  // fecha del pago: siempre automática en el servidor (no se acepta del cliente)

  if (!monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos requeridos: monto y metodo' });
  }

  const motivoPago = normalizePagoMotivo(motivo ?? DEFAULT_PAGO_MOTIVO);
  if (!motivoPago) {
    return res.status(400).json({ error: 'Motivo inválido. Debe ser Pago, Seña o Devolución' });
  }

  const montoAbs = Math.abs(Number(monto));
  if (!Number.isFinite(montoAbs) || montoAbs <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }
  // Devolución reduce el saldo pagado de la reserva (monto/montoARS negativos).
  const montoSigned = isDevolucionMotivo(motivoPago) ? -montoAbs : montoAbs;

  // Validar campos de tarjeta si el método es Tarjeta Debito o Credito
  if (['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)) {
    if (!numeroTarjeta) {
      return res.status(400).json({ error: 'El número de tarjeta es requerido para pagos con tarjeta' });
    }
    if (!empresa) {
      return res.status(400).json({ error: 'La empresa de la tarjeta es requerida para pagos con tarjeta' });
    }
  }

  // Validar moneda
  const monedasValidas = ['ARS', 'USD'];
  const monedaFinal = moneda || 'ARS';
  if (!monedasValidas.includes(monedaFinal)) {
    return res.status(400).json({ 
      error: `Moneda inválida. Debe ser una de: ${monedasValidas.join(', ')}` 
    });
  }

  const billingForced = methodRequiresBilling(metodo);
  const wantsBilling = billingForced || Boolean(requiereFacturacion);
  let facturaParsed = null;
  if (wantsBilling) {
    facturaParsed = buildFacturaData(
      { ...(factura && typeof factura === 'object' ? factura : {}), motivo: motivoPago },
      metodo,
      numeroTarjeta
    );
    if (facturaParsed.error) {
      return res.status(400).json({ error: facturaParsed.error });
    }
  }

  // Si es USD, obtener tipo de cambio (del request o global)
  let tipoCambioFinal = tipoCambio;
  if (monedaFinal === 'USD') {
    if (!tipoCambioFinal || tipoCambioFinal <= 0) {
      // Intentar obtener el tipo de cambio global
      try {
        const configuracion = await prisma.configuracion.findUnique({
          where: { clave: 'tipo_cambio_usd' }
        });
        
        if (configuracion && configuracion.activo) {
          tipoCambioFinal = parseFloat(configuracion.valor);
        } else {
          return res.status(400).json({ 
            error: 'Para pagos en USD, el tipo de cambio es requerido. No se encontró un tipo de cambio global configurado.' 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          error: 'Para pagos en USD, el tipo de cambio es requerido y debe ser mayor a 0' 
        });
      }
    }
  }

  try {
    // Calcular monto en ARS (negativo si es devolución)
    let montoARS;
    if (monedaFinal === 'USD') {
      montoARS = new Decimal(montoSigned).mul(new Decimal(tipoCambioFinal));
    } else {
      montoARS = new Decimal(montoSigned);
    }

    const fechaPago = new Date();

    const nuevoPago = await prisma.$transaction(async (tx) => {
      const codigo = await allocateNextPagoCodigo(tx);
      const pago = await tx.pago.create({
        data: {
          codigo,
          reservaId: parseInt(reservaId),
          monto: new Decimal(montoSigned),
          moneda: monedaFinal,
          tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
          montoARS: montoARS,
          metodo,
          numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo) ? numeroTarjeta : null,
          empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo) ? empresa : null,
          referencia: referencia || null,
          notas: notas || null,
          motivo: motivoPago,
          fecha: fechaPago,
          requiereFacturacion: wantsBilling,
          ...(wantsBilling
            ? {
                factura: {
                  create: facturaParsed.data
                }
              }
            : {})
        },
        include: { factura: true, ...PAGO_ADJUNTO_INCLUDE }
      });

      if (wantsBilling) {
        const reserva = await tx.reservation.findUnique({
          where: { id: parseInt(reservaId) },
          select: { mainClientId: true }
        });
        if (reserva?.mainClientId) {
          await tx.clientBillingProfile.upsert(
            buildBillingProfileUpsert(reserva.mainClientId, facturaParsed.data)
          );
        }
      }

      return pago;
    });
    res.status(201).json(nuevoPago);
  } catch (error) {
    console.error('Error creando pago:', error);
    res.status(500).json({ error: 'Error al crear el pago', details: error.message });
  }
};

// Actualizar un pago existente
exports.updatePago = async (req, res) => {
  const { id } = req.params;
  const {
    monto,
    moneda,
    tipoCambio,
    metodo,
    tipoTarjeta,
    numeroTarjeta,
    empresa,
    referencia,
    notas,
    fecha,
    retirado
  } = req.body;

  try {
    // Obtener el pago actual para validaciones
    const pagoActual = await prisma.pago.findUnique({
      where: { id: parseInt(id) }
    });

    if (!pagoActual) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const dataToUpdate = {};
    
    // Validar moneda si se proporciona
    if (moneda !== undefined) {
      const monedasValidas = ['ARS', 'USD'];
      if (!monedasValidas.includes(moneda)) {
        return res.status(400).json({ 
          error: `Moneda inválida. Debe ser una de: ${monedasValidas.join(', ')}` 
        });
      }
      dataToUpdate.moneda = moneda;
    }

    // Validar tipo de cambio si se proporciona
    if (tipoCambio !== undefined) {
      if (tipoCambio <= 0) {
        return res.status(400).json({ error: 'El tipo de cambio debe ser mayor a 0' });
      }
      dataToUpdate.tipoCambio = new Decimal(tipoCambio);
    }

    // Validar monto si se proporciona
    if (monto !== undefined) {
      if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      }
      dataToUpdate.monto = new Decimal(monto);
    }

    // Validar campos de tarjeta si se cambia el método a Tarjeta Debito o Credito
    if (metodo !== undefined && ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)) {
      if (!numeroTarjeta) {
        return res.status(400).json({ error: 'El número de tarjeta es requerido para pagos con tarjeta' });
      }
      if (!empresa) {
        return res.status(400).json({ error: 'La empresa de la tarjeta es requerida para pagos con tarjeta' });
      }
    }

    // Calcular monto en ARS si se cambió monto, moneda o tipo de cambio
    const monedaFinal = moneda !== undefined ? moneda : pagoActual.moneda;
    const montoFinal = monto !== undefined ? monto : parseFloat(pagoActual.monto);
    const tipoCambioFinal = tipoCambio !== undefined ? tipoCambio : (pagoActual.tipoCambio ? parseFloat(pagoActual.tipoCambio) : null);

    if (monedaFinal === 'USD' && !tipoCambioFinal) {
      return res.status(400).json({ 
        error: 'Para pagos en USD, el tipo de cambio es requerido' 
      });
    }

    if (monto !== undefined || moneda !== undefined || tipoCambio !== undefined) {
      if (monedaFinal === 'USD') {
        dataToUpdate.montoARS = new Decimal(montoFinal).mul(new Decimal(tipoCambioFinal));
      } else {
        dataToUpdate.montoARS = new Decimal(montoFinal);
      }
    }

    if (metodo !== undefined) dataToUpdate.metodo = metodo;
    if (numeroTarjeta !== undefined) dataToUpdate.numeroTarjeta = numeroTarjeta;
    if (empresa !== undefined) dataToUpdate.empresa = empresa;
    if (referencia !== undefined) dataToUpdate.referencia = referencia;
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (fecha !== undefined) dataToUpdate.fecha = new Date(fecha);

    if (retirado !== undefined) {
      const metodoFinal = metodo !== undefined ? metodo : pagoActual.metodo;
      if (isTransferencia(metodoFinal)) {
        return res.status(400).json({
          error: 'Retirado no aplica a pagos por Transferencia'
        });
      }
      dataToUpdate.retirado = Boolean(retirado);
    }

    const pagoActualizado = await prisma.pago.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: { factura: true, ...PAGO_ADJUNTO_INCLUDE }
    });
    res.json(pagoActualizado);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    console.error('Error actualizando pago:', error);
    res.status(500).json({ error: 'Error al actualizar el pago', details: error.message });
  }
};

// Eliminar un pago
exports.deletePago = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.pago.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Pago eliminado exitosamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    console.error('Error eliminando pago:', error);
    res.status(500).json({ error: 'Error al eliminar el pago', details: error.message });
  }
};

// ============================================
// ADJUNTOS DE FACTURA / COMPROBANTE
// ============================================

exports.uploadPagoAdjuntos = async (req, res) => {
  const pagoId = parseInt(req.params.id, 10);
  const tipoResult = assertAdjuntoTipo(req.params.tipo || req.body?.tipo);
  if (tipoResult.error) {
    return res.status(400).json({ error: tipoResult.error });
  }
  const tipo = tipoResult.tipo;

  try {
    const pago = await prisma.pago.findUnique({ where: { id: pagoId } });
    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (tipo === ADJUNTO_TIPOS.FACTURA && !pago.requiereFacturacion) {
      return res.status(400).json({
        error: 'Este pago no requiere facturación'
      });
    }
    if (tipo === ADJUNTO_TIPOS.COMPROBANTE && !isTransferencia(pago.metodo)) {
      return res.status(400).json({
        error: 'Los comprobantes solo aplican a Transferencia'
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Subí al menos un archivo' });
    }

    const created = [];
    for (const file of files) {
      const mimeCheck = assertMimeForTipo(tipo, file.mimetype);
      if (mimeCheck.error) {
        for (const row of created) {
          deleteStoredFile(pagoId, row.storedName);
        }
        return res.status(400).json({ error: mimeCheck.error });
      }
      const saved = saveUploadedFile(pagoId, file, tipo);
      const row = await prisma.pagoAdjunto.create({
        data: {
          pagoId,
          tipo: saved.tipo,
          originalName: saved.originalName,
          storedName: saved.storedName,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes
        }
      });
      created.push(row);
    }

    res.status(201).json(created.map(toPublicAdjunto));
  } catch (error) {
    console.error('Error subiendo adjuntos de pago:', error);
    res.status(500).json({ error: 'Error al subir adjuntos', details: error.message });
  }
};

exports.downloadPagoAdjunto = async (req, res) => {
  const pagoId = parseInt(req.params.id, 10);
  const adjuntoId = parseInt(req.params.adjuntoId, 10);

  try {
    const adjunto = await prisma.pagoAdjunto.findFirst({
      where: { id: adjuntoId, pagoId }
    });
    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    const filePath = absolutePath(pagoId, adjunto.storedName);
    res.download(filePath, adjunto.originalName, (err) => {
      if (err && !res.headersSent) {
        console.error('Error descargando adjunto:', err);
        res.status(404).json({ error: 'Archivo no encontrado en disco' });
      }
    });
  } catch (error) {
    console.error('Error descargando adjunto de pago:', error);
    res.status(500).json({ error: 'Error al descargar adjunto', details: error.message });
  }
};

exports.deletePagoAdjunto = async (req, res) => {
  const pagoId = parseInt(req.params.id, 10);
  const adjuntoId = parseInt(req.params.adjuntoId, 10);

  try {
    const adjunto = await prisma.pagoAdjunto.findFirst({
      where: { id: adjuntoId, pagoId }
    });
    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    if (adjunto.tipo === ADJUNTO_TIPOS.FACTURA && !canSeeFacturacion(req.user)) {
      return res.status(403).json({ error: 'No autorizado a eliminar comprobantes de facturación' });
    }

    await prisma.pagoAdjunto.delete({ where: { id: adjunto.id } });
    deleteStoredFile(pagoId, adjunto.storedName);

    res.json({ ok: true, id: adjunto.id });
  } catch (error) {
    console.error('Error eliminando adjunto de pago:', error);
    res.status(500).json({ error: 'Error al eliminar adjunto', details: error.message });
  }
};

// ============================================
// CONTROLADORES DE CARGOS
// ============================================

// Obtener todos los cargos de una reserva
exports.getCargosByReserva = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const cargos = await prisma.cargo.findMany({
      where: { reservaId: parseInt(reservaId) },
      include: {
        // Para subcategorías personalizables (servicios, consumos, otros)
        subcategoriaCargo: true,
        // Para alojamiento (campos directos)
        roomType: true,
        serviceType: true
      },
      orderBy: { fecha: 'asc' } // Más antiguos primero
    });
    res.json(cargos);
  } catch (error) {
    console.error('Error obteniendo cargos:', error);
    res.status(500).json({ error: 'Error al obtener los cargos', details: error.message });
  }
};

// Crear un nuevo cargo para una reserva
exports.createCargo = async (req, res) => {
  const { reservaId } = req.params;
  const { 
    descripcion, 
    monto, 
    subcategoriaCargoId, 
    roomTypeId, 
    serviceTypeId,
    tipoCargoId, 
    tipo, 
    notas, 
    fecha 
  } = req.body;

  if (!descripcion || !monto) {
    return res.status(400).json({ error: 'Faltan campos requeridos: descripcion y monto' });
  }

  if (monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  // Enfoque híbrido: 
  // 1. Si tiene roomTypeId + serviceTypeId → Es alojamiento (campos directos)
  // 2. Si tiene subcategoriaCargoId → Es otro tipo (subcategoría personalizable)
  
  let cargoData = {
    reservaId: parseInt(reservaId),
    descripcion,
    monto: new Decimal(monto),
    notas: notas || null,
    fecha: fecha ? new Date(fecha) : new Date()
  };

  let includeClause = {
    subcategoriaCargo: true,
    roomType: true,
    serviceType: true
  };

  // CASO 1: Alojamiento (roomTypeId + serviceTypeId)
  if (roomTypeId && serviceTypeId) {
    // Verificar que roomType y serviceType existen
    const [roomType, serviceType] = await Promise.all([
      prisma.roomType.findUnique({ where: { id: parseInt(roomTypeId) } }),
      prisma.serviceType.findUnique({ where: { id: serviceTypeId } })
    ]);

    if (!roomType) {
      return res.status(400).json({ error: 'Tipo de habitación no encontrado' });
    }
    if (!serviceType) {
      return res.status(400).json({ error: 'Tipo de servicio no encontrado' });
    }

    cargoData.roomTypeId = parseInt(roomTypeId);
    cargoData.serviceTypeId = serviceTypeId;
    cargoData.montoOriginal = new Decimal(monto);
    cargoData.manualOverride = false;
  }
  // CASO 2: Otros tipos (subcategoría personalizable)
  else if (subcategoriaCargoId) {
    // Verificar que la subcategoría existe y está activa
    const subcategoria = await prisma.subcategoriaCargo.findFirst({
      where: {
        id: parseInt(subcategoriaCargoId),
        esActivo: true
      }
    });

    if (!subcategoria) {
      return res.status(400).json({ 
        error: 'La subcategoría especificada no existe o está inactiva' 
      });
    }

    cargoData.subcategoriaCargoId = parseInt(subcategoriaCargoId);
  }
  // CASO 3: Compatibilidad backward con sistema anterior
  else if (tipoCargoId || tipo) {
    const mapeoTipos = {
      1: 'SERVICIO',     // Mapear ALOJAMIENTO → primer servicio disponible
      2: 'SERVICIO',     
      3: 'CONSUMO',      
      4: 'OTRO',         
      'ALOJAMIENTO': 'SERVICIO', // No hay más subcategorías de alojamiento
      'SERVICIO': 'SERVICIO',
      'CONSUMO': 'CONSUMO',
      'OTRO': 'OTRO'
    };

    const tipoFinal = mapeoTipos[tipoCargoId] || mapeoTipos[tipo] || 'OTRO';
    
    // Buscar la primera subcategoría activa de ese tipo
    const subcategoriaDefecto = await prisma.subcategoriaCargo.findFirst({
      where: {
        tipo: tipoFinal,
        esActivo: true
      },
      orderBy: { ordenIndex: 'asc' }
    });

    if (subcategoriaDefecto) {
      cargoData.subcategoriaCargoId = subcategoriaDefecto.id;
    } else {
      return res.status(400).json({
        error: `No se encontraron subcategorías del tipo ${tipoFinal}. Configure algunas en el sistema.`
      });
    }
  }
  else {
    return res.status(400).json({
      error: 'Debe especificar subcategoriaCargoId O roomTypeId+serviceTypeId'
    });
  }

  try {
    const nuevoCargo = await prisma.cargo.create({
      data: cargoData,
      include: includeClause
    });

    res.status(201).json(nuevoCargo);
  } catch (error) {
    console.error('Error creando cargo:', error);
    res.status(500).json({ error: 'Error al crear el cargo', details: error.message });
  }
};

// Actualizar un cargo existente
exports.updateCargo = async (req, res) => {
  const { id } = req.params;
  const { 
    descripcion, 
    monto, 
    subcategoriaCargoId, 
    roomTypeId, 
    serviceTypeId,
    tipoCargoId, 
    tipo, 
    notas, 
    fecha,
    clearOverride
  } = req.body;

  try {
    const cargoExistente = await prisma.cargo.findUnique({
      where: { id: parseInt(id, 10) }
    });
    if (!cargoExistente) {
      return res.status(404).json({ error: 'Cargo no encontrado' });
    }

    const isLodging = !cargoExistente.subcategoriaCargoId;
    const dataToUpdate = {};

    // Quitar override de alojamiento → vuelve al monto original (tarifa de la reserva)
    if (clearOverride === true) {
      if (!isLodging) {
        return res.status(400).json({
          error: 'clearOverride solo aplica a cargos de alojamiento'
        });
      }
      const original = cargoExistente.montoOriginal != null
        ? parseFloat(cargoExistente.montoOriginal)
        : parseFloat(cargoExistente.monto);
      dataToUpdate.monto = new Decimal(original);
      dataToUpdate.manualOverride = false;
      if (cargoExistente.montoOriginal == null) {
        dataToUpdate.montoOriginal = new Decimal(original);
      }

      const cargoRestaurado = await prisma.cargo.update({
        where: { id: parseInt(id, 10) },
        data: dataToUpdate,
        include: {
          subcategoriaCargo: true,
          roomType: true,
          serviceType: true
        }
      });

      // Alinear night rate de esa fecha si existe
      try {
        const dateKey = cargoRestaurado.fecha;
        await prisma.reservationNightRate.updateMany({
          where: {
            reservationId: cargoRestaurado.reservaId,
            date: dateKey
          },
          data: {
            finalRate: original,
            manualOverride: false
          }
        });
      } catch (nrErr) {
        console.warn('No se pudo alinear night rate al quitar override:', nrErr.message);
      }

      return res.json(cargoRestaurado);
    }
    
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (monto !== undefined) {
      if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      }
      dataToUpdate.monto = new Decimal(monto);

      // Alojamiento: monto manual tiene prioridad sobre la tarifa; se conserva original
      if (isLodging) {
        if (cargoExistente.montoOriginal == null) {
          dataToUpdate.montoOriginal = new Decimal(cargoExistente.monto);
        }
        dataToUpdate.manualOverride = true;
      }
    }
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (fecha !== undefined) dataToUpdate.fecha = new Date(fecha);
    
    // Enfoque híbrido para actualización:
    // 1. Si viene roomTypeId + serviceTypeId → Cambiar a alojamiento
    // 2. Si viene subcategoriaCargoId → Cambiar a otro tipo
    
    if (roomTypeId !== undefined && serviceTypeId !== undefined) {
      // Cambiar a cargo de alojamiento
      const [roomType, serviceType] = await Promise.all([
        prisma.roomType.findUnique({ where: { id: parseInt(roomTypeId) } }),
        prisma.serviceType.findUnique({ where: { id: serviceTypeId } })
      ]);

      if (!roomType) {
        return res.status(400).json({ error: 'Tipo de habitación no encontrado' });
      }
      if (!serviceType) {
        return res.status(400).json({ error: 'Tipo de servicio no encontrado' });
      }

      dataToUpdate.roomTypeId = parseInt(roomTypeId);
      dataToUpdate.serviceTypeId = serviceTypeId;
      dataToUpdate.subcategoriaCargoId = null; // Limpiar subcategoría
    }
    else if (subcategoriaCargoId !== undefined) {
      // Cambiar a cargo con subcategoría personalizable
      if (subcategoriaCargoId === null) {
        dataToUpdate.subcategoriaCargoId = null;
        dataToUpdate.roomTypeId = null;
        dataToUpdate.serviceTypeId = null;
      } else {
        const subcategoria = await prisma.subcategoriaCargo.findFirst({
          where: {
            id: parseInt(subcategoriaCargoId),
            esActivo: true
          }
        });

        if (!subcategoria) {
          return res.status(400).json({ 
            error: 'La subcategoría especificada no existe o está inactiva' 
          });
        }

        dataToUpdate.subcategoriaCargoId = parseInt(subcategoriaCargoId);
        dataToUpdate.roomTypeId = null; // Limpiar campos de alojamiento
        dataToUpdate.serviceTypeId = null;
      }
    }
    else if (tipoCargoId !== undefined || tipo !== undefined) {
      // COMPATIBILIDAD BACKWARD: Convertir desde sistema anterior
      const mapeoTipos = {
        1: 'SERVICIO',     // Ya no hay ALOJAMIENTO como subcategoría
        2: 'SERVICIO',
        3: 'CONSUMO',
        4: 'OTRO',
        'ALOJAMIENTO': 'SERVICIO', // Mapear a servicio por defecto
        'SERVICIO': 'SERVICIO',
        'CONSUMO': 'CONSUMO',
        'OTRO': 'OTRO'
      };

      const tipoFinal = mapeoTipos[tipoCargoId] || mapeoTipos[tipo];
      
      if (tipoFinal) {
        const subcategoriaDefecto = await prisma.subcategoriaCargo.findFirst({
          where: {
            tipo: tipoFinal,
            esActivo: true
          },
          orderBy: { ordenIndex: 'asc' }
        });

        if (subcategoriaDefecto) {
          dataToUpdate.subcategoriaCargoId = subcategoriaDefecto.id;
          dataToUpdate.roomTypeId = null; // Limpiar campos de alojamiento
          dataToUpdate.serviceTypeId = null;
        } else {
          return res.status(400).json({
            error: `No se encontraron subcategorías activas para el tipo ${tipoFinal}`
          });
        }
      }
    }

    const cargoActualizado = await prisma.cargo.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: {
        subcategoriaCargo: true,
        roomType: true,
        serviceType: true
      }
    });

    // Si se sobreescribió un cargo de alojamiento, alinear night rate
    if (isLodging && dataToUpdate.manualOverride === true && dataToUpdate.monto !== undefined) {
      try {
        await prisma.reservationNightRate.updateMany({
          where: {
            reservationId: cargoActualizado.reservaId,
            date: cargoActualizado.fecha
          },
          data: {
            finalRate: parseFloat(cargoActualizado.monto),
            manualOverride: true
          }
        });
      } catch (nrErr) {
        console.warn('No se pudo alinear night rate al override:', nrErr.message);
      }
    }

    res.json(cargoActualizado);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cargo no encontrado' });
    }
    console.error('Error actualizando cargo:', error);
    res.status(500).json({ error: 'Error al actualizar el cargo', details: error.message });
  }
};

// Eliminar un cargo
exports.deleteCargo = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cargo.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Cargo eliminado exitosamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cargo no encontrado' });
    }
    console.error('Error eliminando cargo:', error);
    res.status(500).json({ error: 'Error al eliminar el cargo', details: error.message });
  }
};

// ============================================
// RESUMEN FINANCIERO
// ============================================

// Obtener resumen financiero de una reserva (total cargos, total pagos, saldo)
exports.getResumenFinanciero = async (req, res) => {
  const { reservaId } = req.params;
  
  try {
    const [pagos, cargos, reserva] = await Promise.all([
      prisma.pago.findMany({
        where: { reservaId: parseInt(reservaId) }
      }),
      prisma.cargo.findMany({
        where: { reservaId: parseInt(reservaId) },
        include: {
          subcategoriaCargo: true,
          roomType: true,
          serviceType: true
        }
      }),
      prisma.reservation.findUnique({
        where: { id: parseInt(reservaId) },
        include: {
          mainClient: true,
          guests: true,
          segments: {
            include: {
              room: true,
              roomType: true
            }
          }
        }
      })
    ]);

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const { totalCargos, totalPagos, saldo, estadoPago } = calculateReservationBalance(cargos, pagos);

    // Agrupar cargos por tipo principal y subcategoría (enfoque híbrido)
    const cargosPorTipo = cargos.reduce((acc, cargo) => {
      let tipoPrincipal, subcategoriaNombre;
      
      // Determinar tipo y subcategoría según enfoque híbrido
      if (cargo.roomTypeId && cargo.serviceTypeId) {
        // Es un cargo de alojamiento (campos directos)
        tipoPrincipal = 'ALOJAMIENTO';
        subcategoriaNombre = `${cargo.roomType?.name || 'Habitación'} - ${cargo.serviceType?.name || 'Servicio'}`;
      } else if (cargo.subcategoriaCargo) {
        // Es otro tipo de cargo (subcategoría personalizable)
        tipoPrincipal = cargo.subcategoriaCargo.tipo;
        subcategoriaNombre = cargo.subcategoriaCargo.nombre;
      } else {
        // Cargo sin categoría definida
        tipoPrincipal = 'OTRO';
        subcategoriaNombre = 'Sin categoría';
      }
      
      if (!acc[tipoPrincipal]) {
        const infoTipo = {
          'ALOJAMIENTO': { nombre: 'Alojamiento', color: '#4caf50' },
          'SERVICIO': { nombre: 'Servicios', color: '#2196f3' },
          'CONSUMO': { nombre: 'Consumos', color: '#ff9800' },
          'OTRO': { nombre: 'Otros', color: '#9e9e9e' }
        };
        
        acc[tipoPrincipal] = {
          nombre: infoTipo[tipoPrincipal]?.nombre || 'Otros',
          codigo: tipoPrincipal,
          color: infoTipo[tipoPrincipal]?.color || '#9e9e9e',
          cantidad: 0,
          total: 0,
          subcategorias: {},
          items: []
        };
      }
      
      // Agrupar también por subcategoría
      if (!acc[tipoPrincipal].subcategorias[subcategoriaNombre]) {
        acc[tipoPrincipal].subcategorias[subcategoriaNombre] = {
          nombre: subcategoriaNombre,
          cantidad: 0,
          total: 0,
          items: []
        };
      }
      
      acc[tipoPrincipal].cantidad++;
      acc[tipoPrincipal].total += parseFloat(cargo.monto);
      acc[tipoPrincipal].items.push(cargo);
      
      acc[tipoPrincipal].subcategorias[subcategoriaNombre].cantidad++;
      acc[tipoPrincipal].subcategorias[subcategoriaNombre].total += parseFloat(cargo.monto);
      acc[tipoPrincipal].subcategorias[subcategoriaNombre].items.push(cargo);
      
      return acc;
    }, {});

    // Agrupar pagos por método
    const pagosPorMetodo = pagos.reduce((acc, pago) => {
      const metodo = pago.metodo;
      if (!acc[metodo]) {
        acc[metodo] = {
          cantidad: 0,
          total: 0,
          items: []
        };
      }
      acc[metodo].cantidad++;
      acc[metodo].total += parseFloat(pago.montoARS);
      acc[metodo].items.push(pago);
      return acc;
    }, {});

    res.json({
      reserva: {
        id: reserva.id,
        status: reserva.status,
        mainClient: reserva.mainClient,
        guests: reserva.guests,
        segments: reserva.segments
      },
      resumen: {
        totalCargos,
        totalPagos,
        saldo,
        estadoPago
      },
      cargos: {
        total: totalCargos,
        cantidad: cargos.length,
        porTipo: cargosPorTipo,
        items: cargos
      },
      pagos: {
        total: totalPagos,
        cantidad: pagos.length,
        porMetodo: pagosPorMetodo,
        items: pagos
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen financiero:', error);
    res.status(500).json({ error: 'Error al obtener el resumen financiero', details: error.message });
  }
};

// Obtener el tipo de cambio actual para nuevos pagos
exports.getTipoCambioActual = async (req, res) => {
  try {
    const configuracion = await prisma.configuracion.findUnique({
      where: { clave: 'tipo_cambio_usd' }
    });
    
    if (!configuracion || !configuracion.activo) {
      return res.json({ 
        tipoCambio: null, 
        message: 'No se ha configurado el tipo de cambio del dólar' 
      });
    }
    
    res.json({ 
      tipoCambio: parseFloat(configuracion.valor),
      descripcion: configuracion.descripcion,
      actualizado: configuracion.updatedAt
    });
  } catch (error) {
    console.error('Error obteniendo tipo de cambio:', error);
    res.status(500).json({ error: 'Error al obtener el tipo de cambio', details: error.message });
  }
};

/**
 * Opciones para el Select del modal Nuevo pago / devolución.
 * Incluye reservas activas (no canceladas / no-show), con o sin estadía hoy —
 * p.ej. señas sobre reservas futuras. No reusa occupied-rooms (solo día civil).
 */
exports.getReservasParaPago = async (req, res) => {
  try {
    const reservas = await prisma.reservation.findMany({
      where: {
        status: { in: OCCUPYING_STATUSES },
        segments: { some: { isActive: true } }
      },
      select: {
        id: true,
        status: true,
        mainClient: {
          select: { id: true, firstName: true, lastName: true }
        },
        segments: {
          where: { isActive: true },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            room: { select: { id: true, name: true, orderIndex: true } }
          },
          orderBy: [{ startDate: 'asc' }, { room: { orderIndex: 'asc' } }]
        }
      },
      orderBy: { id: 'desc' }
    });

    const data = reservas.map((reserva) => {
      const seg = reserva.segments[0] || null;
      const roomName = seg?.room?.name || null;
      const lastName = String(reserva.mainClient?.lastName || '').trim();
      const firstName = String(reserva.mainClient?.firstName || '').trim();
      const clientName = `${firstName} ${lastName}`.trim();
      const apellido = lastName || 'Sin apellido';
      const roomLabel = roomName || `Reserva #${reserva.id}`;
      return {
        reservationId: reserva.id,
        status: reserva.status,
        roomId: seg?.room?.id || null,
        roomName,
        clientId: reserva.mainClient?.id || null,
        clientName,
        clientLastName: lastName,
        label: `${roomLabel} - ${apellido}`,
        segmentId: seg?.id || null,
        startDate: seg ? civilFromDb(seg.startDate) : null,
        endDate: seg ? civilFromDb(seg.endDate) : null
      };
    });

    data.sort((a, b) => {
      const byName = String(a.clientLastName).localeCompare(String(b.clientLastName), 'es');
      if (byName !== 0) return byName;
      return String(a.roomName || '').localeCompare(String(b.roomName || ''), 'es', {
        numeric: true
      });
    });

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error listando reservas para pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar reservas para pago',
      details: error.message
    });
  }
};

// Obtener listado de todas las reservas con sus saldos.
// Solo pedimos campos necesarios para el cálculo/UI: un include anidado
// (subcategoria/roomType/serviceType/guests) hacía fallar toda la página
// ante desfase schema↔DB (p.ej. columnas nuevas en Pago/Cargo).
exports.getReservasConSaldos = async (req, res) => {
  try {
    const reservas = await prisma.reservation.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        mainClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        cargos: { select: { monto: true } },
        pagos: { select: { id: true, codigo: true, montoARS: true, fecha: true } },
        _count: { select: { guests: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reservasConSaldos = reservas.map((reserva) => {
      const { totalCargos, totalPagos, saldo, estadoPago } = calculateReservationBalance(
        reserva.cargos,
        reserva.pagos
      );

      return {
        id: reserva.id,
        status: reserva.status,
        mainClient: reserva.mainClient,
        cantidadHuespedes: reserva._count?.guests ?? 0,
        totalCargos,
        totalPagos,
        saldo,
        estadoPago,
        // Código de pago (A000…) para papelitos / ubicación rápida
        pagos: (reserva.pagos || [])
          .map((pago) => ({
            id: pago.id,
            codigo: pago.codigo,
            montoARS: pago.montoARS,
            fecha: pago.fecha,
          }))
          .sort((a, b) => a.id - b.id),
        createdAt: reserva.createdAt,
        updatedAt: reserva.updatedAt
      };
    });

    res.json(reservasConSaldos);
  } catch (error) {
    console.error('Error obteniendo reservas con saldos:', error);
    res.status(500).json({ error: 'Error al obtener las reservas', details: error.message });
  }
};


