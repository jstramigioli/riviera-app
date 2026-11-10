const prisma = require('../utils/prisma');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/audit-logs
 * Filtros: entity, entityId, actorUserId, action, from, to, q, limit, cursor
 */
async function listAuditLogs(req, res, next) {
  try {
    const {
      entity,
      entityId,
      actorUserId,
      action,
      from,
      to,
      q,
      cursor
    } = req.query;

    const limit = parseLimit(req.query.limit);
    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    const where = {};
    if (entity) where.entity = String(entity);
    if (entityId) where.entityId = String(entityId);
    if (actorUserId) where.actorUserId = String(actorUserId);
    if (action) where.action = String(action).toUpperCase();

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (q && String(q).trim()) {
      const term = String(q).trim();
      where.OR = [
        { summary: { contains: term, mode: 'insensitive' } },
        { actorUsername: { contains: term, mode: 'insensitive' } },
        { actorDisplayName: { contains: term, mode: 'insensitive' } },
        { entityId: { contains: term, mode: 'insensitive' } }
      ];
    }

    const items = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: String(cursor) },
            skip: 1
          }
        : {})
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return res.json({
      items: page,
      nextCursor,
      limit
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/audit-logs/:id
 */
async function getAuditLogById(req, res, next) {
  try {
    const item = await prisma.auditLog.findUnique({
      where: { id: req.params.id }
    });
    if (!item) {
      return res.status(404).json({ error: 'No encontrado', message: 'Registro de auditoría inexistente' });
    }
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/audit-logs/meta/entities
 * Lista entidades distintas presentes en el log (para filtros UI).
 */
async function listAuditEntities(req, res, next) {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' }
    });
    return res.json(rows.map((r) => r.entity));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  listAuditEntities
};
