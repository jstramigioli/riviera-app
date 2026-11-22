const prisma = require('../utils/prisma');
const { aggregateReservationsBalance } = require('../utils/reservationBalance');
const { aggregateAccountsBalance } = require('../utils/accountBalance');
const { DEFAULT_IVA_CONDITION } = require('../utils/billingConstants');
const {
  readMeta,
  readAllMeta,
  absolutePath,
  saveDocumentPhoto,
  deleteDocumentPhoto,
  toPublicMeta,
  toPublicSlots,
  assertSlot,
  prismaFieldsForSlot,
  prismaFieldsForAll
} = require('../utils/clientDocumentPhoto');

function normalizeBillingString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizePlate(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().toUpperCase().replace(/\s+/g, '');
  return cleaned || null;
}

/** YYYY-MM-DD o ISO → Date a mediodía local; vacío → null. Lanza si el valor es inválido. */
function parseOptionalBirthDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0, 0);
    if (Number.isNaN(d.getTime())) throw new Error('invalid birthDate');
    return d;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('invalid birthDate');
  return d;
}

// Listar todos los clientes (incluye createdAt/updatedAt para comparaciones temporales)
exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching clients' });
  }
};

// Obtener un cliente específico
exports.getClientById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) }
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching client' });
  }
};

// Crear un cliente
exports.createClient = async (req, res) => {
  const { firstName, lastName, email, phone, documentType, documentNumber, birthDate, country, province, city, notes, vehiclePlate, wantsPromotions } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  
  // Validar formato de email si se proporciona
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  let parsedBirthDate;
  try {
    parsedBirthDate = parseOptionalBirthDate(birthDate);
  } catch {
    return res.status(400).json({ error: 'Fecha de nacimiento inválida' });
  }
  
  try {
    const data = {
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      documentType: documentType || 'DNI',
      documentNumber: documentNumber || null,
      country: country || null,
      province: province || null,
      city: city || null,
      notes: notes || null,
      wantsPromotions: wantsPromotions || false
    };
    // Solo incluir patente si vino en el body (evita romper creates legacy / client Prisma stale).
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'vehiclePlate')) {
      data.vehiclePlate = normalizePlate(vehiclePlate);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'birthDate')) {
      data.birthDate = parsedBirthDate;
    }

    const newClient = await prisma.client.create({ data });
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    console.error('Request body:', req.body);
    const details = process.env.NODE_ENV !== 'production' ? error.message : undefined;
    res.status(500).json({
      error: 'Error creating client',
      message: details || 'Error creating client',
      details
    });
  }
};

// Actualizar un cliente
exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone, documentType, documentNumber, birthDate, country, province, city, notes, vehiclePlate, wantsPromotions } = req.body;
  
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  
  // Validar formato de email si se proporciona
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  let parsedBirthDate;
  if (birthDate !== undefined) {
    try {
      parsedBirthDate = parseOptionalBirthDate(birthDate);
    } catch {
      return res.status(400).json({ error: 'Fecha de nacimiento inválida' });
    }
  }
  
  try {
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(documentType !== undefined && { documentType }),
        ...(documentNumber !== undefined && { documentNumber }),
        ...(birthDate !== undefined && { birthDate: parsedBirthDate }),
        ...(country !== undefined && { country }),
        ...(province !== undefined && { province }),
        ...(city !== undefined && { city }),
        ...(notes !== undefined && { notes }),
        ...(vehiclePlate !== undefined && { vehiclePlate: normalizePlate(vehiclePlate) }),
        ...(wantsPromotions !== undefined && { wantsPromotions })
      }
    });
    res.json(updatedClient);
  } catch (error) {
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.status(500).json({ error: 'Error updating client', details: error.message });
  }
};

// Eliminar un cliente
exports.deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.client.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Client not found' });
  }
};

/** Prefill de facturación: perfil de billing (si hay) + defaults del cliente. */
exports.getClientBillingProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const clientId = parseInt(id, 10);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        documentType: true,
        documentNumber: true,
        city: true,
        province: true,
        country: true,
        billingProfile: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const profile = client.billingProfile;
    const addressFallback = [client.city, client.province, client.country]
      .filter(Boolean)
      .join(', ');

    res.json({
      clientId: client.id,
      lastInvoiceType: profile?.lastInvoiceType || 'B',
      firstName: profile?.firstName || client.firstName || '',
      lastName: profile?.lastName || client.lastName || '',
      documentType: profile?.documentType || client.documentType || 'DNI',
      documentNumber: profile?.documentNumber || client.documentNumber || '',
      passportCountry: profile?.passportCountry || client.country || '',
      address: profile?.address || addressFallback || '',
      email: profile?.email || client.email || '',
      businessName: profile?.businessName || '',
      cuit: profile?.cuit || '',
      commercialAddress: profile?.commercialAddress || profile?.address || addressFallback || '',
      ivaCondition: profile?.ivaCondition || DEFAULT_IVA_CONDITION,
      cardNumber: profile?.cardNumber || '',
      hasSavedProfile: Boolean(profile)
    });
  } catch (error) {
    console.error('Error fetching client billing profile:', error);
    res.status(500).json({ error: 'Error fetching billing profile' });
  }
};

exports.upsertClientBillingProfile = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  try {
    const clientId = parseInt(id, 10);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true }
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const data = {
      lastInvoiceType: normalizeBillingString(body.lastInvoiceType || body.tipo),
      firstName: normalizeBillingString(body.firstName || body.nombre),
      lastName: normalizeBillingString(body.lastName || body.apellido),
      documentType: normalizeBillingString(body.documentType || body.tipoDocumento),
      documentNumber: normalizeBillingString(body.documentNumber || body.numeroDocumento),
      passportCountry: normalizeBillingString(
        body.passportCountry || body.paisEmisorPasaporte || body.paisPasaporte
      ),
      address: normalizeBillingString(body.address || body.domicilio),
      email: normalizeBillingString(body.email),
      businessName: normalizeBillingString(body.businessName || body.razonSocial),
      cuit: normalizeBillingString(body.cuit),
      commercialAddress: normalizeBillingString(
        body.commercialAddress || body.domicilioComercial
      ),
      ivaCondition:
        normalizeBillingString(body.ivaCondition || body.condicionIva) ||
        DEFAULT_IVA_CONDITION,
      cardNumber: normalizeBillingString(body.cardNumber || body.tarjetaNumero)
    };

    const profile = await prisma.clientBillingProfile.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: data
    });

    res.json(profile);
  } catch (error) {
    console.error('Error upserting client billing profile:', error);
    res.status(500).json({ error: 'Error saving billing profile' });
  }
};

// Balance total del cliente: Accounts RESERVATION (excl. canceladas) + EXTERNAL del titular.
exports.getClientBalance = async (req, res) => {
  const { id } = req.params;
  try {
    const clientId = parseInt(id, 10);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        reservations: {
          include: {
            cargos: true,
            cobros: true,
          },
        },
        accounts: {
          include: {
            reservation: { select: { id: true, status: true } },
            cargos: {
              select: {
                id: true,
                descripcion: true,
                monto: true,
                fecha: true,
                notas: true,
                reservaId: true,
                accountId: true,
                subcategoriaCargoId: true,
                roomTypeId: true,
                serviceTypeId: true,
                subcategoriaCargo: {
                  select: { id: true, nombre: true, tipo: true }
                }
              },
              orderBy: { fecha: 'desc' }
            },
            imputaciones: {
              select: {
                id: true,
                montoARS: true,
                bonificacionARS: true,
                reservaId: true,
                accountId: true,
                ordenIndex: true,
                cobro: {
                  select: {
                    id: true,
                    codigo: true,
                    fecha: true,
                    monto: true,
                    moneda: true,
                    tipoCambio: true,
                    montoARS: true,
                    metodo: true,
                    motivo: true,
                    notas: true,
                    referencia: true,
                    numeroTarjeta: true,
                    empresa: true,
                    requiereFacturacion: true,
                    _count: { select: { imputaciones: true } }
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            },
            discountApplications: { select: { montoARS: true } },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Preferir Accounts; fallback legacy a reservations si aún no hay folio.
    // Saldo por folio usa imputaciones (no Cobro directo).
    const accounts = (client.accounts || []).map((account) => ({
      ...account,
      reservationId: account.reservationId || account.reservation?.id || null,
      cobros: account.imputaciones || [],
    }));

    const byAccount = aggregateAccountsBalance(accounts);
    const byReservation = aggregateReservationsBalance(client.reservations);
    const useAccounts = accounts.length > 0;

    const toNumber = (v) => (v == null ? 0 : Number(v));

    let cargos = [];
    let cobros = [];

    if (useAccounts) {
      for (const account of accounts) {
        const accountLabel =
          account.label ||
          (account.reservationId ? `Reserva #${account.reservationId}` : `Cuenta #${account.id}`);
        for (const cargo of account.cargos || []) {
          cargos.push({
            id: cargo.id,
            descripcion: cargo.descripcion,
            monto: toNumber(cargo.monto),
            fecha: cargo.fecha,
            notas: cargo.notas || null,
            reservaId: cargo.reservaId || account.reservationId || null,
            accountId: cargo.accountId || account.id,
            accountKind: account.kind || null,
            accountLabel,
            subcategoriaCargoId: cargo.subcategoriaCargoId || null,
            subcategoriaNombre: cargo.subcategoriaCargo?.nombre || null,
            tipoCargo: cargo.subcategoriaCargo?.tipo || (cargo.roomTypeId ? 'ALOJAMIENTO' : null),
            editable: Boolean(cargo.subcategoriaCargoId)
          });
        }
        for (const imp of account.imputaciones || []) {
          const cobro = imp.cobro || {};
          const imputacionesCount = cobro._count?.imputaciones || 1;
          cobros.push({
            id: cobro.id,
            imputacionId: imp.id,
            codigo: cobro.codigo || null,
            fecha: cobro.fecha,
            monto: toNumber(cobro.monto),
            moneda: cobro.moneda || 'ARS',
            tipoCambio: cobro.tipoCambio != null ? toNumber(cobro.tipoCambio) : null,
            montoARS: toNumber(imp.montoARS),
            pagoTotalARS: toNumber(cobro.montoARS),
            bonificacionARS: toNumber(imp.bonificacionARS),
            metodo: cobro.metodo || null,
            motivo: cobro.motivo || 'Cobro',
            notas: cobro.notas || null,
            referencia: cobro.referencia || null,
            numeroTarjeta: cobro.numeroTarjeta || null,
            empresa: cobro.empresa || null,
            requiereFacturacion: Boolean(cobro.requiereFacturacion),
            reservaId: imp.reservaId || account.reservationId || null,
            accountId: imp.accountId || account.id,
            accountKind: account.kind || null,
            accountLabel,
            esImputacionParcial: imputacionesCount > 1,
            imputacionesCount
          });
        }
      }
    } else {
      for (const reservation of client.reservations || []) {
        const accountLabel = `Reserva #${reservation.id}`;
        for (const cargo of reservation.cargos || []) {
          cargos.push({
            id: cargo.id,
            descripcion: cargo.descripcion,
            monto: toNumber(cargo.monto),
            fecha: cargo.fecha,
            notas: cargo.notas || null,
            reservaId: cargo.reservaId || reservation.id,
            accountId: cargo.accountId || null,
            accountKind: 'RESERVATION',
            accountLabel,
            subcategoriaCargoId: cargo.subcategoriaCargoId || null,
            subcategoriaNombre: null,
            tipoCargo: cargo.subcategoriaCargoId ? null : (cargo.roomTypeId ? 'ALOJAMIENTO' : null),
            editable: Boolean(cargo.subcategoriaCargoId)
          });
        }
        for (const cobro of reservation.cobros || []) {
          cobros.push({
            id: cobro.id,
            imputacionId: null,
            codigo: cobro.codigo || null,
            fecha: cobro.fecha,
            monto: toNumber(cobro.monto),
            moneda: cobro.moneda || 'ARS',
            tipoCambio: cobro.tipoCambio != null ? toNumber(cobro.tipoCambio) : null,
            montoARS: toNumber(cobro.montoARS),
            pagoTotalARS: toNumber(cobro.montoARS),
            bonificacionARS: 0,
            metodo: cobro.metodo || null,
            motivo: cobro.motivo || 'Cobro',
            notas: cobro.notas || null,
            referencia: cobro.referencia || null,
            numeroTarjeta: cobro.numeroTarjeta || null,
            empresa: cobro.empresa || null,
            requiereFacturacion: Boolean(cobro.requiereFacturacion),
            reservaId: cobro.reservaId || reservation.id,
            accountId: cobro.accountId || null,
            accountKind: 'RESERVATION',
            accountLabel,
            esImputacionParcial: false,
            imputacionesCount: 1
          });
        }
      }
    }

    cargos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    cobros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      totalCharges: useAccounts ? byAccount.totalCharges : byReservation.totalCharges,
      totalCobros: useAccounts ? byAccount.totalCobros : byReservation.totalCobros,
      balance: useAccounts ? byAccount.balance : byReservation.balance,
      isDebtor: (useAccounts ? byAccount.balance : byReservation.balance) > 0,
      reservationCount: useAccounts ? byAccount.reservationCount : byReservation.reservationCount,
      accountCount: useAccounts ? byAccount.accountCount : byReservation.reservationCount,
      accounts: useAccounts ? byAccount.accounts : [],
      reservations: useAccounts ? byAccount.reservations : byReservation.reservations,
      cargos,
      cobros
    });
  } catch (error) {
    console.error('Error calculating client balance:', error);
    res.status(500).json({ error: 'Error calculating client balance' });
  }
};

async function assertClientExists(clientId) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true }
  });
  return Boolean(client);
}

function resolvePhotoSlot(req) {
  return assertSlot(req.params.slot || req.query.slot || req.body?.slot || 'front');
}

/** Meta de ambos slots (frente/dorso). */
exports.getClientDocumentPhotos = async (req, res) => {
  const clientId = parseInt(req.params.id, 10);
  try {
    if (!(await assertClientExists(clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(toPublicSlots(readAllMeta(clientId)));
  } catch (error) {
    console.error('Error leyendo fotos de documento:', error);
    res.status(500).json({ error: 'Error al obtener las fotos del documento' });
  }
};

/** Meta de un slot (compat: sin :slot → front). */
exports.getClientDocumentPhoto = async (req, res) => {
  const clientId = parseInt(req.params.id, 10);
  try {
    if (!(await assertClientExists(clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const checked = resolvePhotoSlot(req);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }
    const meta = readMeta(clientId, checked.slot);
    if (!meta) {
      return res.status(404).json({
        error: `Sin foto de documento (${checked.slot === 'front' ? 'frente' : 'dorso'})`,
        exists: false,
        slot: checked.slot
      });
    }
    res.json(toPublicMeta({ ...meta, slot: checked.slot }));
  } catch (error) {
    console.error('Error leyendo foto de documento:', error);
    res.status(500).json({ error: 'Error al obtener la foto del documento' });
  }
};

exports.downloadClientDocumentPhoto = async (req, res) => {
  const clientId = parseInt(req.params.id, 10);
  try {
    if (!(await assertClientExists(clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const checked = resolvePhotoSlot(req);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }
    const meta = readMeta(clientId, checked.slot);
    if (!meta) {
      return res.status(404).json({ error: 'Sin foto de documento' });
    }
    const filePath = absolutePath(clientId, meta.storedName);
    res.download(filePath, meta.originalName || meta.storedName, (err) => {
      if (err) {
        console.error('Error descargando foto de documento:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al descargar la foto del documento' });
        }
      }
    });
  } catch (error) {
    console.error('Error descargando foto de documento:', error);
    res.status(500).json({ error: 'Error al descargar la foto del documento' });
  }
};

exports.uploadClientDocumentPhoto = async (req, res) => {
  const clientId = parseInt(req.params.id, 10);
  try {
    if (!(await assertClientExists(clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const checked = resolvePhotoSlot(req);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo requerido' });
    }
    const result = saveDocumentPhoto(clientId, req.file, checked.slot);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    await prisma.client.update({
      where: { id: clientId },
      data: prismaFieldsForSlot(checked.slot, result.meta)
    });
    res.status(201).json(toPublicMeta({ ...result.meta, slot: checked.slot }));
  } catch (error) {
    console.error('Error subiendo foto de documento:', error);
    res.status(500).json({ error: 'Error al subir la foto del documento' });
  }
};

exports.deleteClientDocumentPhoto = async (req, res) => {
  const clientId = parseInt(req.params.id, 10);
  try {
    if (!(await assertClientExists(clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const rawSlot = req.params.slot || req.query.slot;
    if (!rawSlot) {
      const result = deleteDocumentPhoto(clientId);
      if (result.deleted) {
        await prisma.client.update({
          where: { id: clientId },
          data: prismaFieldsForAll(null)
        });
      }
      return res.json({ ok: true, deleted: result.deleted });
    }
    const checked = assertSlot(rawSlot);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }
    const result = deleteDocumentPhoto(clientId, checked.slot);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    await prisma.client.update({
      where: { id: clientId },
      data: prismaFieldsForSlot(checked.slot, null)
    });
    res.json({ ok: true, deleted: result.deleted, slot: checked.slot });
  } catch (error) {
    console.error('Error eliminando foto de documento:', error);
    res.status(500).json({ error: 'Error al eliminar la foto del documento' });
  }
}; 