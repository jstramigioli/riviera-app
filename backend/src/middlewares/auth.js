const {
  SESSION_COOKIE,
  findSessionUser,
  publicUser
} = require('../auth/sessionService');
const { roleHasPermission } = require('../auth/permissions');
const { runWithAuditContext, buildActorContext } = require('../audit/context');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    const result = await findSessionUser(token);
    if (!result) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Iniciá sesión para continuar'
      });
    }

    req.authToken = token;
    req.session = result.session;
    req.user = publicUser(result.user);

    // Propaga el actor al AsyncLocalStorage para que la extensión Prisma registre quién mutó.
    return runWithAuditContext(buildActorContext(result.user), () => next());
  } catch (error) {
    return next(error);
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Iniciá sesión para continuar'
      });
    }

    if (!roleHasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: 'Sin permiso',
        message: `Tu rol (${req.user.role}) no puede realizar esta acción`
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requirePermission
};
