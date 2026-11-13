const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { calculateAccountBalance } = require('../utils/accountBalance');
const { allocateNextPagoCodigo } = require('../utils/pagoCodigo');
const { roleHasPermission } = require('../auth/permissions');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { civilFromDb } = require('../utils/calendarDates');
const {
  ACCOUNT_KIND,
  ACCOUNT_STATUS,
  createExternalAccount,
  dualWriteExternalRefs,
  ensureReservationAccount,
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

function canSeeFacturacion(user) {
  return roleHasPermission(user?.role, 'facturacion');
}

function redactFacturaIfNeeded(pagos, user) {
  if (canSeeFacturacion(user)) return pagos;
  return (pagos || []).map((pago) => ({ ...pago, factura: null }));
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
        documentType:
          normalizeOptionalString(facturaInput.documentType || facturaInput.tipoDocumento) ||
          'DNI',
        documentNumber: normalizeOptionalString(
          facturaInput.documentNumber || facturaInput.numeroDocumento
        ),
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
      ivaCondition: !isB ? facturaData.ivaCondition : undefined,
      cardNumber: facturaData.cardNumber
    },
    update: {
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
      ivaCondition: !isB ? facturaData.ivaCondition : undefined,
      cardNumber: facturaData.cardNumber
    }
  };
}

function mapAccountSaldoRow(account) {
  const { totalCargos, totalPagos, saldo, estadoPago } = calculateAccountBalance(
    account.cargos || [],
    account.pagos || []
  );
  const reservation = account.reservation || null;
  const client = account.client || reservation?.mainClient || null;
  const origen = account.kind === ACCOUNT_KIND.EXTERNAL ? 'EXTERNA' : 'RESERVA';

  return {
    id: account.kind === ACCOUNT_KIND.RESERVATION && reservation ? reservation.id : account.id,
    accountId: account.id,
    accountKind: account.kind,
    accountStatus: account.status,
    accountLabel: account.label,
    origen,
    reservationId: account.reservationId || null,
    status: reservation?.status || account.status,
    mainClient: client,
    cantidadHuespedes: reservation?._count?.guests ?? 0,
    totalCargos,
    totalPagos,
    saldo,
    estadoPago,
    pagos: (account.pagos || [])
      .map((pago) => ({
        id: pago.id,
        codigo: pago.codigo,
        montoARS: pago.montoARS,
        fecha: pago.fecha
      }))
      .sort((a, b) => a.id - b.id),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

/** Listado de Accounts con saldos (Estado de cuentas). */
exports.getAccountsConSaldos = async (req, res) => {
  try {
    const kindFilter = String(req.query.kind || req.query.origen || 'ALL').toUpperCase();
    const where = {};
    if (kindFilter === 'RESERVATION' || kindFilter === 'RESERVA') {
      where.kind = ACCOUNT_KIND.RESERVATION;
    } else if (kindFilter === 'EXTERNAL' || kindFilter === 'EXTERNA') {
      where.kind = ACCOUNT_KIND.EXTERNAL;
    }

    const accounts = await prisma.account.findMany({
      where,
      select: {
        id: true,
        kind: true,
        status: true,
        label: true,
        reservationId: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        reservation: {
          select: {
            id: true,
            status: true,
            mainClient: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true }
            },
            _count: { select: { guests: true } }
          }
        },
        cargos: { select: { monto: true } },
        pagos: { select: { id: true, codigo: true, montoARS: true, fecha: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(accounts.map(mapAccountSaldoRow));
  } catch (error) {
    console.error('Error listando accounts con saldos:', error);
    res.status(500).json({ error: 'Error al listar cuentas', details: error.message });
  }
};

/** Opciones para Select de pago / comanda: reservas activas + externas OPEN. */
exports.getCuentasParaPago = async (req, res) => {
  try {
    const [reservas, externas] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          status: { in: OCCUPYING_STATUSES },
          segments: { some: { isActive: true } }
        },
        select: {
          id: true,
          status: true,
          account: { select: { id: true, status: true } },
          mainClient: { select: { id: true, firstName: true, lastName: true } },
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
      }),
      prisma.account.findMany({
        where: { kind: ACCOUNT_KIND.EXTERNAL, status: ACCOUNT_STATUS.OPEN },
        select: {
          id: true,
          label: true,
          status: true,
          client: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { id: 'desc' }
      })
    ]);

    const reservationRows = [];
    for (const reserva of reservas) {
      let accountId = reserva.account?.id || null;
      if (!accountId) {
        const ensured = await ensureReservationAccount(prisma, reserva.id, reserva.mainClient?.id);
        accountId = ensured.id;
      }
      const seg = reserva.segments[0] || null;
      const roomName = seg?.room?.name || null;
      const lastName = String(reserva.mainClient?.lastName || '').trim();
      const firstName = String(reserva.mainClient?.firstName || '').trim();
      const clientName = `${firstName} ${lastName}`.trim();
      const apellido = lastName || 'Sin apellido';
      const roomLabel = roomName || `Reserva #${reserva.id}`;
      reservationRows.push({
        accountId,
        accountKind: ACCOUNT_KIND.RESERVATION,
        reservationId: reserva.id,
        status: reserva.status,
        roomId: seg?.room?.id || null,
        roomName,
        clientId: reserva.mainClient?.id || null,
        clientName,
        clientLastName: lastName,
        label: `${roomLabel} - ${apellido}`,
        origen: 'RESERVA',
        segmentId: seg?.id || null,
        startDate: seg ? civilFromDb(seg.startDate) : null,
        endDate: seg ? civilFromDb(seg.endDate) : null
      });
    }

    const externalRows = externas.map((account) => {
      const lastName = String(account.client?.lastName || '').trim();
      const firstName = String(account.client?.firstName || '').trim();
      const clientName = `${firstName} ${lastName}`.trim();
      return {
        accountId: account.id,
        accountKind: ACCOUNT_KIND.EXTERNAL,
        reservationId: null,
        status: account.status,
        roomId: null,
        roomName: null,
        clientId: account.client?.id || null,
        clientName,
        clientLastName: lastName,
        label: account.label || `Externa #${account.id}`,
        origen: 'EXTERNA',
        segmentId: null,
        startDate: null,
        endDate: null
      };
    });

    const data = [...reservationRows, ...externalRows];
    data.sort((a, b) => {
      const byOrigen = String(a.origen).localeCompare(String(b.origen), 'es');
      if (byOrigen !== 0) return byOrigen;
      const byName = String(a.clientLastName || a.label).localeCompare(
        String(b.clientLastName || b.label),
        'es'
      );
      if (byName !== 0) return byName;
      return String(a.label).localeCompare(String(b.label), 'es', { numeric: true });
    });

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error listando cuentas para pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar cuentas para pago',
      details: error.message
    });
  }
};

/** Alta Account EXTERNAL (label alcanza). */
exports.createExternalAccountHandler = async (req, res) => {
  try {
    const { label, clientId, notes } = req.body || {};
    const account = await createExternalAccount(prisma, { label, clientId, notes });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    console.error('Error creando cuenta externa:', error);
    const status = /label/i.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        client: true,
        reservation: {
          include: {
            mainClient: true,
            guests: true,
            segments: { include: { room: true, roomType: true } }
          }
        },
        cargos: {
          include: { subcategoriaCargo: true, roomType: true, serviceType: true },
          orderBy: { fecha: 'asc' }
        },
        pagos: { include: { factura: true }, orderBy: { fecha: 'asc' } }
      }
    });
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    const balance = calculateAccountBalance(account.cargos, account.pagos);
    res.json({
      ...account,
      pagos: redactFacturaIfNeeded(account.pagos, req.user),
      resumen: balance
    });
  } catch (error) {
    console.error('Error obteniendo account:', error);
    res.status(500).json({ error: 'Error al obtener la cuenta', details: error.message });
  }
};

exports.getAccountResumen = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        client: true,
        reservation: { include: { mainClient: true } },
        cargos: { select: { monto: true } },
        pagos: { select: { montoARS: true } }
      }
    });
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    const resumen = calculateAccountBalance(account.cargos, account.pagos);
    res.json({
      account: {
        id: account.id,
        kind: account.kind,
        status: account.status,
        label: account.label,
        reservationId: account.reservationId,
        clientId: account.clientId
      },
      resumen
    });
  } catch (error) {
    console.error('Error resumen account:', error);
    res.status(500).json({ error: 'Error al obtener resumen', details: error.message });
  }
};

exports.getAccountCargos = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cargos = await prisma.cargo.findMany({
      where: { accountId: id },
      include: { subcategoriaCargo: true, roomType: true, serviceType: true },
      orderBy: { fecha: 'asc' }
    });
    res.json(cargos);
  } catch (error) {
    console.error('Error cargos account:', error);
    res.status(500).json({ error: 'Error al obtener cargos', details: error.message });
  }
};

exports.getAccountPagos = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pagos = await prisma.pago.findMany({
      where: { accountId: id },
      include: { factura: true, adjuntos: { orderBy: { createdAt: 'asc' } } },
      orderBy: { fecha: 'asc' }
    });
    res.json(redactFacturaIfNeeded(pagos, req.user));
  } catch (error) {
    console.error('Error pagos account:', error);
    res.status(500).json({ error: 'Error al obtener pagos', details: error.message });
  }
};

/** Crear cargo en Account (EXTERNAL o RESERVATION vía accountId). */
exports.createAccountCargo = async (req, res) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    const { descripcion, monto, subcategoriaCargoId, notas, fecha } = req.body || {};
    if (!descripcion || !monto) {
      return res.status(400).json({ error: 'Faltan campos requeridos: descripcion y monto' });
    }
    if (Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    if (!subcategoriaCargoId) {
      return res.status(400).json({ error: 'subcategoriaCargoId es requerido' });
    }

    const refs =
      account.kind === ACCOUNT_KIND.RESERVATION
        ? { accountId: account.id, reservaId: account.reservationId }
        : dualWriteExternalRefs(account);

    const cargo = await prisma.cargo.create({
      data: {
        ...refs,
        descripcion,
        monto: new Decimal(monto),
        subcategoriaCargoId: parseInt(subcategoriaCargoId, 10),
        notas: notas || null,
        fecha: fecha ? new Date(fecha) : new Date()
      },
      include: { subcategoriaCargo: true }
    });

    const [cargos, pagos] = await Promise.all([
      prisma.cargo.findMany({ where: { accountId }, select: { monto: true } }),
      prisma.pago.findMany({ where: { accountId }, select: { montoARS: true } })
    ]);
    await syncAccountStatusFromBalance(
      prisma,
      accountId,
      calculateAccountBalance(cargos, pagos).saldo
    );

    res.status(201).json(cargo);
  } catch (error) {
    console.error('Error creando cargo en account:', error);
    res.status(500).json({ error: 'Error al crear el cargo', details: error.message });
  }
};

/**
 * Crear pago en Account.
 * Seña solo permitida en cuentas RESERVATION.
 */
exports.createAccountPago = async (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  const {
    monto,
    moneda,
    tipoCambio,
    metodo,
    numeroTarjeta,
    empresa,
    notas,
    motivo,
    requiereFacturacion,
    factura
  } = req.body || {};

  if (!monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos requeridos: monto y metodo' });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { reservation: { select: { mainClientId: true } }, client: true }
    });
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const motivoPago = normalizePagoMotivo(motivo ?? DEFAULT_PAGO_MOTIVO);
    if (!motivoPago) {
      return res.status(400).json({ error: 'Motivo inválido. Debe ser Pago, Seña o Devolución' });
    }
    if (motivoPago === 'Seña' && account.kind !== ACCOUNT_KIND.RESERVATION) {
      return res.status(400).json({
        error: 'La seña solo se registra en la cuenta de una reserva'
      });
    }

    const montoAbs = Math.abs(Number(monto));
    if (!Number.isFinite(montoAbs) || montoAbs <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    const montoSigned = isDevolucionMotivo(motivoPago) ? -montoAbs : montoAbs;

    if (['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)) {
      if (!numeroTarjeta) {
        return res.status(400).json({ error: 'El número de tarjeta es requerido para pagos con tarjeta' });
      }
      if (!empresa) {
        return res.status(400).json({ error: 'La empresa de la tarjeta es requerida para pagos con tarjeta' });
      }
    }

    const monedasValidas = ['ARS', 'USD'];
    const monedaFinal = moneda || 'ARS';
    if (!monedasValidas.includes(monedaFinal)) {
      return res.status(400).json({ error: `Moneda inválida. Debe ser una de: ${monedasValidas.join(', ')}` });
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
        ? new Decimal(montoSigned).mul(new Decimal(tipoCambioFinal))
        : new Decimal(montoSigned);

    const refs =
      account.kind === ACCOUNT_KIND.RESERVATION
        ? { accountId: account.id, reservaId: account.reservationId }
        : dualWriteExternalRefs(account);

    const nuevoPago = await prisma.$transaction(async (tx) => {
      const codigo = await allocateNextPagoCodigo(tx);
      const pago = await tx.pago.create({
        data: {
          codigo,
          ...refs,
          monto: new Decimal(montoSigned),
          moneda: monedaFinal,
          tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
          montoARS,
          metodo,
          numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo)
            ? numeroTarjeta
            : null,
          empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo) ? empresa : null,
          notas: notas || null,
          motivo: motivoPago,
          fecha: new Date(),
          requiereFacturacion: wantsBilling,
          ...(wantsBilling
            ? { factura: { create: facturaParsed.data } }
            : {})
        },
        include: { factura: true, adjuntos: true }
      });

      if (wantsBilling) {
        const clientId =
          account.clientId ||
          account.reservation?.mainClientId ||
          null;
        if (clientId) {
          await tx.clientBillingProfile.upsert(
            buildBillingProfileUpsert(clientId, facturaParsed.data)
          );
        }
      }

      const [cargos, pagos] = await Promise.all([
        tx.cargo.findMany({ where: { accountId }, select: { monto: true } }),
        tx.pago.findMany({ where: { accountId }, select: { montoARS: true } })
      ]);
      await syncAccountStatusFromBalance(
        tx,
        accountId,
        calculateAccountBalance(cargos, pagos).saldo
      );

      return pago;
    });

    res.status(201).json(nuevoPago);
  } catch (error) {
    console.error('Error creando pago en account:', error);
    res.status(500).json({ error: 'Error al crear el pago', details: error.message });
  }
};
