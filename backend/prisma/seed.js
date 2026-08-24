const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed MVP...');

  const hotel = await prisma.hotel.upsert({
    where: { id: 'default-hotel' },
    update: { name: 'Hotel Riviera', isActive: true },
    create: {
      id: 'default-hotel',
      name: 'Hotel Riviera',
      description: 'Hotel principal',
      address: 'Av. Costanera 123',
      phone: '+54 11 1234-5678',
      email: 'info@hotelriviera.com',
      website: 'https://hotelriviera.com',
      isActive: true
    }
  });
  console.log('Hotel:', hotel.id);

  await prisma.roundingConfig.upsert({
    where: { hotelId: hotel.id },
    update: {},
    create: { hotelId: hotel.id, multiple: 100, mode: 'nearest' }
  });

  await prisma.dynamicPricingConfig.upsert({
    where: { hotelId: hotel.id },
    update: {},
    create: {
      hotelId: hotel.id,
      enabled: false,
      anticipationThresholds: [7, 14, 30],
      anticipationWeight: 0.2,
      globalOccupancyWeight: 0.3,
      isWeekendWeight: 0.15,
      isHolidayWeight: 0.25,
      weatherScoreWeight: 0.05,
      eventImpactWeight: 0.05,
      maxAdjustmentPercentage: 30
    }
  });

  await prisma.configuracion.upsert({
    where: { clave: 'tipo_cambio_usd' },
    update: { valor: '1200', descripcion: 'Tipo de cambio USD' },
    create: {
      clave: 'tipo_cambio_usd',
      valor: '1200',
      descripcion: 'Tipo de cambio USD',
      activo: true
    }
  });

  let roomType = await prisma.roomType.findFirst({ where: { name: 'Estándar' } });
  if (!roomType) {
    roomType = await prisma.roomType.create({
      data: {
        name: 'Estándar',
        description: 'Habitación estándar',
        maxPeople: 2,
        orderIndex: 0
      }
    });
    console.log('Tipo de habitación creado');
  }

  const existingRooms = await prisma.room.count();
  if (existingRooms === 0) {
    const roomPromises = [];
    for (let i = 1; i <= 36; i++) {
      if (i === 4 || i === 20) continue;
      roomPromises.push(
        prisma.room.create({
          data: {
            name: String(i),
            description: `Habitación ${i}`,
            maxPeople: 2,
            status: 'available',
            orderIndex: i,
            roomTypeId: roomType.id
          }
        })
      );
    }
    const departamentos = [
      { name: 'El Romerito', maxPeople: 2, orderIndex: 34 },
      { name: 'El Tilo', maxPeople: 5, orderIndex: 35 },
      { name: 'Via 1', maxPeople: 4, orderIndex: 36 },
      { name: 'La Esquinita', maxPeople: 4, orderIndex: 37 }
    ];
    departamentos.forEach((d) => {
      roomPromises.push(
        prisma.room.create({
          data: {
            name: d.name,
            description: `Departamento ${d.name}`,
            maxPeople: d.maxPeople,
            status: 'available',
            orderIndex: d.orderIndex,
            roomTypeId: roomType.id
          }
        })
      );
    });
    await Promise.all(roomPromises);
    console.log('Habitaciones creadas:', roomPromises.length);
  } else {
    console.log('Habitaciones existentes:', existingRooms);
  }

  let serviceTypes = await prisma.serviceType.findMany({ where: { hotelId: hotel.id } });
  if (serviceTypes.length === 0) {
    serviceTypes = await Promise.all([
      prisma.serviceType.create({
        data: { hotelId: hotel.id, name: 'Solo Alojamiento', description: 'Sin servicios', orderIndex: 1 }
      }),
      prisma.serviceType.create({
        data: { hotelId: hotel.id, name: 'Con Desayuno', description: 'Incluye desayuno', orderIndex: 2 }
      }),
      prisma.serviceType.create({
        data: { hotelId: hotel.id, name: 'Media Pensión', description: 'Desayuno y cena', orderIndex: 3 }
      })
    ]);
    console.log('Tipos de servicio creados');
  }

  if ((await prisma.subcategoriaCargo.count()) === 0) {
    await prisma.subcategoriaCargo.createMany({
      data: [
        { tipo: 'SERVICIO', codigo: 'SPA', nombre: 'Spa', color: '#4caf50', ordenIndex: 1 },
        { tipo: 'CONSUMO', codigo: 'BEBIDAS', nombre: 'Bebidas', color: '#2196f3', ordenIndex: 1 },
        { tipo: 'CONSUMO', codigo: 'MINIBAR', nombre: 'Minibar', color: '#03a9f4', ordenIndex: 2 },
        { tipo: 'OTRO', codigo: 'EXTRA', nombre: 'Extra', color: '#9e9e9e', ordenIndex: 1 }
      ]
    });
    console.log('Subcategorías de cargo creadas');
  }

  if ((await prisma.client.count()) === 0) {
    await prisma.client.createMany({
      data: [
        {
          firstName: 'María',
          lastName: 'García',
          email: 'maria@example.com',
          phone: '+54 11 5555-0001',
          documentType: 'DNI',
          documentNumber: '30111222',
          country: 'Argentina',
          province: 'Buenos Aires',
          city: 'CABA'
        },
        {
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@example.com',
          phone: '+54 11 5555-0002',
          documentType: 'DNI',
          documentNumber: '28999888',
          country: 'Argentina',
          province: 'Buenos Aires',
          city: 'La Plata'
        },
        {
          firstName: 'Ana',
          lastName: 'López',
          email: 'ana@example.com',
          phone: '+54 11 5555-0003',
          documentType: 'DNI',
          documentNumber: '33444555',
          country: 'Argentina',
          province: 'Córdoba',
          city: 'Córdoba'
        }
      ]
    });
    console.log('Clientes de ejemplo creados');
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  let block = await prisma.seasonBlock.findFirst({
    where: { hotelId: hotel.id, name: 'Temporada MVP' }
  });

  if (!block) {
    block = await prisma.seasonBlock.create({
      data: {
        hotelId: hotel.id,
        name: 'Temporada MVP',
        description: 'Bloque base para desarrollo',
        startDate: start,
        endDate: end,
        orderIndex: 0,
        useProportions: false,
        serviceAdjustmentMode: 'PERCENTAGE',
        isDraft: false
      }
    });

    const roomTypes = await prisma.roomType.findMany();
    for (const rt of roomTypes) {
      for (const st of serviceTypes) {
        const base = st.orderIndex === 1 ? 50000 : st.orderIndex === 2 ? 60000 : 75000;
        await prisma.seasonPrice.create({
          data: {
            seasonBlockId: block.id,
            roomTypeId: rt.id,
            serviceTypeId: st.id,
            basePrice: base,
            isDraft: false
          }
        });
      }
    }

    await prisma.blockServiceSelection.createMany({
      data: serviceTypes.map((st, idx) => ({
        seasonBlockId: block.id,
        serviceTypeId: st.id,
        orderIndex: idx,
        isEnabled: true,
        isDraft: false
      })),
      skipDuplicates: true
    });
    console.log('Bloque de temporada MVP creado');
  }

  if ((await prisma.reservation.count()) === 0) {
    const clients = await prisma.client.findMany({ take: 1 });
    const rooms = await prisma.room.findMany({ take: 1, orderBy: { orderIndex: 'asc' } });
    const breakfast = serviceTypes.find((s) => s.orderIndex === 2) || serviceTypes[0];

    if (clients.length && rooms.length) {
      const checkIn = new Date(start);
      checkIn.setDate(checkIn.getDate() + 2);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      await prisma.reservation.create({
        data: {
          mainClientId: clients[0].id,
          status: 'CONFIRMADA',
          notes: 'Reserva de ejemplo MVP',
          segments: {
            create: [{
              roomId: rooms[0].id,
              roomTypeId: rooms[0].roomTypeId,
              startDate: checkIn,
              endDate: checkOut,
              services: [breakfast.id],
              guestCount: 2,
              baseRate: 60000
            }]
          }
        }
      });
      console.log('Reserva de ejemplo creada');
    }
  }

  console.log('Seed MVP completado.');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
