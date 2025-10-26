const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');

// ============================================
// CONTROLADORES DE PAGOS
// ============================================

// Obtener todos los pagos de una reserva
exports.getPagosByReserva = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const pagos = await prisma.pago.findMany({
      where: { reservaId: parseInt(reservaId) },
      orderBy: { fecha: 'desc' }
    });
    res.json(pagos);
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ error: 'Error al obtener los pagos', details: error.message });
  }
};

// Crear un nuevo pago para una reserva
exports.createPago = async (req, res) => {
  const { reservaId } = req.params;
  const { monto, moneda, tipoCambio, metodo, tipoTarjeta, numeroTarjeta, empresa, referencia, notas, fecha } = req.body;

  if (!monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos requeridos: monto y metodo' });
  }

  if (monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
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
    // Calcular monto en ARS
    let montoARS;
    if (monedaFinal === 'USD') {
      montoARS = new Decimal(monto).mul(new Decimal(tipoCambioFinal));
    } else {
      montoARS = new Decimal(monto);
    }

    const nuevoPago = await prisma.pago.create({
      data: {
        reservaId: parseInt(reservaId),
        monto: new Decimal(monto),
        moneda: monedaFinal,
        tipoCambio: monedaFinal === 'USD' ? new Decimal(tipoCambioFinal) : null,
        montoARS: montoARS,
        metodo,
        numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo) ? numeroTarjeta : null,
        empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(metodo) ? empresa : null,
        referencia: referencia || null,
        notas: notas || null,
        fecha: fecha ? new Date(fecha) : new Date()
      }
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
  const { monto, moneda, tipoCambio, metodo, tipoTarjeta, numeroTarjeta, empresa, referencia, notas, fecha } = req.body;

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

    const pagoActualizado = await prisma.pago.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
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
// CONTROLADORES DE CARGOS
// ============================================

// Obtener todos los cargos de una reserva
exports.getCargosByReserva = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const cargos = await prisma.cargo.findMany({
      where: { reservaId: parseInt(reservaId) },
      orderBy: { fecha: 'asc' } // Cambiado a ascendente (más antiguos primero)
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
  const { descripcion, monto, tipo, notas, fecha } = req.body;

  if (!descripcion || !monto) {
    return res.status(400).json({ error: 'Faltan campos requeridos: descripcion y monto' });
  }

  if (monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  // Validar tipo de cargo
  const tiposValidos = ['ALOJAMIENTO', 'SERVICIO', 'CONSUMO', 'OTRO'];
  if (tipo && !tiposValidos.includes(tipo)) {
    return res.status(400).json({ 
      error: `Tipo de cargo inválido. Debe ser uno de: ${tiposValidos.join(', ')}` 
    });
  }

  try {
    const nuevoCargo = await prisma.cargo.create({
      data: {
        reservaId: parseInt(reservaId),
        descripcion,
        monto: new Decimal(monto),
        tipo: tipo || 'ALOJAMIENTO',
        notas: notas || null,
        fecha: fecha ? new Date(fecha) : new Date()
      }
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
  const { descripcion, monto, tipo, notas, fecha } = req.body;

  try {
    const dataToUpdate = {};
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (monto !== undefined) {
      if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      }
      dataToUpdate.monto = new Decimal(monto);
    }
    if (tipo !== undefined) {
      const tiposValidos = ['ALOJAMIENTO', 'SERVICIO', 'CONSUMO', 'OTRO'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ 
          error: `Tipo de cargo inválido. Debe ser uno de: ${tiposValidos.join(', ')}` 
        });
      }
      dataToUpdate.tipo = tipo;
    }
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (fecha !== undefined) dataToUpdate.fecha = new Date(fecha);

    const cargoActualizado = await prisma.cargo.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
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
    const [pagos, cargos, reserva] = await Promise.all([
      prisma.pago.findMany({
        where: { reservaId: parseInt(reservaId) }
      }),
      prisma.cargo.findMany({
        where: { reservaId: parseInt(reservaId) }
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

    // Calcular totales (usando montoARS para pagos)
    const totalCargos = cargos.reduce((sum, cargo) => {
      return sum + parseFloat(cargo.monto);
    }, 0);

    const totalPagos = pagos.reduce((sum, pago) => {
      return sum + parseFloat(pago.montoARS);
    }, 0);

    const saldo = totalCargos - totalPagos;

    // Agrupar cargos por tipo
    const cargosPorTipo = cargos.reduce((acc, cargo) => {
      const tipo = cargo.tipo || 'OTRO';
      if (!acc[tipo]) {
        acc[tipo] = {
          cantidad: 0,
          total: 0,
          items: []
        };
      }
      acc[tipo].cantidad++;
      acc[tipo].total += parseFloat(cargo.monto);
      acc[tipo].items.push(cargo);
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
        estadoPago: saldo > 0 ? 'PENDIENTE' : (saldo < 0 ? 'A_FAVOR' : 'PAGADO')
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

// Obtener listado de todas las reservas con sus saldos
exports.getReservasConSaldos = async (req, res) => {
  try {
    const reservas = await prisma.reservation.findMany({
      include: {
        mainClient: true,
        pagos: true,
        cargos: true,
        guests: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const reservasConSaldos = reservas.map(reserva => {
      const totalCargos = reserva.cargos.reduce((sum, cargo) => {
        return sum + parseFloat(cargo.monto);
      }, 0);

      const totalPagos = reserva.pagos.reduce((sum, pago) => {
        return sum + parseFloat(pago.montoARS);
      }, 0);

      const saldo = totalCargos - totalPagos;

      return {
        id: reserva.id,
        status: reserva.status,
        mainClient: reserva.mainClient,
        cantidadHuespedes: reserva.guests.length,
        totalCargos,
        totalPagos,
        saldo,
        estadoPago: saldo > 0 ? 'PENDIENTE' : (saldo < 0 ? 'A_FAVOR' : 'PAGADO'),
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


