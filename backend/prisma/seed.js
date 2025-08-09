const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

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
          tags: ['estándar'],
          maxPeople: 2,
          status: 'available',
          orderIndex: index
        }
      })
    );
  });

  // Departamentos al final
  const departamentos = [
    {
      name: 'El Romerito',
      description: 'Departamento para 2 personas',
      tags: ['departamento', '2-personas'],
      maxPeople: 2,
      status: 'available',
      orderIndex: 34
    },
    {
      name: 'El Tilo',
      description: 'Departamento para 5 personas',
      tags: ['departamento', '5-personas'],
      maxPeople: 5,
      status: 'available',
      orderIndex: 35
    },
    {
      name: 'Via 1',
      description: 'Departamento para 4 personas',
      tags: ['departamento', '4-personas'],
      maxPeople: 4,
      status: 'available',
      orderIndex: 36
    },
    {
      name: 'La Esquinita',
      description: 'Departamento para 4 personas',
      tags: ['departamento', '4-personas'],
      maxPeople: 4,
      status: 'available',
      orderIndex: 37
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

  // Crear clientes con notas
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '+54 11 1234-5678',
        documentType: 'DNI',
        documentNumber: '12345678',
        notes: 'Cliente frecuente, prefiere habitaciones con vista al mar'
      }
    }),
    prisma.client.create({
      data: {
        firstName: 'María',
        lastName: 'González',
        email: 'maria.gonzalez@email.com',
        phone: '+54 11 8765-4321',
        documentType: 'DNI',
        documentNumber: '87654321',
        notes: 'Cliente VIP, solicita servicio de limpieza diario'
      }
    }),
    prisma.client.create({
      data: {
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        email: 'carlos.rodriguez@email.com',
        phone: '+54 11 5555-1234',
        documentType: 'CUIT',
        documentNumber: '20-55551234-5',
        notes: 'Viaja por trabajo, necesita facturación empresarial'
      }
    })
  ]);

  console.log('Clientes creados:', clients.length);

  // Crear reservas con notas
  const today = new Date();
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };
  const reservations = await Promise.all([
    prisma.reservation.create({
      data: {
        roomId: rooms[0].id, // Habitación 1
        mainClientId: clients[0].id,
        checkIn: today,
        checkOut: addDays(today, 2),
        totalAmount: 45000,
        status: 'active',
        reservationType: 'con_desayuno',
        notes: 'Cliente solicita cama king size si es posible',
        fixed: false
      }
    }),
    prisma.reservation.create({
      data: {
        roomId: rooms[34].id, // El Romerito
        mainClientId: clients[1].id,
        checkIn: addDays(today, 1),
        checkOut: addDays(today, 3),
        totalAmount: 75000,
        status: 'active',
        reservationType: 'media_pension',
        notes: 'Departamento para luna de miel, decoración especial',
        fixed: false
      }
    }),
    prisma.reservation.create({
      data: {
        roomId: rooms[35].id, // El Tilo
        mainClientId: clients[2].id,
        checkIn: addDays(today, 2),
        checkOut: addDays(today, 4),
        totalAmount: 120000,
        status: 'finished',
        reservationType: 'con_desayuno',
        notes: 'Familia con niños, solicita cuna adicional',
        fixed: true
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

  // Crear algunos pagos y cargos de ejemplo
  const payments = await Promise.all([
    // Cargo por reserva
    prisma.payment.create({
      data: {
        guestId: guests[0].id,
        amount: 45000,
        type: 'charge',
        description: 'Cargo por reserva #1',
        date: new Date('2024-01-15')
      }
    }),
    // Pago parcial
    prisma.payment.create({
      data: {
        guestId: guests[0].id,
        amount: 30000,
        type: 'payment',
        description: 'Pago parcial en efectivo',
        date: new Date('2024-01-15')
      }
    }),
    // Cargo por consumo
    prisma.payment.create({
      data: {
        guestId: guests[0].id,
        amount: 5000,
        type: 'charge',
        description: 'Cargo por minibar y servicios',
        date: new Date('2024-01-16')
      }
    }),
    // Cargo por reserva
    prisma.payment.create({
      data: {
        guestId: guests[2].id,
        amount: 75000,
        type: 'charge',
        description: 'Cargo por reserva #2',
        date: new Date('2024-01-20')
      }
    }),
    // Pago completo
    prisma.payment.create({
      data: {
        guestId: guests[2].id,
        amount: 75000,
        type: 'payment',
        description: 'Pago completo con tarjeta',
        date: new Date('2024-01-20')
      }
    })
  ]);

  console.log('Pagos creados:', payments.length);

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