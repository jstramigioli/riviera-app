const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { calculateReservationBalance } = require('../utils/reservationBalance');
const { calculateAccountBalance } = require('../utils/accountBalance');
const { allocateNextPagoCodigo } = require('../utils/pagoCodigo');
const { roleHasPermission } = require('../auth/permissions');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { civilFromDb, parseFechaInput } = require('../utils/calendarDates');
const {
  ensureReservationAccount,
  dualWriteReservationRefs,
  syncAccountStatusFromBalance
} = require('../utils/accountHelpers');
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
  resolvePaymentMethodConfig,
  loadAccountFinancialParts,
  createForwardDiscount,
  createReversalDiscount,
  sumDevolucionesOnOrigen
} = require('../utils/paymentMethodService');
const { toNumber, roundMoney } = require('../utils/paymentDiscount');
const {
  validateImputaciones,
  autoDistributeOldestFirst,
  distributeBonificacion,
  IMPUTACION_LIST_INCLUDE,
  imputationToFolioPagoView
} = require('../utils/pagoImputacion');
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

function buildFacturaData(facturaInput, metodo, numeroTarjetaPago, req) {
  if (!facturaInput || typeof facturaInput !== 'object') {
    return { error: 'Datos de facturación requeridos' };
  }

  const tipo = String(facturaInput.tipo || '').toUpperCase();
  if (!INVOICE_TYPES.includes(tipo)) {
    return { error: 'Tipo de factura inválido. Debe ser A o B' };
  }

  const fecha = parseFechaInput(facturaInput.fecha, req);
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

// Obtener pagos/imputaciones de una reserva (crédito de folio, no caja completa si multi)
exports.getPagosByReserva = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const account = await ensureReservationAccount(prisma, reservaId);
    const imputaciones = await prisma.pagoImputacion.findMany({
      where: { accountId: account.id },
      include: IMPUTACION_LIST_INCLUDE,
      orderBy: [{ pago: { fecha: 'desc' } }, { ordenIndex: 'asc' }]
    });
    const views = imputaciones.map(imputationToFolioPagoView);
    res.json(redactFacturaIfNeeded(views, req.user));
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
    paymentMethodConfigId,
    pagoOrigenId,
    tipoTarjeta,
    numeroTarjeta,
    empresa,
    notas,
    motivo,
    requiereFacturacion,
    factura,
    selectedRuleIds,
    promotionRuleIds,
    deselectedRuleIds,
    benefitValueByRuleId,
    applySuggestedDefaults,
    applyAutomatics,
    fecha
  } = req.body;
  const acceptedRuleIds = []
    .concat(selectedRuleIds || [])
    .concat(promotionRuleIds || [])
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isFinite(id));
  const acceptedDeselectedRuleIds = Array.isArray(deselectedRuleIds)
    ? deselectedRuleIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id))
    : [];
  const acceptedBenefitValues =
    benefitValueByRuleId && typeof benefitValueByRuleId === 'object'
      ? benefitValueByRuleId
      : {};
  const acceptedApplySuggested =
    applySuggestedDefaults != null ? Boolean(applySuggestedDefaults) : true;
  const acceptedApplyAutomatics =
    applyAutomatics != null ? Boolean(applyAutomatics) : true;

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
  const isDev = isDevolucionMotivo(motivoPago);
  const montoSigned = isDev ? -montoAbs : montoAbs;

  if (isDev && (pagoOrigenId == null || pagoOrigenId === '')) {
    return res.status(400).json({
      error: 'La devolución requiere seleccionar el pago de origen (pagoOrigenId)'
    });
  }

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

  const methodConfig = await resolvePaymentMethodConfig(prisma, {
    paymentMethodConfigId,
    metodo
  });
  const metodoFinal = methodConfig?.label || metodo;
  const billingForced = methodConfig
    ? Boolean(methodConfig.requiereFacturacion)
    : methodRequiresBilling(metodoFinal);
  const wantsBilling = billingForced || Boolean(requiereFacturacion);
  let facturaParsed = null;
  if (wantsBilling) {
    facturaParsed = buildFacturaData(
      { ...(factura && typeof factura === 'object' ? factura : {}), motivo: motivoPago },
      metodoFinal,
      numeroTarjeta,
      req
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

    const fechaPago = parseFechaInput(fecha, req);
    const montoARSAbs = roundMoney(Math.abs(toNumber(montoARS)));

    const nuevoPago = await prisma.$transaction(async (tx) => {
      const account = await ensureReservationAccount(tx, reservaId);
      const financialRefs = dualWriteReservationRefs(account, reservaId);

      let pagoOrigen = null;
      if (isDev) {
        const origenId = parseInt(pagoOrigenId, 10);
        pagoOrigen = await tx.pago.findUnique({ where: { id: origenId } });
        if (!pagoOrigen || pagoOrigen.accountId !== account.id) {
          throw Object.assign(new Error('Pago de origen no encontrado en esta cuenta'), {
            statusCode: 400
          });
        }
        if (isDevolucionMotivo(pagoOrigen.motivo) || toNumber(pagoOrigen.montoARS) <= 0) {
          throw Object.assign(new Error('El pago de origen debe ser un cobro positivo'), {
            statusCode: 400
          });
        }
        const yaDevuelto = await sumDevolucionesOnOrigen(tx, pagoOrigen.id);
        const disponible = roundMoney(toNumber(pagoOrigen.montoARS) - yaDevuelto);
        if (montoARSAbs - disponible > 0.009) {
          throw Object.assign(
            new Error(
              `La devolución supera el saldo disponible del pago origen (máx ${disponible.toFixed(2)} ARS)`
            ),
            { statusCode: 400 }
          );
        }
      }

      const { balance: balanceAntes } = await loadAccountFinancialParts(tx, account.id);
      const codigo = await allocateNextPagoCodigo(tx);
      const pago = await tx.pago.create({
        data: {
          codigo,
          ...financialRefs,
          paymentMethodConfigId: methodConfig?.id ?? null,
          pagoOrigenId: pagoOrigen?.id ?? null,
          monto: new Decimal(montoSigned),
          moneda: monedaFinal,
          tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
          montoARS: montoARS,
          metodo: metodoFinal,
          numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal)
            ? numeroTarjeta
            : null,
          empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal) ? empresa : null,
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
        include: {
          factura: true,
          ...PAGO_ADJUNTO_INCLUDE
        }
      });

      // Flujo A: 100 % a esta reserva
      const imputacion = await tx.pagoImputacion.create({
        data: {
          pagoId: pago.id,
          accountId: account.id,
          reservaId: Number(reservaId),
          montoARS: montoARS,
          bonificacionARS: new Decimal(0),
          ordenIndex: 0
        }
      });

      let da = null;
      if (isDev && pagoOrigen) {
        const origenImp = await tx.pagoImputacion.findFirst({
          where: { pagoId: pagoOrigen.id, accountId: account.id },
          orderBy: { id: 'asc' }
        });
        da = await createReversalDiscount(tx, {
          accountId: account.id,
          devolucionPagoId: pago.id,
          devolucionImputacionId: imputacion.id,
          pagoOrigen,
          pagoOrigenImputacionId: origenImp?.id ?? null,
          devolucionMontoARSAbs: montoARSAbs
        });
      } else if (!isDev) {
        da = await createForwardDiscount(tx, {
          accountId: account.id,
          pagoId: pago.id,
          pagoImputacionId: imputacion.id,
          config: methodConfig,
          motivo: motivoPago,
          dineroARS: montoARSAbs,
          monedaPago: monedaFinal,
          tipoCambio: tipoCambioFinal,
          saldoPendienteAntes: balanceAntes.saldo,
          selectedRuleIds: acceptedRuleIds,
          deselectedRuleIds: acceptedDeselectedRuleIds,
          benefitValueByRuleId: acceptedBenefitValues,
          applySuggestedDefaults: acceptedApplySuggested,
          applyAutomatics: acceptedApplyAutomatics
        });
        if (da) {
          await tx.pagoImputacion.update({
            where: { id: imputacion.id },
            data: { bonificacionARS: da.montoARS }
          });
        }
      }

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

      const { balance } = await loadAccountFinancialParts(tx, account.id);
      await syncAccountStatusFromBalance(tx, account.id, balance.saldo);

      const full = await tx.pago.findUnique({
        where: { id: pago.id },
        include: {
          factura: true,
          discountApplications: true,
          imputaciones: true,
          ...PAGO_ADJUNTO_INCLUDE
        }
      });
      return {
        ...full,
        discountApplication: (full.discountApplications && full.discountApplications[0]) || da || null
      };
    });
    res.status(201).json(nuevoPago);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
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
    notas,
    fecha,
    motivo,
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
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (fecha !== undefined) dataToUpdate.fecha = parseFechaInput(fecha, req);
    if (motivo !== undefined) {
      const motivoNorm = String(motivo || '').trim();
      if (!motivoNorm) {
        return res.status(400).json({ error: 'El motivo no puede estar vacío' });
      }
      dataToUpdate.motivo = motivoNorm;
    }

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

// Eliminar un pago (transaccional: cascade imputaciones + DA; sync todos los folios)
exports.deletePago = async (req, res) => {
  const { id } = req.params;
  try {
    const pagoId = parseInt(id, 10);
    const existing = await prisma.pago.findUnique({
      where: { id: pagoId },
      select: {
        id: true,
        accountId: true,
        imputaciones: { select: { accountId: true } }
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const accountIds = [
      ...new Set(
        [
          existing.accountId,
          ...(existing.imputaciones || []).map((i) => i.accountId)
        ].filter(Boolean)
      )
    ];

    await prisma.pago.delete({ where: { id: pagoId } });

    for (const accountId of accountIds) {
      const { balance } = await loadAccountFinancialParts(prisma, accountId);
      await syncAccountStatusFromBalance(prisma, accountId, balance.saldo);
    }

    res.json({ message: 'Pago eliminado exitosamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'No se puede eliminar: hay devoluciones vinculadas a este pago'
      });
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
    const account = await ensureReservationAccount(prisma, reservaId);
    const cargos = await prisma.cargo.findMany({
      where: { accountId: account.id },
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
  
  const account = await ensureReservationAccount(prisma, reservaId);
  const financialRefs = dualWriteReservationRefs(account, reservaId);

  let cargoData = {
    ...financialRefs,
    descripcion,
    monto: new Decimal(monto),
    notas: notas || null,
    fecha: parseFechaInput(fecha, req)
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

    const { balance } = await loadAccountFinancialParts(prisma, account.id);
    await syncAccountStatusFromBalance(prisma, account.id, balance.saldo);

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
    if (clearOverride !== undefined) {
      return res.status(400).json({
        error: 'El override manual de tarifas fue eliminado; use promociones/descuentos'
      });
    }

    const cargoExistente = await prisma.cargo.findUnique({
      where: { id: parseInt(id, 10) }
    });
    if (!cargoExistente) {
      return res.status(404).json({ error: 'Cargo no encontrado' });
    }

    const isLodging = !cargoExistente.subcategoriaCargoId;
    const dataToUpdate = {};

    if (isLodging) {
      return res.status(400).json({
        error: 'Los cargos de alojamiento no se editan manualmente; se regeneran desde tarifa/promos'
      });
    }
    
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (monto !== undefined) {
      if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      }
      dataToUpdate.monto = new Decimal(monto);
    }
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (fecha !== undefined) dataToUpdate.fecha = parseFechaInput(fecha, req);
    
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
    const account = await ensureReservationAccount(prisma, reservaId);
    const [imputaciones, cargos, discounts, reserva] = await Promise.all([
      prisma.pagoImputacion.findMany({
        where: { accountId: account.id },
        include: IMPUTACION_LIST_INCLUDE,
        orderBy: [{ pago: { fecha: 'desc' } }, { ordenIndex: 'asc' }]
      }),
      prisma.cargo.findMany({
        where: { accountId: account.id },
        include: {
          subcategoriaCargo: true,
          roomType: true,
          serviceType: true
        }
      }),
      prisma.discountApplication.findMany({
        where: { accountId: account.id },
        include: {
          promotionRule: { select: { id: true, code: true, label: true } }
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

    // Folio view: imputaciones → shape “pago” que espera Estado financiero / liquidación
    const pagos = redactFacturaIfNeeded(
      imputaciones.map(imputationToFolioPagoView),
      req.user
    );

    const { totalCargos, totalPagos, totalDescuentos, saldo, estadoPago } = calculateAccountBalance(
      cargos,
      imputaciones,
      discounts
    );

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
      account: {
        id: account.id,
        kind: account.kind,
        status: account.status,
        reservationId: account.reservationId,
        label: account.label
      },
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
        totalDescuentos,
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
      },
      descuentos: {
        total: totalDescuentos,
        cantidad: discounts.length,
        items: discounts
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
    // Compat alias: lista Accounts RESERVATION con forma histórica de “reservas-saldos”.
    const accounts = await prisma.account.findMany({
      where: { kind: 'RESERVATION', reservationId: { not: null } },
      select: {
        id: true,
        kind: true,
        status: true,
        label: true,
        reservationId: true,
        createdAt: true,
        updatedAt: true,
        reservation: {
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
            _count: { select: { guests: true } }
          }
        },
        cargos: { select: { monto: true } },
        imputaciones: {
          select: {
            id: true,
            montoARS: true,
            pago: { select: { id: true, codigo: true, fecha: true } }
          }
        },
        discountApplications: { select: { montoARS: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reservasConSaldos = accounts
      .filter((account) => account.reservation)
      .map((account) => {
        const reserva = account.reservation;
        const { totalCargos, totalPagos, totalDescuentos, saldo, estadoPago } =
          calculateAccountBalance(
            account.cargos,
            account.imputaciones,
            account.discountApplications
          );

        return {
          id: reserva.id,
          accountId: account.id,
          accountKind: account.kind,
          accountStatus: account.status,
          accountLabel: account.label,
          origen: 'RESERVA',
          status: reserva.status,
          mainClient: reserva.mainClient,
          cantidadHuespedes: reserva._count?.guests ?? 0,
          totalCargos,
          totalPagos,
          totalDescuentos,
          saldo,
          estadoPago,
          pagos: (account.imputaciones || [])
            .map((imp) => ({
              id: imp.pago?.id,
              codigo: imp.pago?.codigo,
              montoARS: imp.montoARS,
              fecha: imp.pago?.fecha,
              imputacionId: imp.id
            }))
            .sort((a, b) => (a.id || 0) - (b.id || 0)),
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

/**
 * Flujo B: pago desde ficha cliente con N imputaciones a reservas del titular.
 * Body: monto, metodo, imputaciones[{reservaId|accountId, montoARS, bonificacionARS?}],
 *       autoDistribuir?: bool (reparte a saldos más antiguos; FE debería reenviar montos editados).
 */
exports.createClientMultiPago = async (req, res) => {
  const clientId = parseInt(req.params.clientId || req.params.id, 10);
  const {
    monto,
    moneda,
    tipoCambio,
    metodo,
    paymentMethodConfigId,
    notas,
    motivo,
    fecha,
    requiereFacturacion,
    factura,
    selectedRuleIds,
    promotionRuleIds,
    deselectedRuleIds,
    benefitValueByRuleId,
    applySuggestedDefaults,
    imputaciones: imputacionesBody,
    autoDistribuir
  } = req.body || {};

  const acceptedRuleIds = []
    .concat(selectedRuleIds || [])
    .concat(promotionRuleIds || [])
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isFinite(id));
  const acceptedDeselectedRuleIds = Array.isArray(deselectedRuleIds)
    ? deselectedRuleIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id))
    : [];
  const acceptedBenefitValues =
    benefitValueByRuleId && typeof benefitValueByRuleId === 'object' ? benefitValueByRuleId : {};
  const acceptedApplySuggested =
    applySuggestedDefaults != null ? Boolean(applySuggestedDefaults) : true;

  if (!Number.isFinite(clientId)) {
    return res.status(400).json({ error: 'clientId inválido' });
  }
  if (!monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos requeridos: monto y metodo' });
  }

  const motivoPago = normalizePagoMotivo(motivo ?? DEFAULT_PAGO_MOTIVO);
  if (!motivoPago || isDevolucionMotivo(motivoPago)) {
    return res.status(400).json({
      error: 'Desde cliente solo se admiten cobros (Pago/Seña). Use devolución por reserva.'
    });
  }

  const montoAbs = Math.abs(Number(monto));
  if (!Number.isFinite(montoAbs) || montoAbs <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  if (['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)) {
    if (!req.body.numeroTarjeta || !req.body.empresa) {
      return res.status(400).json({ error: 'Tarjeta: número y empresa requeridos' });
    }
  }

  const monedasValidas = ['ARS', 'USD'];
  const monedaFinal = moneda || 'ARS';
  if (!monedasValidas.includes(monedaFinal)) {
    return res.status(400).json({ error: `Moneda inválida. Debe ser una de: ${monedasValidas.join(', ')}` });
  }

  try {
    const methodConfig = await resolvePaymentMethodConfig(prisma, {
      paymentMethodConfigId,
      metodo
    });
    const metodoFinal = methodConfig?.label || metodo;
    const billingForced = methodConfig
      ? Boolean(methodConfig.requiereFacturacion)
      : methodRequiresBilling(metodoFinal);
    const wantsBilling = billingForced || Boolean(requiereFacturacion);
    let facturaParsed = null;
    if (wantsBilling) {
      facturaParsed = buildFacturaData(
        { ...(factura && typeof factura === 'object' ? factura : {}), motivo: motivoPago },
        metodoFinal,
        req.body.numeroTarjeta,
        req
      );
      if (facturaParsed.error) {
        return res.status(400).json({ error: facturaParsed.error });
      }
    }

    let tipoCambioFinal = tipoCambio;
    if (monedaFinal === 'USD') {
      if (!tipoCambioFinal || tipoCambioFinal <= 0) {
        const configuracion = await prisma.configuracion.findUnique({
          where: { clave: 'tipo_cambio_usd' }
        });
        if (configuracion && configuracion.activo) {
          tipoCambioFinal = parseFloat(configuracion.valor);
        } else {
          return res.status(400).json({
            error:
              'Para pagos en USD, el tipo de cambio es requerido. No se encontró un tipo de cambio global configurado.'
          });
        }
      }
    }

    const montoARS =
      monedaFinal === 'USD'
        ? new Decimal(montoAbs).mul(new Decimal(tipoCambioFinal))
        : new Decimal(montoAbs);
    const montoARSAbs = roundMoney(Math.abs(toNumber(montoARS)));
    const fechaPago = parseFechaInput(fecha, req);

    const clientAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { clientId },
          { kind: 'RESERVATION', reservation: { mainClientId: clientId } }
        ]
      },
      include: {
        reservation: { select: { id: true, createdAt: true, status: true } },
        cargos: { select: { monto: true } },
        imputaciones: { select: { montoARS: true } },
        discountApplications: { select: { montoARS: true } }
      }
    });

    const accountByReserva = new Map();
    const accountById = new Map();
    for (const acc of clientAccounts) {
      accountById.set(acc.id, acc);
      if (acc.reservationId) accountByReserva.set(acc.reservationId, acc);
    }

    let rawImps = Array.isArray(imputacionesBody) ? imputacionesBody : [];
    if (Boolean(autoDistribuir) && rawImps.length === 0) {
      const targets = clientAccounts
        .filter((a) => a.kind === 'RESERVATION' && a.reservation)
        .map((a) => {
          const bal = calculateAccountBalance(
            a.cargos,
            a.imputaciones,
            a.discountApplications
          );
          return {
            accountId: a.id,
            reservaId: a.reservationId,
            saldoPendiente: bal.saldo,
            sortKey: a.reservation.createdAt
          };
        })
        .filter((t) => t.saldoPendiente > 0);
      rawImps = autoDistributeOldestFirst(montoARSAbs, targets);
    }

    // Resolver accountId desde reservaId
    const resolvedRows = [];
    for (const row of rawImps) {
      let accountId = row.accountId != null ? parseInt(row.accountId, 10) : null;
      let reservaId = row.reservaId != null ? parseInt(row.reservaId, 10) : null;
      if (!accountId && reservaId) {
        let acc = accountByReserva.get(reservaId);
        if (!acc) {
          acc = await ensureReservationAccount(prisma, reservaId);
          const full = await prisma.account.findUnique({
            where: { id: acc.id },
            include: { reservation: { select: { mainClientId: true } } }
          });
          if (full?.reservation?.mainClientId !== clientId && full?.clientId !== clientId) {
            return res.status(400).json({
              error: `La reserva ${reservaId} no pertenece al cliente ${clientId}`
            });
          }
          accountId = full.id;
          accountById.set(full.id, full);
          accountByReserva.set(reservaId, full);
        } else {
          accountId = acc.id;
        }
      }
      if (!accountId || !accountById.has(accountId)) {
        return res.status(400).json({
          error: `Imputación sin cuenta válida del cliente (reservaId=${reservaId}, accountId=${accountId})`
        });
      }
      const acc = accountById.get(accountId);
      resolvedRows.push({
        accountId,
        reservaId: reservaId ?? acc.reservationId ?? null,
        montoARS: row.montoARS,
        bonificacionARS: row.bonificacionARS,
        ordenIndex: row.ordenIndex
      });
    }

    // Preview bono total sobre el recibido (contexto: primera cuenta / reglas globales)
    const { previewSettlementDiscount } = require('../utils/paymentMethodService');
    const firstAccountId = resolvedRows[0]?.accountId;
    const { balance: balancePrimero } = firstAccountId
      ? await loadAccountFinancialParts(prisma, firstAccountId)
      : { balance: { saldo: 0 } };
    const preview = await previewSettlementDiscount(prisma, {
      config: methodConfig,
      motivo: motivoPago,
      dineroARS: montoARSAbs,
      saldoPendienteAntes: balancePrimero.saldo,
      accountId: firstAccountId,
      selectedRuleIds: acceptedRuleIds,
      deselectedRuleIds: acceptedDeselectedRuleIds,
      benefitValueByRuleId: acceptedBenefitValues,
      applySuggestedDefaults: acceptedApplySuggested,
      mode: 'received',
      asOfDate: fechaPago,
      moneda: monedaFinal
    });
    const bonoTotal = preview?.aplica ? roundMoney(preview.descuentoARS || 0) : 0;

    let withBono = resolvedRows;
    const hasManualBono = resolvedRows.some((r) => r.bonificacionARS != null && r.bonificacionARS !== '');
    if (!hasManualBono && bonoTotal > 0) {
      withBono = distributeBonificacion(resolvedRows, bonoTotal);
    }

    const normalized = validateImputaciones(withBono, montoARSAbs, {
      bonificacionTotalARS: bonoTotal
    });

    const nuevoPago = await prisma.$transaction(async (tx) => {
      const codigo = await allocateNextPagoCodigo(tx);
      const anchor = normalized.length === 1 ? normalized[0] : null;
      const pago = await tx.pago.create({
        data: {
          codigo,
          accountId: anchor ? anchor.accountId : null,
          reservaId: anchor ? anchor.reservaId : null,
          paymentMethodConfigId: methodConfig?.id ?? null,
          monto: new Decimal(montoAbs),
          moneda: monedaFinal,
          tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
          montoARS,
          metodo: metodoFinal,
          numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal)
            ? req.body.numeroTarjeta
            : null,
          empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal)
            ? req.body.empresa
            : null,
          notas: notas || null,
          motivo: motivoPago,
          fecha: fechaPago,
          requiereFacturacion: wantsBilling,
          ...(wantsBilling ? { factura: { create: facturaParsed.data } } : {})
        }
      });

      const createdImps = [];
      for (const row of normalized) {
        const { balance: balAntes } = await loadAccountFinancialParts(tx, row.accountId);
        const imp = await tx.pagoImputacion.create({
          data: {
            pagoId: pago.id,
            accountId: row.accountId,
            reservaId: row.reservaId,
            montoARS: new Decimal(row.montoARS),
            bonificacionARS: new Decimal(row.bonificacionARS || 0),
            ordenIndex: row.ordenIndex
          }
        });

        let da = null;
        if ((row.bonificacionARS || 0) > 0) {
          da = await createForwardDiscount(tx, {
            accountId: row.accountId,
            pagoId: pago.id,
            pagoImputacionId: imp.id,
            config: methodConfig,
            motivo: motivoPago,
            dineroARS: Math.abs(row.montoARS),
            monedaPago: monedaFinal,
            tipoCambio: tipoCambioFinal,
            saldoPendienteAntes: balAntes.saldo,
            selectedRuleIds: acceptedRuleIds,
            deselectedRuleIds: acceptedDeselectedRuleIds,
            benefitValueByRuleId: acceptedBenefitValues,
            applySuggestedDefaults: acceptedApplySuggested,
            descuentoARSOverride: row.bonificacionARS
          });
        }

        const { balance } = await loadAccountFinancialParts(tx, row.accountId);
        await syncAccountStatusFromBalance(tx, row.accountId, balance.saldo);
        createdImps.push({ ...imp, discountApplication: da });
      }

      if (wantsBilling) {
        await tx.clientBillingProfile.upsert(
          buildBillingProfileUpsert(clientId, facturaParsed.data)
        );
      }

      return tx.pago.findUnique({
        where: { id: pago.id },
        include: {
          factura: true,
          discountApplications: true,
          imputaciones: { include: { discountApplications: true } },
          ...PAGO_ADJUNTO_INCLUDE
        }
      });
    });

    res.status(201).json({
      ...nuevoPago,
      discountApplication:
        (nuevoPago.discountApplications && nuevoPago.discountApplications[0]) || null
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creando pago multi-cliente:', error);
    res.status(500).json({ error: 'Error al crear el pago', details: error.message });
  }
};

