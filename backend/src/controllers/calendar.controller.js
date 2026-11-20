const { loadCalendar } = require('../services/calendarService');
const { todayIsoLocal } = require('../utils/calendarDates');

exports.getCalendar = async (req, res) => {
  try {
    const start = req.query.start || todayIsoLocal(req);
    const days = Number(req.query.days || 35);
    const data = await loadCalendar(start, days);
    res.json(data);
  } catch (error) {
    console.error('Error loading calendar:', error);
    res.status(400).json({ error: error.message || 'Error al cargar calendario' });
  }
};
