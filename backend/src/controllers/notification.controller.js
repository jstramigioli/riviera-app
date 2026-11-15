const prisma = require('../utils/prisma');
const { syncOperationalNotifications } = require('../services/notificationSync');

function todayIsoUtc() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function serializeNotification(row, userId) {
  const read = (row.reads || []).find((r) => r.userId === userId);
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    linkType: row.linkType,
    linkId: row.linkId,
    audienceRole: row.audienceRole,
    source: row.source,
    meta: row.meta,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    resolvedById: row.resolvedById,
    readAt: read?.readAt || null,
    isRead: Boolean(read),
    isResolved: Boolean(row.resolvedAt)
  };
}

/**
 * GET /api/notifications
 * Filtros: resolved=open|resolved|all, read=unread|read|all, type, severity, q, limit
 */
async function listNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const resolved = String(req.query.resolved || 'open').toLowerCase();
    const read = String(req.query.read || 'all').toLowerCase();
    const type = req.query.type ? String(req.query.type) : null;
    const severity = req.query.severity
      ? String(req.query.severity).toUpperCase()
      : null;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 100)
    );

    const where = {};
    if (resolved === 'open') where.resolvedAt = null;
    else if (resolved === 'resolved') where.resolvedAt = { not: null };

    if (type) where.type = type;
    if (severity) where.severity = severity;

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } }
      ];
    }

    // audience: propias del rol o globales
    const role = req.user.role;
    where.AND = [
      {
        OR: [{ audienceRole: null }, { audienceRole: role }]
      }
    ];

    if (read === 'unread') {
      where.reads = { none: { userId } };
    } else if (read === 'read') {
      where.reads = { some: { userId } };
    }

    const rows = await prisma.appNotification.findMany({
      where,
      include: {
        reads: { where: { userId } }
      },
      orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
      take: limit
    });

    res.json({
      data: rows.map((r) => serializeNotification(r, userId)),
      meta: { count: rows.length, resolved, read }
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/notifications/sync  body/query: { date?: yyyy-MM-dd } */
async function syncNotifications(req, res, next) {
  try {
    const date =
      (req.body && req.body.date) ||
      req.query.date ||
      todayIsoUtc();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date inválida (yyyy-MM-dd)' });
    }
    const result = await syncOperationalNotifications(String(date));
    res.json({ ok: true, date: String(date), ...result });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const id = String(req.params.id);
    const userId = req.user.id;
    const exists = await prisma.appNotification.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Notificación no encontrada' });

    await prisma.notificationRead.upsert({
      where: {
        notificationId_userId: { notificationId: id, userId }
      },
      create: { notificationId: id, userId },
      update: { readAt: new Date() }
    });

    const row = await prisma.appNotification.findUnique({
      where: { id },
      include: { reads: { where: { userId } } }
    });
    res.json(serializeNotification(row, userId));
  } catch (error) {
    next(error);
  }
}

async function markUnread(req, res, next) {
  try {
    const id = String(req.params.id);
    const userId = req.user.id;
    await prisma.notificationRead.deleteMany({
      where: { notificationId: id, userId }
    });
    const row = await prisma.appNotification.findUnique({
      where: { id },
      include: { reads: { where: { userId } } }
    });
    if (!row) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(serializeNotification(row, userId));
  } catch (error) {
    next(error);
  }
}

async function resolveNotification(req, res, next) {
  try {
    const id = String(req.params.id);
    const userId = req.user.id;
    const row = await prisma.appNotification.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedById: userId
      },
      include: { reads: { where: { userId } } }
    }).catch((err) => {
      if (err.code === 'P2025') return null;
      throw err;
    });
    if (!row) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(serializeNotification(row, userId));
  } catch (error) {
    next(error);
  }
}

async function unresolveNotification(req, res, next) {
  try {
    const id = String(req.params.id);
    const userId = req.user.id;
    const row = await prisma.appNotification.update({
      where: { id },
      data: {
        resolvedAt: null,
        resolvedById: null
      },
      include: { reads: { where: { userId } } }
    }).catch((err) => {
      if (err.code === 'P2025') return null;
      throw err;
    });
    if (!row) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(serializeNotification(row, userId));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  syncNotifications,
  markRead,
  markUnread,
  resolveNotification,
  unresolveNotification
};
