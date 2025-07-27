const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class OperationalPeriodController {
  /**
   * Obtener todos los períodos operacionales de un hotel
   */
  async getOperationalPeriods(req, res) {
    try {
      const { hotelId } = req.params;
      
      const periods = await prisma.operationalPeriod.findMany({
        where: { hotelId },
        orderBy: { startDate: 'asc' }
      });

      res.json(periods);
    } catch (error) {
      console.error('Error al obtener períodos operacionales:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear un nuevo período operacional
   */
  async createOperationalPeriod(req, res) {
    try {
      const { hotelId } = req.params;
      const { startDate, endDate, label } = req.body;

      // Validar que las fechas sean válidas
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Fechas inválidas' });
      }

      if (start >= end) {
        return res.status(400).json({ message: 'La fecha de inicio debe ser anterior a la fecha de fin' });
      }

      // Verificar si hay solapamiento con períodos existentes
      const overlappingPeriod = await prisma.operationalPeriod.findFirst({
        where: {
          hotelId,
          OR: [
            {
              AND: [
                { startDate: { lte: start } },
                { endDate: { gt: start } }
              ]
            },
            {
              AND: [
                { startDate: { lt: end } },
                { endDate: { gte: end } }
              ]
            },
            {
              AND: [
                { startDate: { gte: start } },
                { endDate: { lte: end } }
              ]
            }
          ]
        }
      });

      if (overlappingPeriod) {
        return res.status(409).json({ 
          message: 'Existe un período que se solapa con las fechas especificadas',
          overlappingPeriod 
        });
      }

      const period = await prisma.operationalPeriod.create({
        data: {
          hotelId,
          startDate: start,
          endDate: end,
          label
        }
      });

      res.status(201).json(period);
    } catch (error) {
      console.error('Error al crear período operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar un período operacional
   */
  async updateOperationalPeriod(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate, label } = req.body;

      // Validar que las fechas sean válidas
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Fechas inválidas' });
      }

      if (start >= end) {
        return res.status(400).json({ message: 'La fecha de inicio debe ser anterior a la fecha de fin' });
      }

      const period = await prisma.operationalPeriod.update({
        where: { id },
        data: {
          startDate: start,
          endDate: end,
          label
        }
      });

      res.json(period);
    } catch (error) {
      console.error('Error al actualizar período operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar un período operacional
   */
  async deleteOperationalPeriod(req, res) {
    try {
      const { id } = req.params;

      await prisma.operationalPeriod.delete({
        where: { id }
      });

      res.json({ message: 'Período operacional eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar período operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

module.exports = new OperationalPeriodController(); 