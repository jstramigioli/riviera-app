const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Algoritmo de precios dinámicos
function calcularPrecioDinamico(base, ocupacion) {
  if (ocupacion < 0.5) return base * 0.9;
  if (ocupacion > 0.8) return base * 1.15;
  return base;
}

module.exports = {
  // GET /rates?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&roomTypeId= (opcional)
  async getRates(req, res) {
    try {
      const { startDate, endDate, roomTypeId } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate y endDate son requeridos' });
      }
      const where = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
      if (roomTypeId) where.roomTypeId = Number(roomTypeId);
      const rates = await prisma.dailyRate.findMany({
        where,
        include: { roomType: true },
        orderBy: { date: 'asc' },
      });
      res.json(rates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /rates (crear tarifas para uno o varios días)
  async createRates(req, res) {
    try {
      const { startDate, endDate, roomTypeId, price, minStay } = req.body;
      if (!startDate || !endDate || !roomTypeId || !price) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) return res.status(400).json({ error: 'endDate debe ser posterior a startDate' });
      const days = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      const rates = await Promise.all(days.map(async (date) => {
        return prisma.dailyRate.upsert({
          where: { date_roomTypeId: { date, roomTypeId } },
          update: { price, minStay },
          create: { date, roomTypeId, price, minStay },
        });
      }));
      res.status(201).json(rates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // PATCH /rates/:id (actualizar precio o minStay)
  async updateRate(req, res) {
    try {
      const { id } = req.params;
      const { price, minStay } = req.body;
      const rate = await prisma.dailyRate.update({
        where: { id: Number(id) },
        data: { price, minStay },
      });
      res.json(rate);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // DELETE /rates/:id
  async deleteRate(req, res) {
    try {
      const { id } = req.params;
      await prisma.dailyRate.delete({ where: { id: Number(id) } });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Ejemplo de endpoint para sugerir precio dinámico
  async suggestDynamicPrice(req, res) {
    try {
      const { date, roomTypeId, basePrice } = req.body;
      // Calcular ocupación: habitaciones reservadas / habitaciones totales de ese tipo
      const totalRooms = await prisma.room.count({ where: { roomTypeId: Number(roomTypeId) } });
      const reservedRooms = await prisma.reservation.count({
        where: {
          room: { roomTypeId: Number(roomTypeId) },
          checkIn: { lte: new Date(date) },
          checkOut: { gt: new Date(date) },
        },
      });
      const ocupacion = totalRooms ? reservedRooms / totalRooms : 0;
      const precio = calcularPrecioDinamico(Number(basePrice), ocupacion);
      res.json({ precio, ocupacion });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
}; 