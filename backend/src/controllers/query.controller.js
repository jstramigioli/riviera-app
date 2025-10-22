const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todas las consultas (agrupando multi-segmentos)
const getAllQueries = async (req, res) => {
  try {
    const allQueries = await prisma.query.findMany({
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        // room eliminado - ya no existe la relación
        mainClient: true,
        nightRates: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Agrupar queries por queryGroupId
    const groupedQueries = {};
    const standaloneQueries = [];
    
    allQueries.forEach(query => {
      if (query.queryGroupId) {
        if (!groupedQueries[query.queryGroupId]) {
          groupedQueries[query.queryGroupId] = [];
        }
        groupedQueries[query.queryGroupId].push(query);
      } else {
        // Queries antiguas sin grupo (single segment)
        standaloneQueries.push(query);
      }
    });
    
    // Crear una query "resumida" por cada grupo
    const displayQueries = [
      ...standaloneQueries,
      ...Object.values(groupedQueries).map(segments => {
        // Ordenar por segmentIndex
        const sorted = segments.sort((a, b) => (a.segmentIndex || 0) - (b.segmentIndex || 0));
        
        // Ya no verificamos habitaciones porque no las guardamos
        
        return {
          ...sorted[0], // Usar primer segmento como base
          id: sorted[0].id, // ID del primer segmento para el link
          queryGroupId: sorted[0].queryGroupId,
          checkIn: sorted[0].checkIn, // Inicio del PRIMER segmento
          checkOut: sorted[sorted.length - 1].checkOut, // Fin del ÚLTIMO segmento
          segmentCount: sorted.length, // Para mostrar "3 segmentos"
          isMultiSegment: true // Flag para el frontend
        };
      })
    ];
    
    // Re-ordenar por fecha de creación
    displayQueries.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA; // Más reciente primero
    });

    res.json(displayQueries);
  } catch (error) {
    console.error('Error al obtener consultas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una consulta por ID (con todos sus segmentos si es multi-segmento)
const getQueryById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = await prisma.query.findUnique({
      where: { id: parseInt(id) },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        // room eliminado - ya no existe la relación
        mainClient: true,
        nightRates: true
      }
    });

    if (!query) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    // Si tiene queryGroupId, traer TODOS los segmentos del grupo y las notas
    if (query.queryGroupId) {
      const [allSegments, queryGroup] = await Promise.all([
        prisma.query.findMany({
          where: { queryGroupId: query.queryGroupId },
          include: {
            guests: {
              include: {
                payments: true
              }
            },
            // room eliminado - ya no existe la relación
            mainClient: true,
            nightRates: true
          },
          orderBy: { segmentIndex: 'asc' }
        }),
        prisma.queryGroup.findUnique({
          where: { id: query.queryGroupId }
        })
      ]);
      
      return res.json({
        ...query,
        notes: queryGroup?.notes || null, // Notas desde QueryGroup
        segments: allSegments,
        isMultiSegment: true
      });
    }
    
    // Query antigua sin grupo - retornar como está (sin notas)
    res.json({ ...query, notes: null, isMultiSegment: false });
  } catch (error) {
    console.error('Error al obtener consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear una nueva consulta
const createQuery = async (req, res) => {
  try {
    const {
      // roomId eliminado - ya no se guarda
      mainClientId,
      checkIn,
      checkOut,
      totalAmount,
      reservationType = 'con_desayuno',
      serviceType = 'base',
      notes,
      fixed = false,
      requiredGuests,
      requiredRoomId,
      requiredTags = [],
      requirementsNotes,
      guests = []
    } = req.body;

    // Crear la consulta
    const query = await prisma.query.create({
      data: {
        // roomId eliminado del schema
        mainClientId: mainClientId ? parseInt(mainClientId) : null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        reservationType,
        serviceType,
        notes,
        fixed,
        requiredGuests: requiredGuests ? parseInt(requiredGuests) : null,
        requiredRoomId: requiredRoomId ? parseInt(requiredRoomId) : null,
        requiredTags: requiredTags || [],
        requirementsNotes,
        guests: {
          create: guests.map(guest => ({
            firstName: guest.firstName || null,
            lastName: guest.lastName || null,
            documentType: guest.documentType || 'DNI',
            documentNumber: guest.documentNumber || null,
            phone: guest.phone || null,
            email: guest.email || null,
            address: guest.address || null,
            city: guest.city || null
          }))
        }
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        // room eliminado - ya no existe la relación
        mainClient: true,
        nightRates: true
      }
    });

    res.status(201).json(query);
  } catch (error) {
    console.error('Error al crear consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear una consulta multi-segmento
const createMultiSegmentQuery = async (req, res) => {
  try {
    const {
      mainClientId,
      segments = [],
      notes
    } = req.body;

    if (!mainClientId) {
      return res.status(400).json({ error: 'mainClientId es requerido' });
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un segmento' });
    }

    // Generar un ID de grupo único
    const queryGroupId = `query-${mainClientId}-${Date.now()}`;
    
    // Crear el QueryGroup con las notas
    await prisma.queryGroup.create({
      data: {
        id: queryGroupId,
        mainClientId: parseInt(mainClientId),
        notes: notes || null
      }
    });
    
    // Crear todas las queries del grupo
    const createdQueries = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      const query = await prisma.query.create({
        data: {
          queryGroupId,
          segmentIndex: i,
          mainClientId: parseInt(mainClientId),
          // roomId eliminado del schema - solo guardamos requerimientos
          checkIn: segment.checkIn ? new Date(segment.checkIn) : null,
          checkOut: segment.checkOut ? new Date(segment.checkOut) : null,
          totalAmount: segment.totalAmount ? parseFloat(segment.totalAmount) : null,
          reservationType: segment.reservationType || 'con_desayuno',
          serviceType: segment.serviceType || 'base',
          // notes eliminado - ahora está en QueryGroup
          fixed: segment.fixed || false,
          requiredGuests: segment.requiredGuests ? parseInt(segment.requiredGuests) : null,
          requiredRoomId: segment.requiredRoomId ? parseInt(segment.requiredRoomId) : null,
          requiredTags: segment.requiredTags || [],
          requirementsNotes: segment.requirementsNotes || null,
          guests: {
            create: (segment.guests || []).map(guest => ({
              firstName: guest.firstName || null,
              lastName: guest.lastName || null,
              documentType: guest.documentType || 'DNI',
              documentNumber: guest.documentNumber || null,
              phone: guest.phone || null,
              email: guest.email || null,
              address: guest.address || null,
              city: guest.city || null
            }))
          }
        },
        include: {
          guests: {
            include: {
              payments: true
            }
          },
          // room eliminado - ya no existe la relación
          mainClient: true,
          nightRates: true
        }
      });
      
      createdQueries.push(query);
    }

    res.status(201).json({
      message: 'Consulta multi-segmento creada exitosamente',
      queryGroupId,
      segments: createdQueries,
      segmentCount: createdQueries.length
    });
  } catch (error) {
    console.error('Error al crear consulta multi-segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

// Actualizar una consulta multi-segmento
const updateMultiSegmentQuery = async (req, res) => {
  try {
    const { queryGroupId } = req.params;
    const {
      mainClientId,
      segments = [],
      notes
    } = req.body;

    // console.log('📝 updateMultiSegmentQuery - Params:', { queryGroupId, mainClientId, segmentCount: segments.length });
    // console.log('📝 Segments recibidos:', JSON.stringify(segments, null, 2));

    if (!queryGroupId) {
      return res.status(400).json({ error: 'queryGroupId es requerido' });
    }

    if (!mainClientId) {
      return res.status(400).json({ error: 'mainClientId es requerido' });
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un segmento' });
    }

    // Actualizar o crear el QueryGroup con las notas
    const existingGroup = await prisma.queryGroup.findUnique({
      where: { id: queryGroupId }
    });
    
    if (existingGroup) {
      await prisma.queryGroup.update({
        where: { id: queryGroupId },
        data: {
          notes: notes || null,
          mainClientId: parseInt(mainClientId)
        }
      });
    } else {
      await prisma.queryGroup.create({
        data: {
          id: queryGroupId,
          mainClientId: parseInt(mainClientId),
          notes: notes || null
        }
      });
    }
    
    // Obtener las queries existentes del grupo
    const existingQueries = await prisma.query.findMany({
      where: { queryGroupId },
      orderBy: { segmentIndex: 'asc' },
      include: {
        guests: {
          include: {
            payments: true
          }
        }
      }
    });

    const updatedQueries = [];
    
    // Actualizar o crear cada segmento
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const existingQuery = existingQueries[i];
      
      // console.log(`📝 Procesando segmento ${i}:`, segment);
      
      const queryData = {
        queryGroupId,
        segmentIndex: i,
        mainClientId: parseInt(mainClientId),
        // roomId eliminado del schema - solo guardamos requerimientos
        checkIn: segment.checkIn ? new Date(segment.checkIn) : null,
        checkOut: segment.checkOut ? new Date(segment.checkOut) : null,
        totalAmount: segment.totalAmount ? parseFloat(segment.totalAmount) : null,
        reservationType: segment.reservationType || 'con_desayuno',
        serviceType: segment.serviceType || 'base',
        // notes eliminado - ahora está en QueryGroup
        fixed: segment.fixed || false,
        requiredGuests: segment.requiredGuests ? parseInt(segment.requiredGuests) : null,
        requiredRoomId: segment.requiredRoomId ? parseInt(segment.requiredRoomId) : null,
        requiredTags: segment.requiredTags || [],
        requirementsNotes: segment.requirementsNotes || null
      };
      
      // console.log(`📝 QueryData preparado para segmento ${i}:`, queryData);
      
      let query;
      
      if (existingQuery) {
        // Actualizar query existente
        // console.log(`📝 Actualizando query existente ID: ${existingQuery.id}`);
        
        // Primero eliminar huéspedes antiguos
        await prisma.queryGuest.deleteMany({
          where: { queryId: existingQuery.id }
        });
        
        // console.log(`📝 Datos para actualizar:`, JSON.stringify(queryData, null, 2));
        
        // Actualizar la query
        query = await prisma.query.update({
          where: { id: existingQuery.id },
          data: {
            ...queryData,
            guests: {
              create: (segment.guests || []).map(guest => ({
                firstName: guest.firstName || null,
                lastName: guest.lastName || null,
                documentType: guest.documentType || 'DNI',
                documentNumber: guest.documentNumber || null,
                phone: guest.phone || null,
                email: guest.email || null,
                address: guest.address || null,
                city: guest.city || null
              }))
            }
          },
          include: {
            guests: {
              include: {
                payments: true
              }
            },
            // room eliminado - ya no existe la relación
            mainClient: true,
            nightRates: true
          }
        });
        // console.log(`✅ Query ${existingQuery.id} actualizada exitosamente`);
      } else {
        // Crear nueva query si no existe
        // console.log(`📝 Creando nueva query para segmento ${i}`);
        // console.log(`📝 Datos para crear:`, JSON.stringify(queryData, null, 2));
        
        query = await prisma.query.create({
          data: {
            ...queryData,
            guests: {
              create: (segment.guests || []).map(guest => ({
                firstName: guest.firstName || null,
                lastName: guest.lastName || null,
                documentType: guest.documentType || 'DNI',
                documentNumber: guest.documentNumber || null,
                phone: guest.phone || null,
                email: guest.email || null,
                address: guest.address || null,
                city: guest.city || null
              }))
            }
          },
          include: {
            guests: {
              include: {
                payments: true
              }
            },
            // room eliminado - ya no existe la relación
            mainClient: true,
            nightRates: true
          }
        });
        // console.log(`✅ Query creada exitosamente con ID: ${query.id}`);
      }
      
      updatedQueries.push(query);
    }
    
    // Eliminar queries sobrantes si se eliminaron segmentos
    if (existingQueries.length > segments.length) {
      const queriesToDelete = existingQueries.slice(segments.length);
      for (const query of queriesToDelete) {
        await prisma.query.delete({
          where: { id: query.id }
        });
      }
    }

    res.status(200).json({
      message: 'Consulta multi-segmento actualizada exitosamente',
      queryGroupId,
      segments: updatedQueries,
      segmentCount: updatedQueries.length
    });
  } catch (error) {
    console.error('❌ Error al actualizar consulta multi-segmento:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message, stack: error.stack });
  }
};

// Actualizar una consulta
const updateQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // roomId eliminado - ya no se guarda
      mainClientId,
      checkIn,
      checkOut,
      totalAmount,
      status,
      reservationType,
      serviceType,
      notes,
      fixed,
      requiredGuests,
      requiredRoomId,
      requiredTags,
      requirementsNotes
    } = req.body;

    const query = await prisma.query.update({
      where: { id: parseInt(id) },
      data: {
        // roomId eliminado del schema
        mainClientId: mainClientId ? parseInt(mainClientId) : null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        reservationType,
        serviceType,
        notes,
        fixed,
        requiredGuests: requiredGuests ? parseInt(requiredGuests) : null,
        requiredRoomId: requiredRoomId ? parseInt(requiredRoomId) : null,
        requiredTags: requiredTags || [],
        requirementsNotes
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        // room eliminado - ya no existe la relación
        mainClient: true,
        nightRates: true
      }
    });

    res.json(query);
  } catch (error) {
    console.error('Error al actualizar consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar una consulta
const deleteQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const queryId = parseInt(id);
    
    // Verificar si la consulta existe antes de eliminar
    const existingQuery = await prisma.query.findUnique({
      where: { id: queryId }
    });
    
    if (!existingQuery) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }
    
    await prisma.query.delete({
      where: { id: queryId }
    });

    res.json({ message: 'Consulta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Convertir consulta a reserva
const convertQueryToReservation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener la consulta con todos sus datos
    const query = await prisma.query.findUnique({
      where: { id: parseInt(id) },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: true,
        mainClient: true,
        nightRates: true
      }
    });

    if (!query) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    // Validar que la consulta tenga los datos mínimos necesarios para una reserva
    if (!query.roomId || !query.mainClientId || !query.checkIn || !query.checkOut || !query.totalAmount) {
      return res.status(400).json({ 
        error: 'La consulta no tiene todos los datos necesarios para convertirse en reserva',
        missingFields: {
          roomId: !query.roomId,
          mainClientId: !query.mainClientId,
          checkIn: !query.checkIn,
          checkOut: !query.checkOut,
          totalAmount: !query.totalAmount
        }
      });
    }

    // Crear la reserva usando los datos de la consulta
    const reservation = await prisma.reservation.create({
      data: {
        roomId: query.roomId,
        mainClientId: query.mainClientId,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        totalAmount: query.totalAmount,
        status: 'confirmada',
        reservationType: query.reservationType || 'con_desayuno',
        notes: query.notes,
        fixed: query.fixed || false,
        requiredGuests: query.requiredGuests || 1,
        requiredRoomId: query.requiredRoomId,
        requiredTags: query.requiredTags || [],
        requirementsNotes: query.requirementsNotes,
        guests: {
          create: query.guests.map(guest => ({
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            documentType: guest.documentType || 'DNI',
            documentNumber: guest.documentNumber,
            phone: guest.phone,
            email: guest.email,
            address: guest.address,
            city: guest.city
          }))
        },
        nightRates: {
          create: query.nightRates.map(rate => ({
            date: rate.date || new Date(),
            baseRate: rate.baseRate || 0,
            dynamicRate: rate.dynamicRate || 0,
            finalRate: rate.finalRate || 0,
            serviceType: rate.serviceType || 'con_desayuno',
            serviceRate: rate.serviceRate || 0,
            occupancyScore: rate.occupancyScore,
            isWeekend: rate.isWeekend || false,
            isHoliday: rate.isHoliday || false,
            gapPromotionApplied: rate.gapPromotionApplied || false,
            gapPromotionRate: rate.gapPromotionRate,
            manualOverride: rate.manualOverride || false,
            basePrice: rate.basePrice || 0,
            occupancyAdjustment: rate.occupancyAdjustment,
            anticipationAdjustment: rate.anticipationAdjustment,
            weekendAdjustment: rate.weekendAdjustment,
            holidayAdjustment: rate.holidayAdjustment,
            gapPromotionAmount: rate.gapPromotionAmount,
            serviceAdjustment: rate.serviceAdjustment
          }))
        }
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        // room eliminado - ya no existe la relación
        mainClient: true,
        nightRates: true
      }
    });

    // Eliminar la consulta original
    await prisma.query.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: 'Consulta convertida a reserva exitosamente',
      reservation
    });
  } catch (error) {
    console.error('Error al convertir consulta a reserva:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Agregar huésped a una consulta
const addGuestToQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const guestData = req.body;

    const guest = await prisma.queryGuest.create({
      data: {
        ...guestData,
        queryId: parseInt(id)
      },
      include: {
        payments: true
      }
    });

    res.status(201).json(guest);
  } catch (error) {
    console.error('Error al agregar huésped a consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar huésped de una consulta
const updateQueryGuest = async (req, res) => {
  try {
    const { id, guestId } = req.params;
    const guestData = req.body;

    const guest = await prisma.queryGuest.update({
      where: { id: parseInt(guestId) },
      data: guestData,
      include: {
        payments: true
      }
    });

    res.json(guest);
  } catch (error) {
    console.error('Error al actualizar huésped de consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar huésped de una consulta
const deleteQueryGuest = async (req, res) => {
  try {
    const { guestId } = req.params;
    await prisma.queryGuest.delete({
      where: { id: parseInt(guestId) }
    });

    res.json({ message: 'Huésped eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar huésped de consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener consultas recientes por cliente (últimos 60 días)
const getQueryByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Calcular fecha hace 60 días
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const queries = await prisma.query.findMany({
      where: { 
        mainClientId: parseInt(clientId),
        updatedAt: {
          gte: sixtyDaysAgo
        }
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        // room eliminado - ya no existe la relación
        mainClient: true,
        nightRates: true
      },
      orderBy: {
        updatedAt: 'desc' // Más recientes primero
      }
    });

    // Retornar array vacío si no hay consultas (no es error)
    res.json(queries);
  } catch (error) {
    console.error('Error al obtener consultas por cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllQueries,
  getQueryById,
  createQuery,
  createMultiSegmentQuery,
  updateMultiSegmentQuery,
  updateQuery,
  deleteQuery,
  convertQueryToReservation,
  addGuestToQuery,
  updateQueryGuest,
  deleteQueryGuest,
  getQueryByClient
}; 