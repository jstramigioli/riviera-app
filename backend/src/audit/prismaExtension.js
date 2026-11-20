const { AUDITED_ENTITIES, WRITE_OPS } = require('./entities');
const { getAuditContext } = require('./context');
const {
  toPlain,
  entityIdFromRecord,
  entityIdFromArgs,
  computeDiff,
  buildSummary
} = require('./serialize');

function actionFromOperation(operation) {
  switch (operation) {
    case 'create':
      return 'CREATE';
    case 'createMany':
      return 'CREATE_MANY';
    case 'update':
      return 'UPDATE';
    case 'updateMany':
      return 'UPDATE_MANY';
    case 'upsert':
      return 'UPSERT';
    case 'delete':
      return 'DELETE';
    case 'deleteMany':
      return 'DELETE_MANY';
    default:
      return String(operation || 'WRITE').toUpperCase();
  }
}

function delegateFor(baseClient, model) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  return baseClient[key];
}

async function loadBefore(baseClient, model, args) {
  const delegate = delegateFor(baseClient, model);
  if (!delegate?.findUnique || !args?.where) return null;
  try {
    // Solo where con id escalar / unique conocida
    return await delegate.findUnique({ where: args.where });
  } catch {
    return null;
  }
}

async function persistAudit(baseClient, entry) {
  try {
    await baseClient.auditLog.create({ data: entry });
  } catch (error) {
    // Nunca romper la mutación de negocio por fallo de auditoría
    console.error('[audit] no se pudo persistir AuditLog:', error.message);
  }
}

/**
 * Extensión Prisma: intercepta writes de entidades clave y escribe AuditLog
 * usando el actor del AsyncLocalStorage (seteado en requireAuth).
 */
function createAuditExtension(baseClient) {
  return {
    name: 'rivieraAudit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === 'AuditLog' || model === 'Session') {
            return query(args);
          }
          if (!AUDITED_ENTITIES.has(model) || !WRITE_OPS.has(operation)) {
            return query(args);
          }

          const actor = getAuditContext() || {};
          const action = actionFromOperation(operation);
          let before = null;

          if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
            before = await loadBefore(baseClient, model, args);
          }

          const result = await query(args);

          const beforePlain = before ? toPlain(before) : null;
          let afterPlain = null;
          let entityId = entityIdFromArgs(args) || entityIdFromRecord(before);

          if (result && typeof result === 'object' && !Array.isArray(result) && result.count === undefined) {
            afterPlain = toPlain(result);
            entityId = entityIdFromRecord(result) || entityId;
          } else if (operation === 'createMany' || operation === 'updateMany' || operation === 'deleteMany') {
            afterPlain = toPlain(result);
          } else if (operation === 'delete' && beforePlain) {
            afterPlain = null;
          }

          const diff = computeDiff(beforePlain, afterPlain);
          const summary = buildSummary(action, model, beforePlain, afterPlain, entityId);

          await persistAudit(baseClient, {
            actorUserId: actor.actorUserId || null,
            actorUsername: actor.actorUsername || null,
            actorDisplayName: actor.actorDisplayName || null,
            actorRole: actor.actorRole || null,
            action,
            entity: model,
            entityId,
            summary,
            before: beforePlain,
            after: afterPlain,
            diff,
            meta: {
              operation,
              where: args?.where ? toPlain(args.where) : undefined,
              count: result && typeof result === 'object' ? result.count : undefined
            }
          });

          return result;
        }
      }
    }
  };
}

module.exports = {
  createAuditExtension
};
