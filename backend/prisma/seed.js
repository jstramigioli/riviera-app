const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Primero crear o obtener tipos de habitación
  let roomType = await prisma.roomType.findFirst({
    where: { name: 'Estándar' }
  });

  if (!roomType) {
    roomType = await prisma.roomType.create({
      data: {
        name: 'Estándar',
        description: 'Habitación estándar',
        maxPeople: 2,
        orderIndex: 0
      }
    });
    console.log('Tipo de habitación creado:', roomType);
  } else {
    console.log('Tipo de habitación existente:', roomType);
  }

  // Crear habitaciones del 1 al 36 (excluyendo 4 y 20) en orden
  const roomPromises = [];
  
  // Habitaciones del 1 al 36 (excluyendo 4 y 20) en orden numérico
  const habitacionesNumericas = [];
  for (let i = 1; i <= 36; i++) {
    if (i !== 4 && i !== 20) { // Excluir habitaciones 4 y 20
      habitacionesNumericas.push(i);
    }
  }
  
  // Crear habitaciones en orden
  habitacionesNumericas.forEach((numero, index) => {
    roomPromises.push(
      prisma.room.create({
        data: {
          name: numero.toString(),
          description: `Habitación ${numero}`,
          maxPeople: 2,
          status: 'available',
          orderIndex: index,
          roomTypeId: roomType.id
        }
      })
    );
  });

  // Departamentos al final
  const departamentos = [
    {
      name: 'El Romerito',
      description: 'Departamento para 2 personas',
      maxPeople: 2,
      status: 'available',
      orderIndex: 34,
      roomTypeId: roomType.id
    },
    {
      name: 'El Tilo',
      description: 'Departamento para 5 personas',
      maxPeople: 5,
      status: 'available',
      orderIndex: 35,
      roomTypeId: roomType.id
    },
    {
      name: 'Via 1',
      description: 'Departamento para 4 personas',
      maxPeople: 4,
      status: 'available',
      orderIndex: 36,
      roomTypeId: roomType.id
    },
    {
      name: 'La Esquinita',
      description: 'Departamento para 4 personas',
      maxPeople: 4,
      status: 'available',
      orderIndex: 37,
      roomTypeId: roomType.id
    }
  ];

  departamentos.forEach(depto => {
    roomPromises.push(
      prisma.room.create({
        data: depto
      })
    );
  });

  const rooms = await Promise.all(roomPromises);
  console.log('Habitaciones creadas:', rooms.length);

  // Los clientes ya existen, no los creamos
  console.log('Clientes ya existen en la base de datos');

  // Crear reservas básicas usando clientes existentes
  const reservations = await Promise.all([
    prisma.reservation.create({
      data: {
        mainClientId: 68, // Hector Campagna
        status: 'CONFIRMADA',
        notes: 'Cliente solicita cama king size si es posible'
      }
    }),
    prisma.reservation.create({
      data: {
        mainClientId: 6, // Dora Casarino
        status: 'CONFIRMADA',
        notes: 'Departamento para luna de miel, decoración especial'
      }
    }),
    prisma.reservation.create({
      data: {
        mainClientId: 7, // Pablo Alexis Cano Meza
        status: 'FINALIZADA',
        notes: 'Familia con niños, solicita cuna adicional'
      }
    })
  ]);

  console.log('Reservas creadas:', reservations.length);

  // Crear huéspedes con los nuevos campos
  const guests = await Promise.all([
    prisma.guest.create({
      data: {
        firstName: 'Ana',
        lastName: 'López',
        documentType: 'DNI',
        documentNumber: 'DNI 11111111',
        phone: '+54 11 1111-1111',
        email: 'ana.lopez@email.com',
        address: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        reservationId: reservations[0].id
      }
    }),
    prisma.guest.create({
      data: {
        firstName: 'Pedro',
        lastName: 'Martínez',
        documentType: 'DNI',
        documentNumber: 'DNI 22222222',
        phone: '+54 11 2222-2222',
        email: 'pedro.martinez@email.com',
        address: 'Calle Florida 567',
        city: 'Buenos Aires',
        reservationId: reservations[0].id
      }
    }),
    prisma.guest.create({
      data: {
        firstName: 'Laura',
        lastName: 'Fernández',
        documentType: 'DNI',
        documentNumber: 'DNI 33333333',
        phone: '+54 11 3333-3333',
        email: 'laura.fernandez@email.com',
        address: 'Av. Santa Fe 890',
        city: 'Buenos Aires',
        reservationId: reservations[1].id
      }
    }),
    prisma.guest.create({
      data: {
        firstName: 'Roberto',
        lastName: 'Silva',
        documentType: 'DNI',
        documentNumber: 'DNI 44444444',
        phone: '+54 11 4444-4444',
        email: 'roberto.silva@email.com',
        address: 'Calle San Martín 456',
        city: 'Córdoba',
        reservationId: reservations[2].id
      }
    })
  ]);

  console.log('Huéspedes creados:', guests.length);

  // Crear algunos cargos y pagos de ejemplo usando el nuevo sistema
  const cargos = await Promise.all([
    prisma.cargo.create({
      data: {
        reservaId: reservations[0].id,
        descripcion: 'Alojamiento 2 noches',
        monto: 45000,
        tipo: 'ALOJAMIENTO',
        fecha: new Date('2025-10-26')
      }
    }),
    prisma.cargo.create({
      data: {
        reservaId: reservations[1].id,
        descripcion: 'Departamento 2 noches',
        monto: 75000,
        tipo: 'ALOJAMIENTO',
        fecha: new Date('2025-10-27')
      }
    })
  ]);

  const pagos = await Promise.all([
    prisma.pago.create({
      data: {
        reservaId: reservations[0].id,
        monto: 20000,
        moneda: 'ARS',
        montoARS: 20000,
        metodo: 'Transferencia',
        fecha: new Date('2025-10-26')
      }
    }),
    prisma.pago.create({
      data: {
        reservaId: reservations[1].id,
        monto: 100,
        moneda: 'USD',
        tipoCambio: 1000,
        montoARS: 100000,
        metodo: 'Tarjeta',
        fecha: new Date('2025-10-27')
      }
    })
  ]);

  console.log('Cargos creados:', cargos.length);
  console.log('Pagos creados:', pagos.length);

  console.log('Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 