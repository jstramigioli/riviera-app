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
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 