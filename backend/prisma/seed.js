const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = [
    
    {
      name: "1",
      description: "",
      tags: ['planta baja', 'habitacion', 'triple', 'vista a patio interno', 'vista a jardin', 'departamento hotelero'],
      maxPeople: 3,
      status: "available"
    },
    {
        name: "2",
        description: "",
        tags: ['planta baja', 'habitacion', 'doble', 'vista a pasillo lateral'],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "3",
        description: "",
        tags: ['planta baja', 'habitacion', 'triple', 'vista a pasillo lateral'],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "5",
        description: "",
        tags: ['planta baja', 'cuadruple', 'vista a patio interno', 'acceso por patio interno', 'escalera', 'departamento hotelero'],
        maxPeople: 4,
        status: "available"
      },
      {
        name: "6",
        description: "",
        tags: ['planta baja', 'cuadruple', 'departamento hotelero'],
        maxPeople: 4,
        status: "available"
      },
      {
        name: "7",
        description: "",
        tags: ['planta baja', 'habitacion', 'doble', 'vista a pasillo lateral'],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "8",
        description: "",
        tags: ['planta alta', 'habitacion', 'doble', 'vista a la calle', 'pequeña'],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "9",
        description: "",
        tags: ['planta alta', 'habitacion', 'doble', 'vista a la calle', 'pequeña'],
        maxPeople: 2,
        status: "available"
      },   
      {
        name: "10",
        description: "",
        tags: ['planta alta', 'habitacion', 'doble'],
        maxPeople: 2,
        status: "available"
      },  
      {
        name: "11",
        description: "",
        tags: ['planta alta', 'habitacion', 'triple'],
        maxPeople: 3,
        status: "available"
      },  
      {
        name: "12",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "13",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "14",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "15",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "16",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "17",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "18",
        description: "",
        tags: ["planta alta", "habitacion", "cuadruple"],
        maxPeople: 4,
        status: "available"
      },
      {
        name: "19",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "21",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "22",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "23",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "24",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "25",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "26",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "27",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "28",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "29",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "30",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "31",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "32",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "33",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "34",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      },
      {
        name: "35",
        description: "",
        tags: ["planta alta", "habitacion", "triple"],
        maxPeople: 3,
        status: "available"
      },
      {
        name: "36",
        description: "",
        tags: ["planta alta", "habitacion", "doble"],
        maxPeople: 2,
        status: "available"
      }
  ];

  for (const room of rooms) {
    await prisma.room.create({ data: room });
  }
  console.log("Rooms seeded successfully.");

  const clients = [
    {
      firstName: "Juan",
      lastName: "Pérez",
      email: "juan.perez@email.com",
      phone: "123456789",
      document: "DNI 12345678"
    },
    {
      firstName: "María",
      lastName: "García",
      email: "maria.garcia@email.com",
      phone: "987654321",
      document: "DNI 87654321"
    },
    {
      firstName: "Carlos",
      lastName: "López",
      email: "carlos.lopez@email.com",
      phone: "555666777",
      document: "DNI 55566677"
    },
    {
      firstName: "Ana",
      lastName: "Martínez",
      email: "ana.martinez@email.com",
      phone: "111222333",
      document: "DNI 11122233"
    }
  ];

  const createdClients = [];
  for (const client of clients) {
    const createdClient = await prisma.client.create({ data: client });
    createdClients.push(createdClient);
  }
  console.log("Clients seeded successfully.");

  const today = new Date();
  const reservations = [
    {
      roomId: 1,
      mainClientId: createdClients[0].id,
      checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
      checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
      totalAmount: 45000,
      status: "active",
      guests: [
        { firstName: "Laura", lastName: "Pérez" }
      ]
    },
    {
      roomId: 3,
      mainClientId: createdClients[1].id,
      checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
      checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3),
      totalAmount: 60000,
      status: "active",
      guests: [
        { firstName: "Pedro", lastName: "García" },
        { firstName: "Sofía", lastName: "García" }
      ]
    },
    {
      roomId: 5,
      mainClientId: createdClients[2].id,
      checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
      checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12),
      totalAmount: 75000,
      status: "active",
      guests: [
        { firstName: "Roberto", lastName: "López" }
      ]
    },
    {
      roomId: 8,
      mainClientId: createdClients[3].id,
      checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3),
      checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      totalAmount: 90000,
      status: "active",
      guests: [
        { firstName: "Elena", lastName: "Martínez" },
        { firstName: "Miguel", lastName: "Martínez" },
        { firstName: "Carmen", lastName: "Martínez" }
      ]
    }
  ];

  for (const reservation of reservations) {
    await prisma.reservation.create({
      data: {
        roomId: reservation.roomId,
        mainClientId: reservation.mainClientId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        totalAmount: reservation.totalAmount,
        status: reservation.status,
        guests: {
          create: reservation.guests
        }
      }
    });
  }
  console.log("Reservations seeded successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 