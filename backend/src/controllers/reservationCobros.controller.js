const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { calculateReservationBalance } = require('../utils/reservationBalance');
const { calculateAccountBalance } = require('../utils/accountBalance');
const { allocateNextCobroCodigo } = require('../utils/cobroCodigo');
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
  DEFAULT_COBRO_MOTIVO,
  methodRequiresBilling,
  isCardMethod,
  isPersonInvoiceType,
  isDevolucionMotivo,
  normalizeCobroMotivo
} = require('../utils/billingConstants');
const {
  resolvePaymentMethodConfig,
  loadAccountFinancialParts,
  createForwardDiscount,
  createReversalDiscount,
  sumDevolucionesOnOrigen
} = require('../utils/paymentMethodService');
const { toNumber, roundMoney } = require('../utils/paymentDiscount');
const { resolveCashTender } = require('../utils/cashTender');
const {
  validateImputaciones,
  autoDistributeOldestFirst,
  distributeBonificacion,
  IMPUTACION_LIST_INCLUDE,
  imputationToFolioCobroView
} = require('../utils/cobroImputacion');
const {
  ADJUNTO_TIPOS,
  assertAdjuntoTipo,
  assertMimeForTipo,
  saveUploadedFile,
  absolutePath,
  deleteStoredFile,
  toPublicAdjunto
} = require('../utils/cobroAdjuntos');


function canSeeFacturacion(user) {
  return roleHasPermission(user?.role, 'facturacion');
}

/** Datos de CobroFactura solo para admin; el resto recibe factura: null. */
function redactFacturaIfNeeded(cobros, user) {
  if (canSeeFacturacion(user)) return cobros;
  return (cobros || []).map((cobro) => ({ ...cobro, factura: null }));
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

function buildFacturaData(facturaInput, metodo, numeroTarjetaCobro, req) {
  if (!facturaInput || typeof facturaInput !== 'object') {
    return { error: 'Datos de facturación requeridos' };
  }

  const tipo = String(facturaInput.tipo || '').toUpperCase();
  if (!INVOICE_TYPES.includes(tipo)) {
    return { error: 'Tipo de factura inválido. Debe ser A, B o T' };
  }

  const fecha = parseFechaInput(facturaInput.fecha, req);
  if (Number.isNaN(fecha.getTime())) {
    return { error: 'Fecha de factura inválida' };
  }

  const cardFromPayment = isCardMethod(metodo)
    ? normalizeOptionalString(numeroTarjetaCobro)
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

  if (isPersonInvoiceType(tipo)) {
    const passportCountry = normalizeOptionalString(
      facturaInput.passportCountry ||
        facturaInput.paisEmisorPasaporte ||
        facturaInput.paisPasaporte
    );
    if (tipo === 'T' && !passportCountry) {
      return { error: 'El país emisor del pasaporte es requerido para Factura T' };
    }
    const address = normalizeOptionalString(facturaInput.address || facturaInput.domicilio);
    if (!address) {
      return {
        error: `El domicilio es requerido para Factura ${tipo}`
      };
    }
    return {
      data: {
        ...base,
        firstName: normalizeOptionalString(facturaInput.firstName || facturaInput.nombre),
        lastName: normalizeOptionalString(facturaInput.lastName || facturaInput.apellido),
        documentType:
          normalizeOptionalString(facturaInput.documentType || facturaInput.tipoDocumento) ||
          (tipo === 'T' ? 'Pasaporte' : 'DNI'),
        documentNumber: normalizeOptionalString(
          facturaInput.documentNumber || facturaInput.numeroDocumento
        ),
        passportCountry: tipo === 'T' ? passportCountry : null,
        address,
        businessName: null,
        cuit: null,
        commercialAddress: null,
        ivaCondition: null
      }
    };
  }

  const commercialAddress = normalizeOptionalString(
    facturaInput.commercialAddress || facturaInput.domicilioComercial
  );
  if (!commercialAddress) {
    return { error: 'El domicilio comercial es requerido para Factura A' };
  }

  return {
    data: {
      ...base,
      firstName: null,
      lastName: null,
      documentType: null,
      documentNumber: null,
      passportCountry: null,
      address: null,
      businessName: normalizeOptionalString(facturaInput.businessName || facturaInput.razonSocial),
      cuit: normalizeOptionalString(facturaInput.cuit),
      commercialAddress,
      ivaCondition:
        normalizeOptionalString(facturaInput.ivaCondition || facturaInput.condicionIva) ||
        DEFAULT_IVA_CONDITION
    }
  };
}

function buildBillingProfileUpsert(clientId, facturaData) {
  const isPerson = isPersonInvoiceType(facturaData.tipo);
  return {
    where: { clientId },
    create: {
      clientId,
      lastInvoiceType: facturaData.tipo,
      firstName: isPerson ? facturaData.firstName : undefined,
      lastName: isPerson ? facturaData.lastName : undefined,
      documentType: isPerson ? facturaData.documentType : undefined,
      documentNumber: isPerson ? facturaData.documentNumber : undefined,
      passportCountry: isPerson ? facturaData.passportCountry : undefined,
      address: isPerson ? facturaData.address : undefined,
      email: facturaData.email,
      businessName: !isPerson ? facturaData.businessName : undefined,
      cuit: !isPerson ? facturaData.cuit : undefined,
      commercialAddress: !isPerson ? facturaData.commercialAddress : undefined,
      ivaCondition: !isPerson ? facturaData.ivaCondition : DEFAULT_IVA_CONDITION,
      cardNumber: facturaData.cardNumber
    },
    update: {
      lastInvoiceType: facturaData.tipo,
      email: facturaData.email,
      cardNumber: facturaData.cardNumber,
      ...(isPerson
        ? {
            firstName: facturaData.firstName,
            lastName: facturaData.lastName,
            documentType: facturaData.documentType,
            documentNumber: facturaData.documentNumber,
            passportCountry: facturaData.passportCountry,
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

// Obtener historial global de cobros (con reserva y cliente)
const COBRO_CLIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true
};

const COBRO_RESERVA_SELECT = {
  id: true,
  status: true,
  source: true,
  mainClient: { select: COBRO_CLIENT_SELECT }
};

/** Include para listados de caja / Estado de cuentas (single + multi-imputación). */
const COBRO_LIST_INCLUDE = {
  factura: true,
  ...PAGO_ADJUNTO_INCLUDE,
  reserva: { select: COBRO_RESERVA_SELECT },
  account: {
    select: {
      id: true,
      kind: true,
      label: true,
      clientId: true,
      client: { select: COBRO_CLIENT_SELECT }
    }
  },
  imputaciones: {
    orderBy: { ordenIndex: 'asc' },
    include: {
      reserva: { select: COBRO_RESERVA_SELECT },
      account: {
        select: {
          id: true,
          kind: true,
          label: true,
          clientId: true,
          client: { select: COBRO_CLIENT_SELECT },
          reservation: { select: COBRO_RESERVA_SELECT }
        }
      }
    }
  }
};

exports.getAllCobros = async (req, res) => {
  try {
    const cobros = await prisma.cobro.findMany({
      include: COBRO_LIST_INCLUDE,
      orderBy: { fecha: 'desc' },
    });
    res.json(redactFacturaIfNeeded(cobros, req.user));
  } catch (error) {
    console.error('Error obteniendo historial de cobros:', error);
    res.status(500).json({ error: 'Error al obtener el historial de cobros', details: error.message });
  }
};

// Obtener cobros/imputaciones de una reserva (crédito de folio, no caja completa si multi)
exports.getCobrosByReserva = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const account = await ensureReservationAccount(prisma, reservaId);
    const imputaciones = await prisma.cobroImputacion.findMany({
      where: { accountId: account.id },
      include: IMPUTACION_LIST_INCLUDE,
      orderBy: [{ cobro: { fecha: 'desc' } }, { ordenIndex: 'asc' }]
    });
    const views = imputaciones.map(imputationToFolioCobroView);
    res.json(redactFacturaIfNeeded(views, req.user));
  } catch (error) {
    console.error('Error obteniendo cobros:', error);
    res.status(500).json({ error: 'Error al obtener los cobros', details: error.message });
  }
};

// Crear un nuevo cobro para una reserva
exports.createCobro = async (req, res) => {
  const { reservaId } = req.params;
  const {
    monto,
    moneda,
    tipoCambio,
    metodo,
    paymentMethodConfigId,
    cobroOrigenId,
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
    fecha,
    dineroRecibido,
    vueltoARS
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

  const motivoCobro = normalizeCobroMotivo(motivo ?? DEFAULT_COBRO_MOTIVO);
  if (!motivoCobro) {
    return res.status(400).json({ error: 'Motivo inválido. Debe ser Cobro, Seña o Devolución' });
  }

  const montoAbs = Math.abs(Number(monto));
  if (!Number.isFinite(montoAbs) || montoAbs <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }
  // Devolución reduce el saldo pagado de la reserva (monto/montoARS negativos).
  const isDev = isDevolucionMotivo(motivoCobro);
  const montoSigned = isDev ? -montoAbs : montoAbs;

  if (isDev && (cobroOrigenId == null || cobroOrigenId === '')) {
    return res.status(400).json({
      error: 'La devolución requiere seleccionar el cobro de origen (cobroOrigenId)'
    });
  }

  // Validar campos de tarjeta si el método es Tarjeta Debito o Credito
  if (['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)) {
    if (!numeroTarjeta) {
      return res.status(400).json({ error: 'El número de tarjeta es requerido para cobros con tarjeta' });
    }
    if (!empresa) {
      return res.status(400).json({ error: 'La empresa de la tarjeta es requerida para cobros con tarjeta' });
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
      { ...(factura && typeof factura === 'object' ? factura : {}), motivo: motivoCobro },
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
            error: 'Para cobros en USD, el tipo de cambio es requerido. No se encontró un tipo de cambio global configurado.' 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          error: 'Para cobros en USD, el tipo de cambio es requerido y debe ser mayor a 0' 
        });
      }
    }
  }

  try {
    const tender = resolveCashTender({
      metodo: metodoFinal,
      monto: montoAbs,
      moneda: monedaFinal,
      tipoCambio: tipoCambioFinal,
      dineroRecibido,
      vueltoARS,
      isDevolucion: isDev
    });
    if (!tender.ok) {
      return res.status(400).json({ error: tender.error });
    }

    // Acreditación = monto ingresado (crédito vía subir ingresado, no vía vuelto 0).
    const montoSignedFinal = isDev ? -tender.montoAbs : tender.montoAbs;
    const montoARS = new Decimal(isDev ? -tender.montoARSAbs : tender.montoARSAbs);
    const fechaCobro = parseFechaInput(fecha, req);
    const montoARSAbs = tender.montoARSAbs;

    const nuevoCobro = await prisma.$transaction(async (tx) => {
      const account = await ensureReservationAccount(tx, reservaId);
      const financialRefs = dualWriteReservationRefs(account, reservaId);

      let cobroOrigen = null;
      if (isDev) {
        const origenId = parseInt(cobroOrigenId, 10);
        cobroOrigen = await tx.cobro.findUnique({ where: { id: origenId } });
        if (!cobroOrigen || cobroOrigen.accountId !== account.id) {
          throw Object.assign(new Error('Cobro de origen no encontrado en esta cuenta'), {
            statusCode: 400
          });
        }
        if (isDevolucionMotivo(cobroOrigen.motivo) || toNumber(cobroOrigen.montoARS) <= 0) {
          throw Object.assign(new Error('El cobro de origen debe ser un cobro positivo'), {
            statusCode: 400
          });
        }
        const yaDevuelto = await sumDevolucionesOnOrigen(tx, cobroOrigen.id);
        const disponible = roundMoney(toNumber(cobroOrigen.montoARS) - yaDevuelto);
        if (montoARSAbs - disponible > 0.009) {
          throw Object.assign(
            new Error(
              `La devolución supera el saldo disponible del cobro origen (máx ${disponible.toFixed(2)} ARS)`
            ),
            { statusCode: 400 }
          );
        }
      }

      const { balance: balanceAntes } = await loadAccountFinancialParts(tx, account.id);
      const codigo = await allocateNextCobroCodigo(tx);
      const cobro = await tx.cobro.create({
        data: {
          codigo,
          ...financialRefs,
          paymentMethodConfigId: methodConfig?.id ?? null,
          cobroOrigenId: cobroOrigen?.id ?? null,
          monto: new Decimal(montoSignedFinal),
          moneda: monedaFinal,
          tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
          montoARS: montoARS,
          dineroRecibido: new Decimal(tender.dineroRecibido),
          vueltoARS: new Decimal(tender.vueltoARS),
          metodo: metodoFinal,
          numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal)
            ? numeroTarjeta
            : null,
          empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal) ? empresa : null,
          motivo: motivoCobro,
          fecha: fechaCobro,
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
      const imputacion = await tx.cobroImputacion.create({
        data: {
          cobroId: cobro.id,
          accountId: account.id,
          reservaId: Number(reservaId),
          montoARS: montoARS,
          bonificacionARS: new Decimal(0),
          ordenIndex: 0
        }
      });

      let da = null;
      if (isDev && cobroOrigen) {
        const origenImp = await tx.cobroImputacion.findFirst({
          where: { cobroId: cobroOrigen.id, accountId: account.id },
          orderBy: { id: 'asc' }
        });
        da = await createReversalDiscount(tx, {
          accountId: account.id,
          devolucionCobroId: cobro.id,
          devolucionImputacionId: imputacion.id,
          cobroOrigen,
          cobroOrigenImputacionId: origenImp?.id ?? null,
          devolucionMontoARSAbs: montoARSAbs
        });
      } else if (!isDev) {
        da = await createForwardDiscount(tx, {
          accountId: account.id,
          cobroId: cobro.id,
          cobroImputacionId: imputacion.id,
          config: methodConfig,
          motivo: motivoCobro,
          dineroARS: montoARSAbs,
          monedaCobro: monedaFinal,
          tipoCambio: tipoCambioFinal,
          saldoPendienteAntes: balanceAntes.saldo,
          selectedRuleIds: acceptedRuleIds,
          deselectedRuleIds: acceptedDeselectedRuleIds,
          benefitValueByRuleId: acceptedBenefitValues,
          applySuggestedDefaults: acceptedApplySuggested,
          applyAutomatics: acceptedApplyAutomatics
        });
        if (da) {
          await tx.cobroImputacion.update({
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

      const full = await tx.cobro.findUnique({
        where: { id: cobro.id },
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
    res.status(201).json(nuevoCobro);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creando cobro:', error);
    res.status(500).json({ error: 'Error al crear el cobro', details: error.message });
  }
};

// Actualizar un cobro existente (recalcula DiscountApplication si cambian monto/método/etc.)
exports.updateCobro = async (req, res) => {
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
    retirado,
    paymentMethodConfigId,
    selectedRuleIds,
    promotionRuleIds,
    deselectedRuleIds,
    benefitValueByRuleId,
    applySuggestedDefaults,
    applyAutomatics,
    dineroRecibido,
    vueltoARS
  } = req.body;

  try {
    const cobroId = parseInt(id, 10);
    const pagoActual = await prisma.cobro.findUnique({
      where: { id: cobroId },
      include: {
        imputaciones: { orderBy: { ordenIndex: 'asc' } },
        discountApplications: {
          include: { reversiones: { select: { id: true } } }
        }
      }
    });

    if (!pagoActual) {
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }

    if (isDevolucionMotivo(pagoActual.motivo)) {
      return res.status(400).json({
        error: 'No se puede editar una devolución desde este flujo'
      });
    }

    const dataToUpdate = {};

    if (moneda !== undefined) {
      const monedasValidas = ['ARS', 'USD'];
      if (!monedasValidas.includes(moneda)) {
        return res.status(400).json({
          error: `Moneda inválida. Debe ser una de: ${monedasValidas.join(', ')}`
        });
      }
      dataToUpdate.moneda = moneda;
    }

    if (tipoCambio !== undefined) {
      if (tipoCambio <= 0) {
        return res.status(400).json({ error: 'El tipo de cambio debe ser mayor a 0' });
      }
      dataToUpdate.tipoCambio = new Decimal(tipoCambio);
    }

    if (monto !== undefined) {
      if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      }
      dataToUpdate.monto = new Decimal(monto);
    }

    if (metodo !== undefined && ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)) {
      if (!numeroTarjeta) {
        return res.status(400).json({ error: 'El número de tarjeta es requerido para cobros con tarjeta' });
      }
      if (!empresa) {
        return res.status(400).json({ error: 'La empresa de la tarjeta es requerida para cobros con tarjeta' });
      }
    }

    const monedaFinal = moneda !== undefined ? moneda : pagoActual.moneda;
    const montoFinal = monto !== undefined ? monto : parseFloat(pagoActual.monto);
    const tipoCambioFinal =
      tipoCambio !== undefined
        ? tipoCambio
        : pagoActual.tipoCambio
          ? parseFloat(pagoActual.tipoCambio)
          : null;

    if (monedaFinal === 'USD' && !tipoCambioFinal) {
      return res.status(400).json({
        error: 'Para cobros en USD, el tipo de cambio es requerido'
      });
    }

    const metodoFinal = metodo !== undefined ? metodo : pagoActual.metodo;
    const tenderEdit = resolveCashTender({
      metodo: metodoFinal,
      monto: Math.abs(Number(montoFinal)),
      moneda: monedaFinal,
      tipoCambio: tipoCambioFinal,
      dineroRecibido:
        dineroRecibido !== undefined
          ? dineroRecibido
          : pagoActual.dineroRecibido != null
            ? toNumber(pagoActual.dineroRecibido)
            : undefined,
      vueltoARS:
        vueltoARS !== undefined
          ? vueltoARS
          : pagoActual.vueltoARS != null
            ? toNumber(pagoActual.vueltoARS)
            : 0,
      isDevolucion: false
    });
    if (!tenderEdit.ok) {
      return res.status(400).json({ error: tenderEdit.error });
    }

    let montoARSFinal = toNumber(pagoActual.montoARS);
    const tenderTouched =
      monto !== undefined ||
      moneda !== undefined ||
      tipoCambio !== undefined ||
      metodo !== undefined ||
      dineroRecibido !== undefined ||
      vueltoARS !== undefined;
    if (tenderTouched) {
      dataToUpdate.monto = new Decimal(tenderEdit.montoAbs);
      montoARSFinal = tenderEdit.montoARSAbs;
      dataToUpdate.montoARS = new Decimal(montoARSFinal);
      dataToUpdate.dineroRecibido = new Decimal(tenderEdit.dineroRecibido);
      dataToUpdate.vueltoARS = new Decimal(tenderEdit.vueltoARS);
      if (monedaFinal === 'USD') {
        dataToUpdate.tipoCambio = new Decimal(tipoCambioFinal);
      } else if (moneda !== undefined) {
        dataToUpdate.tipoCambio = null;
      }
    }
    if (metodo !== undefined) dataToUpdate.metodo = metodo;
    if (numeroTarjeta !== undefined) dataToUpdate.numeroTarjeta = numeroTarjeta;
    if (empresa !== undefined) dataToUpdate.empresa = empresa;
    if (fecha !== undefined) dataToUpdate.fecha = parseFechaInput(fecha, req);

    let motivoFinal = pagoActual.motivo;
    if (motivo !== undefined) {
      const motivoNorm = normalizeCobroMotivo(motivo);
      if (!motivoNorm) {
        return res.status(400).json({
          error: 'Motivo inválido. Debe ser Cobro, Seña o Devolución'
        });
      }
      if (isDevolucionMotivo(motivoNorm)) {
        return res.status(400).json({
          error: 'No se puede convertir un cobro en devolución desde la edición'
        });
      }
      motivoFinal = motivoNorm;
      dataToUpdate.motivo = motivoNorm;
    }

    if (retirado !== undefined) {
      if (isTransferencia(metodoFinal)) {
        return res.status(400).json({
          error: 'Retirado no aplica a cobros por Transferencia'
        });
      }
      dataToUpdate.retirado = Boolean(retirado);
    }

    const methodConfig = await resolvePaymentMethodConfig(prisma, {
      paymentMethodConfigId:
        paymentMethodConfigId !== undefined
          ? paymentMethodConfigId
          : pagoActual.paymentMethodConfigId,
      metodo: metodoFinal
    });
    if (methodConfig?.id != null) {
      dataToUpdate.paymentMethodConfigId = methodConfig.id;
    } else if (paymentMethodConfigId === null || metodo !== undefined) {
      dataToUpdate.paymentMethodConfigId = null;
    }

    const forwardDas = (pagoActual.discountApplications || []).filter(
      (d) => d.tipo !== 'REVERSAL' && toNumber(d.montoARS) > 0
    );
    if (forwardDas.some((d) => (d.reversiones || []).length > 0)) {
      return res.status(400).json({
        error:
          'Este cobro tiene devoluciones que revirtieron el descuento; no se puede editar el monto/método sin anular esas devoluciones'
      });
    }

    const bodySelected = []
      .concat(selectedRuleIds || [])
      .concat(promotionRuleIds || [])
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n));
    const acceptedDeselected = Array.isArray(deselectedRuleIds)
      ? deselectedRuleIds.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n))
      : [];
    const acceptedBenefitValues =
      benefitValueByRuleId && typeof benefitValueByRuleId === 'object'
        ? benefitValueByRuleId
        : {};
    const acceptedApplySuggested =
      applySuggestedDefaults == null ? true : Boolean(applySuggestedDefaults);
    const acceptedApplyAutomatics =
      applyAutomatics == null ? true : Boolean(applyAutomatics);

    // Si el FE no manda selección, reusa las reglas del snapshot previo.
    let acceptedRuleIds = bodySelected;
    if (!acceptedRuleIds.length && forwardDas.length) {
      const fromSnapshot = new Set();
      for (const da of forwardDas) {
        const snap = da.appliedRulesJson;
        if (Array.isArray(snap)) {
          for (const r of snap) {
            const rid = r?.promotionRuleId ?? r?.id;
            if (rid != null && Number.isFinite(Number(rid))) fromSnapshot.add(Number(rid));
          }
        } else if (da.promotionRuleId != null) {
          fromSnapshot.add(Number(da.promotionRuleId));
        }
      }
      acceptedRuleIds = Array.from(fromSnapshot);
    }

    const oldMontoARS = toNumber(pagoActual.montoARS);
    const imputaciones = pagoActual.imputaciones || [];

    const pagoActualizado = await prisma.$transaction(async (tx) => {
      await tx.cobro.update({
        where: { id: cobroId },
        data: dataToUpdate
      });

      // Sincronizar montos de imputación al nuevo total (prorrateo si multi).
      if (imputaciones.length === 1) {
        await tx.cobroImputacion.update({
          where: { id: imputaciones[0].id },
          data: {
            montoARS: new Decimal(montoARSFinal),
            bonificacionARS: new Decimal(0)
          }
        });
      } else if (imputaciones.length > 1 && oldMontoARS > 0) {
        const factor = montoARSFinal / oldMontoARS;
        let assigned = 0;
        for (let i = 0; i < imputaciones.length; i += 1) {
          const imp = imputaciones[i];
          const next =
            i === imputaciones.length - 1
              ? roundMoney(montoARSFinal - assigned)
              : roundMoney(toNumber(imp.montoARS) * factor);
          assigned = roundMoney(assigned + next);
          await tx.cobroImputacion.update({
            where: { id: imp.id },
            data: {
              montoARS: new Decimal(next),
              bonificacionARS: new Decimal(0)
            }
          });
        }
      } else if (imputaciones.length > 1) {
        for (const imp of imputaciones) {
          await tx.cobroImputacion.update({
            where: { id: imp.id },
            data: { bonificacionARS: new Decimal(0) }
          });
        }
      }

      if (forwardDas.length) {
        await tx.discountApplication.deleteMany({
          where: { id: { in: forwardDas.map((d) => d.id) } }
        });
      }

      const refreshedImps = await tx.cobroImputacion.findMany({
        where: { cobroId },
        orderBy: { ordenIndex: 'asc' }
      });

      // Recalcular DA por imputación (mismo criterio que create).
      for (const imp of refreshedImps) {
        const dineroImp = Math.abs(toNumber(imp.montoARS));
        if (dineroImp <= 0) continue;
        const { balance: balanceAntes } = await loadAccountFinancialParts(tx, imp.accountId);
        // El cobro ya está actualizado: restar este crédito de caja del saldo para
        // no contar dos veces el dinero de esta fila al estimar deuda previa.
        const saldoAntes = roundMoney(balanceAntes.saldo + dineroImp);
        const da = await createForwardDiscount(tx, {
          accountId: imp.accountId,
          cobroId,
          cobroImputacionId: imp.id,
          config: methodConfig,
          motivo: motivoFinal,
          dineroARS: dineroImp,
          monedaCobro: monedaFinal,
          tipoCambio: tipoCambioFinal,
          saldoPendienteAntes: saldoAntes,
          selectedRuleIds: acceptedRuleIds,
          deselectedRuleIds: acceptedDeselected,
          benefitValueByRuleId: acceptedBenefitValues,
          applySuggestedDefaults: acceptedApplySuggested,
          applyAutomatics: acceptedApplyAutomatics
        });
        if (da) {
          await tx.cobroImputacion.update({
            where: { id: imp.id },
            data: { bonificacionARS: da.montoARS }
          });
        }
      }

      const accountIds = [
        ...new Set(refreshedImps.map((i) => i.accountId).filter(Boolean))
      ];
      if (pagoActual.accountId && !accountIds.includes(pagoActual.accountId)) {
        accountIds.push(pagoActual.accountId);
      }
      for (const accountId of accountIds) {
        const { balance } = await loadAccountFinancialParts(tx, accountId);
        await syncAccountStatusFromBalance(tx, accountId, balance.saldo);
      }

      return tx.cobro.findUnique({
        where: { id: cobroId },
        include: {
          factura: true,
          discountApplications: true,
          imputaciones: true,
          ...PAGO_ADJUNTO_INCLUDE
        }
      });
    });

    res.json(pagoActualizado);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error actualizando cobro:', error);
    res.status(500).json({ error: 'Error al actualizar el cobro', details: error.message });
  }
};

// Eliminar un cobro (transaccional: cascade imputaciones + DA; sync todos los folios)
exports.deleteCobro = async (req, res) => {
  const { id } = req.params;
  try {
    const cobroId = parseInt(id, 10);
    const existing = await prisma.cobro.findUnique({
      where: { id: cobroId },
      select: {
        id: true,
        accountId: true,
        imputaciones: { select: { accountId: true } }
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }

    const accountIds = [
      ...new Set(
        [
          existing.accountId,
          ...(existing.imputaciones || []).map((i) => i.accountId)
        ].filter(Boolean)
      )
    ];

    await prisma.cobro.delete({ where: { id: cobroId } });

    for (const accountId of accountIds) {
      const { balance } = await loadAccountFinancialParts(prisma, accountId);
      await syncAccountStatusFromBalance(prisma, accountId, balance.saldo);
    }

    res.json({ message: 'Cobro eliminado exitosamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'No se puede eliminar: hay devoluciones vinculadas a este cobro'
      });
    }
    console.error('Error eliminando cobro:', error);
    res.status(500).json({ error: 'Error al eliminar el cobro', details: error.message });
  }
};

// ============================================
// ADJUNTOS DE FACTURA / COMPROBANTE
// ============================================

exports.uploadCobroAdjuntos = async (req, res) => {
  const cobroId = parseInt(req.params.id, 10);
  const tipoResult = assertAdjuntoTipo(req.params.tipo || req.body?.tipo);
  if (tipoResult.error) {
    return res.status(400).json({ error: tipoResult.error });
  }
  const tipo = tipoResult.tipo;

  try {
    const cobro = await prisma.cobro.findUnique({ where: { id: cobroId } });
    if (!cobro) {
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }

    if (tipo === ADJUNTO_TIPOS.FACTURA && !cobro.requiereFacturacion) {
      return res.status(400).json({
        error: 'Este cobro no requiere facturación'
      });
    }
    if (tipo === ADJUNTO_TIPOS.COMPROBANTE && !isTransferencia(cobro.metodo)) {
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
          deleteStoredFile(cobroId, row.storedName);
        }
        return res.status(400).json({ error: mimeCheck.error });
      }
      const saved = saveUploadedFile(cobroId, file, tipo);
      const row = await prisma.cobroAdjunto.create({
        data: {
          cobroId,
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
    console.error('Error subiendo adjuntos de cobro:', error);
    res.status(500).json({ error: 'Error al subir adjuntos', details: error.message });
  }
};

exports.downloadCobroAdjunto = async (req, res) => {
  const cobroId = parseInt(req.params.id, 10);
  const adjuntoId = parseInt(req.params.adjuntoId, 10);

  try {
    const adjunto = await prisma.cobroAdjunto.findFirst({
      where: { id: adjuntoId, cobroId }
    });
    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    const filePath = absolutePath(cobroId, adjunto.storedName);
    res.download(filePath, adjunto.originalName, (err) => {
      if (err && !res.headersSent) {
        console.error('Error descargando adjunto:', err);
        res.status(404).json({ error: 'Archivo no encontrado en disco' });
      }
    });
  } catch (error) {
    console.error('Error descargando adjunto de cobro:', error);
    res.status(500).json({ error: 'Error al descargar adjunto', details: error.message });
  }
};

exports.deleteCobroAdjunto = async (req, res) => {
  const cobroId = parseInt(req.params.id, 10);
  const adjuntoId = parseInt(req.params.adjuntoId, 10);

  try {
    const adjunto = await prisma.cobroAdjunto.findFirst({
      where: { id: adjuntoId, cobroId }
    });
    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    if (adjunto.tipo === ADJUNTO_TIPOS.FACTURA && !canSeeFacturacion(req.user)) {
      return res.status(403).json({ error: 'No autorizado a eliminar comprobantes de facturación' });
    }

    await prisma.cobroAdjunto.delete({ where: { id: adjunto.id } });
    deleteStoredFile(cobroId, adjunto.storedName);

    res.json({ ok: true, id: adjunto.id });
  } catch (error) {
    console.error('Error eliminando adjunto de cobro:', error);
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

// Obtener resumen financiero de una reserva (total cargos, total cobros, saldo)
exports.getResumenFinanciero = async (req, res) => {
  const { reservaId } = req.params;
  
  try {
    const account = await ensureReservationAccount(prisma, reservaId);
    const [imputaciones, cargos, discounts, reserva] = await Promise.all([
      prisma.cobroImputacion.findMany({
        where: { accountId: account.id },
        include: IMPUTACION_LIST_INCLUDE,
        orderBy: [{ cobro: { fecha: 'desc' } }, { ordenIndex: 'asc' }]
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

    // Folio view: imputaciones → shape “cobro” que espera Estado financiero / liquidación
    const cobros = redactFacturaIfNeeded(
      imputaciones.map(imputationToFolioCobroView),
      req.user
    );

    const { totalCargos, totalCobros, totalDescuentos, saldo, estadoCobro } = calculateAccountBalance(
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

    // Agrupar cobros por método
    const cobrosPorMetodo = cobros.reduce((acc, cobro) => {
      const metodo = cobro.metodo;
      if (!acc[metodo]) {
        acc[metodo] = {
          cantidad: 0,
          total: 0,
          items: []
        };
      }
      acc[metodo].cantidad++;
      acc[metodo].total += parseFloat(cobro.montoARS);
      acc[metodo].items.push(cobro);
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
        totalCobros,
        totalDescuentos,
        saldo,
        estadoCobro
      },
      cargos: {
        total: totalCargos,
        cantidad: cargos.length,
        porTipo: cargosPorTipo,
        items: cargos
      },
      cobros: {
        total: totalCobros,
        cantidad: cobros.length,
        porMetodo: cobrosPorMetodo,
        items: cobros
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

// Obtener el tipo de cambio actual para nuevos cobros
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
 * Opciones para el Select del modal Nuevo cobro / devolución.
 * Incluye reservas activas (no canceladas / no-show), con o sin estadía hoy —
 * p.ej. señas sobre reservas futuras. No reusa occupied-rooms (solo día civil).
 */
exports.getReservasParaCobro = async (req, res) => {
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
    console.error('Error listando reservas para cobro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar reservas para cobro',
      details: error.message
    });
  }
};

// Obtener listado de todas las reservas con sus saldos.
// Solo pedimos campos necesarios para el cálculo/UI: un include anidado
// (subcategoria/roomType/serviceType/guests) hacía fallar toda la página
// ante desfase schema↔DB (p.ej. columnas nuevas en Cobro/Cargo).
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
            source: true,
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
            cobro: { select: { id: true, codigo: true, fecha: true } }
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
        const { totalCargos, totalCobros, totalDescuentos, saldo, estadoCobro } =
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
          source: reserva.source || null,
          mainClient: reserva.mainClient,
          cantidadHuespedes: reserva._count?.guests ?? 0,
          totalCargos,
          totalCobros,
          totalDescuentos,
          saldo,
          estadoCobro,
          cobros: (account.imputaciones || [])
            .map((imp) => ({
              id: imp.cobro?.id,
              codigo: imp.cobro?.codigo,
              montoARS: imp.montoARS,
              fecha: imp.cobro?.fecha,
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
 * Flujo B: cobro desde ficha cliente con N imputaciones a reservas del titular.
 * Body: monto, metodo, imputaciones[{reservaId|accountId, montoARS, bonificacionARS?}],
 *       autoDistribuir?: bool (reparte a saldos más antiguos; FE debería reenviar montos editados).
 */
exports.createClientMultiCobro = async (req, res) => {
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
    autoDistribuir,
    dineroRecibido,
    vueltoARS
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

  const motivoCobro = normalizeCobroMotivo(motivo ?? DEFAULT_COBRO_MOTIVO);
  if (!motivoCobro || isDevolucionMotivo(motivoCobro)) {
    return res.status(400).json({
      error: 'Desde cliente solo se admiten cobros (Cobro/Seña). Use devolución por reserva.'
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
        { ...(factura && typeof factura === 'object' ? factura : {}), motivo: motivoCobro },
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
              'Para cobros en USD, el tipo de cambio es requerido. No se encontró un tipo de cambio global configurado.'
          });
        }
      }
    }

    const tender = resolveCashTender({
      metodo: metodoFinal,
      monto: montoAbs,
      moneda: monedaFinal,
      tipoCambio: tipoCambioFinal,
      dineroRecibido,
      vueltoARS,
      isDevolucion: false
    });
    if (!tender.ok) {
      return res.status(400).json({ error: tender.error });
    }

    const montoAbsFinal = tender.montoAbs;
    const montoARS = new Decimal(tender.montoARSAbs);
    const montoARSAbs = tender.montoARSAbs;
    const fechaCobro = parseFechaInput(fecha, req);

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
      motivo: motivoCobro,
      dineroARS: montoARSAbs,
      saldoPendienteAntes: balancePrimero.saldo,
      accountId: firstAccountId,
      selectedRuleIds: acceptedRuleIds,
      deselectedRuleIds: acceptedDeselectedRuleIds,
      benefitValueByRuleId: acceptedBenefitValues,
      applySuggestedDefaults: acceptedApplySuggested,
      mode: 'received',
      asOfDate: fechaCobro,
      moneda: monedaFinal
    });
    const bonoTotal = preview?.aplica ? roundMoney(preview.descuentoARS || 0) : 0;

    // Crédito = monto ingresado ya incluye el excedente; no hay bump por vuelto 0.
    let rowsForBono = resolvedRows;

    let withBono = rowsForBono;
    const hasManualBono = rowsForBono.some((r) => r.bonificacionARS != null && r.bonificacionARS !== '');
    if (!hasManualBono && bonoTotal > 0) {
      withBono = distributeBonificacion(rowsForBono, bonoTotal);
    }

    const normalized = validateImputaciones(withBono, montoARSAbs, {
      bonificacionTotalARS: bonoTotal
    });

    const nuevoCobro = await prisma.$transaction(async (tx) => {
      const codigo = await allocateNextCobroCodigo(tx);
      const anchor = normalized.length === 1 ? normalized[0] : null;
      const cobro = await tx.cobro.create({
        data: {
          codigo,
          accountId: anchor ? anchor.accountId : null,
          reservaId: anchor ? anchor.reservaId : null,
          paymentMethodConfigId: methodConfig?.id ?? null,
          monto: new Decimal(montoAbsFinal),
          moneda: monedaFinal,
          tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
          montoARS,
          dineroRecibido: new Decimal(tender.dineroRecibido),
          vueltoARS: new Decimal(tender.vueltoARS),
          metodo: metodoFinal,
          numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal)
            ? req.body.numeroTarjeta
            : null,
          empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodoFinal)
            ? req.body.empresa
            : null,
          motivo: motivoCobro,
          fecha: fechaCobro,
          requiereFacturacion: wantsBilling,
          ...(wantsBilling ? { factura: { create: facturaParsed.data } } : {})
        }
      });

      const createdImps = [];
      for (const row of normalized) {
        const { balance: balAntes } = await loadAccountFinancialParts(tx, row.accountId);
        const imp = await tx.cobroImputacion.create({
          data: {
            cobroId: cobro.id,
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
            cobroId: cobro.id,
            cobroImputacionId: imp.id,
            config: methodConfig,
            motivo: motivoCobro,
            dineroARS: Math.abs(row.montoARS),
            monedaCobro: monedaFinal,
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

      return tx.cobro.findUnique({
        where: { id: cobro.id },
        include: {
          factura: true,
          discountApplications: true,
          imputaciones: { include: { discountApplications: true } },
          ...PAGO_ADJUNTO_INCLUDE
        }
      });
    });

    res.status(201).json({
      ...nuevoCobro,
      discountApplication:
        (nuevoCobro.discountApplications && nuevoCobro.discountApplications[0]) || null
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creando cobro multi-cliente:', error);
    res.status(500).json({ error: 'Error al crear el cobro', details: error.message });
  }
};

