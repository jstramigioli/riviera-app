const {
  authenticateUser,
  createSession,
  destroySession,
  destroyUserSessions,
  publicUser,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE
} = require('../auth/sessionService');
const { PERMISSIONS, roleHasPermission } = require('../auth/permissions');
const prisma = require('../utils/prisma');

function permissionsForRole(role) {
  return Object.keys(PERMISSIONS).filter((key) => roleHasPermission(role, key));
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    const user = await authenticateUser(username, password);

    // Una sesión activa por usuario: al iniciar (o cambiar de usuario) se limpian las anteriores
    await destroyUserSessions(user.id);
    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);

    return res.json({
      user: publicUser(user),
      permissions: permissionsForRole(user.role),
      expiresAt
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.status === 401 ? 'No autenticado' : 'Solicitud inválida',
        message: error.message
      });
    }
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    await destroySession(token);
    clearSessionCookie(res);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res) {
  return res.json({
    user: req.user,
    permissions: permissionsForRole(req.user.role)
  });
}

async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  logout,
  me,
  listUsers
};
