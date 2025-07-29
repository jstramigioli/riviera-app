const express = require('express');
const cors = require('cors');
const roomRoutes = require('./routes/room.routes');
const roomTypeRoutes = require('./routes/roomType.routes');
const tagRoutes = require('./routes/tag.routes');
const clientRoutes = require('./routes/client.routes');
const reservationRoutes = require('./routes/reservation.routes');
const guestRoutes = require('./routes/guest.routes');
const paymentRoutes = require('./routes/payment.routes');
const rateRoutes = require('./routes/rate.routes');
const openDayRoutes = require('./routes/openDay.routes');
const operationalPeriodRoutes = require('./routes/operationalPeriod.routes');
const dynamicPricingRoutes = require('./routes/dynamicPricing.routes');
const hotelRoutes = require('./routes/hotel.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Middlewares
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Rutas
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/open-days', openDayRoutes);
app.use('/api/operational-periods', operationalPeriodRoutes);
app.use('/api/dynamic-pricing', dynamicPricingRoutes);
app.use('/api/hotel', hotelRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware de manejo de errores (debe ir después de todas las rutas)
app.use(errorHandler);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe`
  });
});

module.exports = app; 