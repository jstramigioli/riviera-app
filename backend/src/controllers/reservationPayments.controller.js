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
    fecha 
  } = req.body;

  try {
    const dataToUpdate = {};
    
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (monto !== undefined) {
      if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      }
      dataToUpdate.monto = new Decimal(monto);
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

    // Calcular totales (usando montoARS para pagos)
    const totalCargos = cargos.reduce((sum, cargo) => {
      return sum + parseFloat(cargo.monto);
    }, 0);

    const totalPagos = pagos.reduce((sum, pago) => {
      return sum + parseFloat(pago.montoARS);
    }, 0);

    const saldo = totalCargos - totalPagos;

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
        cargos: {
          include: {
            subcategoriaCargo: true,
            roomType: true,
            serviceType: true
          }
        },
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


