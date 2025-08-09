const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const priceService = require('../services/priceService');

class OpenDayController {
  /**
   * Obtener todos los días de apertura de un hotel
   */
  async getOpenDays(req, res) {
    try {
      const { hotelId } = req.params;
      
      const openDays = await prisma.openDay.findMany({
        where: { hotelId },
        orderBy: { date: 'asc' }
      });

      res.json(openDays);
    } catch (error) {
      console.error('Error al obtener días de apertura:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear un nuevo día de apertura
   */
  async createOpenDay(req, res) {
    try {
      const { hotelId } = req.params;
      const { date, isClosed, isHoliday, fixedPrice, notes } = req.body;

      // Corregir el problema de zona horaria: crear fecha con formato específico
      const localDate = new Date(date + 'T00:00:00');

      // Verificar si ya existe un registro para esta fecha
      const existingOpenDay = await prisma.openDay.findFirst({
        where: {
          hotelId,
          date: localDate
        }
      });

      if (existingOpenDay) {
        return res.status(409).json({ 
          message: 'Ya existe un registro para esta fecha',
          existingOpenDay 
        });
      }

      const openDay = await prisma.openDay.create({
        data: {
          hotelId,
          date: localDate,
          isClosed: isClosed ?? true,
          isHoliday: isHoliday ?? false,
          fixedPrice: fixedPrice ? parseInt(fixedPrice) : null,
          notes
        }
      });

      res.status(201).json(openDay);
    } catch (error) {
      console.error('Error al crear día de apertura:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar un día de apertura
   */
  async updateOpenDay(req, res) {
    try {
      const { id } = req.params;
      const { date, isClosed, isHoliday, fixedPrice, notes } = req.body;

      // Corregir el problema de zona horaria: crear fecha con formato específico
      const localDate = new Date(date + 'T00:00:00');

      const openDay = await prisma.openDay.update({
        where: { id: parseInt(id) },
        data: {
          date: localDate,
          isClosed: isClosed ?? true,
          isHoliday: isHoliday ?? false,
          fixedPrice: fixedPrice ? parseInt(fixedPrice) : null,
          notes
        }
      });

      res.json(openDay);
    } catch (error) {
      console.error('Error al actualizar día de apertura:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar un día de apertura
   */
  async deleteOpenDay(req, res) {
    try {
      const { id } = req.params;

      await prisma.openDay.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'Día de apertura eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar día de apertura:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear múltiples días de apertura (para períodos)
   */
  async createOpenDayPeriod(req, res) {
    try {
      const { hotelId } = req.params;
      const { startDate, endDate, isClosed, isHoliday, fixedPrice, notes } = req.body;

      // Corregir el problema de zona horaria: crear fechas con formato específico
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const openDays = [];

      // Crear registros para cada día del período
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        // Crear la fecha con formato específico para que se guarde correctamente
        const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        
        // Verificar si ya existe un registro para esta fecha
        const existingOpenDay = await prisma.openDay.findFirst({
          where: {
            hotelId,
            date: currentDate
          }
        });

        if (!existingOpenDay) {
          const openDay = await prisma.openDay.create({
            data: {
              hotelId,
              date: currentDate,
              isClosed: isClosed ?? true,
              isHoliday: isHoliday ?? false,
              fixedPrice: fixedPrice ? parseInt(fixedPrice) : null,
              notes
            }
          });
          openDays.push(openDay);
        }
      }

      res.status(201).json({
        message: `${openDays.length} días de apertura creados`,
        openDays
      });
    } catch (error) {
      console.error('Error al crear período de apertura:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

module.exports = new OpenDayController(); 