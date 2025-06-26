const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const roomRoutes = require('./routes/room.routes');
const clientRoutes = require('./routes/client.routes');
const reservationRoutes = require('./routes/reservation.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

async function testDbConnection() {
  try {
    await prisma.$connect();
    console.log('Conexión a la base de datos exitosa');
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    process.exit(1);
  }
}

testDbConnection();

// Rutas de ejemplo
app.get('/', (req, res) => {
  res.send('API del Hotel Riviera funcionando');
});

// Aquí se agregarán las rutas de la API
app.use('/api/rooms', roomRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/reservations', reservationRoutes);

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
}); 