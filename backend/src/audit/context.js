const { AsyncLocalStorage } = require('async_hooks');

/** Contexto por request: actor de la sesión auth (PGH-36 / #28). */
const auditStorage = new AsyncLocalStorage();

function runWithAuditContext(context, callback) {
  return auditStorage.run(context || {}, callback);
}

function getAuditContext() {
  return auditStorage.getStore() || null;
}

function buildActorContext(user) {
  if (!user) return {};
  return {
    actorUserId: user.id || null,
    actorUsername: user.username || null,
    actorDisplayName: user.displayName || null,
    actorRole: user.role || null
  };
}

module.exports = {
  auditStorage,
  runWithAuditContext,
  getAuditContext,
  buildActorContext
};
