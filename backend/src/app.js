const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const roomRoutes = require('./routes/room.routes');
const roomTypeRoutes = require('./routes/roomType.routes');
const tagRoutes = require('./routes/tag.routes');
const clientRoutes = require('./routes/client.routes');
const reservationRoutes = require('./routes/reservation.routes');
const guestRoutes = require('./routes/guest.routes');
const reservationPaymentsRoutes = require('./routes/reservationPayments.routes');
const rateRoutes = require('./routes/rate.routes');
const openDayRoutes = require('./routes/openDay.routes');
const operationalPeriodRoutes = require('./routes/operationalPeriod.routes');
const dynamicPricingRoutes = require('./routes/dynamicPricing.routes');
const hotelRoutes = require('./routes/hotel.routes');
const rateTypeRoutes = require('./routes/rateType.routes');
const serviceTypeRoutes = require('./routes/serviceType.routes');
const seasonBlockRoutes = require('./routes/seasonBlock.routes');
const blockServiceTypeRoutes = require('./routes/blockServiceType.routes');
const blockServiceSelectionRoutes = require('./routes/blockServiceSelection.routes');
const tariffCalculationRoutes = require('./routes/tariffCalculation.routes');
const queryRoutes = require('./routes/query.routes');
const reservationSegmentRoutes = require('./routes/reservationSegment.routes');
const multiRoomReservationRoutes = require('./routes/multiRoomReservation.routes');
const virtualRoomRoutes = require('./routes/virtualRoom.routes');
const configuracionRoutes = require('./routes/configuracion.routes');
const tipoCargoRoutes = require('./routes/tipoCargoRoutes');
const subcategoriaCargoRoutes = require('./routes/subcategoriaCargoRoutes');
const alojamientoRoutes = require('./routes/alojamientoRoutes');
const calendarRoutes = require('./routes/calendar.routes');
const authRoutes = require('./routes/auth.routes');
const { requireAuth, requirePermission } = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Middlewares
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

const ops = [requireAuth];
const tarifas = [requireAuth, requirePermission('tarifas')];
const settings = [requireAuth, requirePermission('settings')];
const finanzas = [requireAuth, requirePermission('finanzas')];
const clientes = [requireAuth, requirePermission('clientes')];
const reservas = [requireAuth, requirePermission('reservas')];

// Auth (login público; me/logout/users protegidos dentro del router)
app.use('/api/auth', authRoutes);

// Rutas operativas
app.use('/api/rooms', ops, roomRoutes);
app.use('/api/room-types', ops, roomTypeRoutes);
app.use('/api/tags', ops, tagRoutes);
app.use('/api/clients', clientes, clientRoutes);
app.use('/api/reservations', reservas, reservationRoutes);
app.use('/api/guests', clientes, guestRoutes);
app.use('/api/reservation-payments', finanzas, reservationPaymentsRoutes);
app.use('/api/rates', tarifas, rateRoutes);
app.use('/api/open-days', settings, openDayRoutes);
app.use('/api/operational-periods', settings, operationalPeriodRoutes);
app.use('/api/dynamic-pricing', tarifas, dynamicPricingRoutes);
app.use('/api/hotel', settings, hotelRoutes);
app.use('/api/rate-types', tarifas, rateTypeRoutes);
app.use('/api/service-types', tarifas, serviceTypeRoutes);
app.use('/api/season-blocks', tarifas, seasonBlockRoutes);
app.use('/api/block-service-types', tarifas, blockServiceTypeRoutes);
app.use('/api/block-service-selections', tarifas, blockServiceSelectionRoutes);
app.use('/api/tariff-calculations', tarifas, tariffCalculationRoutes);
app.use('/api/queries', reservas, queryRoutes);
app.use('/api/reservation-segments', reservas, reservationSegmentRoutes);
app.use('/api/multi-room-reservations', reservas, multiRoomReservationRoutes);
app.use('/api/virtual-rooms', settings, virtualRoomRoutes);
app.use('/api/configuracion', settings, configuracionRoutes);
app.use('/api/tipo-cargo', finanzas, tipoCargoRoutes);
app.use('/api/subcategoria-cargo', settings, subcategoriaCargoRoutes);
app.use('/api/alojamiento', finanzas, alojamientoRoutes);
app.use('/api/calendar', ops, calendarRoutes);

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
