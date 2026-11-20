const bcrypt = require('bcryptjs');
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
const { ACTIVE_ROLES, isActiveRole, rolesCatalog, ROLES } = require('../auth/roles');
const prisma = require('../utils/prisma');

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
const MIN_PASSWORD_LEN = 6;

function permissionsForRole(role) {
  return Object.keys(PERMISSIONS).filter((key) => roleHasPermission(role, key));
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function normalizeDisplayName(raw) {
  return String(raw || '').trim();
}

function parseIsActive(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

async function countActiveAdmins(excludeId = null) {
  return prisma.user.count({
    where: {
      role: ROLES.ADMIN,
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {})
    }
  });
}

function validateUsername(username) {
  if (!USERNAME_RE.test(username)) {
    throw badRequest(
      'Usuario inválido: usá 3–40 caracteres (minúsculas, números, . _ -)'
    );
  }
}

function validatePassword(password, { required }) {
  if (!password) {
    if (required) throw badRequest('La contraseña es obligatoria');
    return null;
  }
  if (String(password).length < MIN_PASSWORD_LEN) {
    throw badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres`);
  }
  return String(password);
}

function validateAssignableRole(role) {
  if (!isActiveRole(role)) {
    throw badRequest(
      `Rol no asignable. Roles activos: ${ACTIVE_ROLES.join(', ')}`
    );
  }
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
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
      select: USER_SELECT
    });
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

async function listRoles(req, res) {
  return res.json({
    roles: rolesCatalog(),
    activeRoles: ACTIVE_ROLES
  });
}

async function createUser(req, res, next) {
  try {
    const body = req.body || {};
    const username = normalizeUsername(body.username);
    const displayName = normalizeDisplayName(body.displayName);
    const role = String(body.role || '').trim().toUpperCase();
    const password = validatePassword(body.password, { required: true });
    const isActive = parseIsActive(body.isActive, true);

    validateUsername(username);
    if (!displayName) throw badRequest('El nombre para mostrar es obligatorio');
    validateAssignableRole(role);

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw conflict('Ya existe un usuario con ese nombre');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        displayName,
        role,
        passwordHash,
        isActive
      },
      select: USER_SELECT
    });

    return res.status(201).json(user);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.status === 409 ? 'Conflicto' : 'Solicitud inválida',
        message: error.message
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflicto',
        message: 'Ya existe un usuario con ese nombre'
      });
    }
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('Usuario no encontrado');

    const data = {};

    if (body.displayName !== undefined) {
      const displayName = normalizeDisplayName(body.displayName);
      if (!displayName) throw badRequest('El nombre para mostrar es obligatorio');
      data.displayName = displayName;
    }

    if (body.username !== undefined) {
      const username = normalizeUsername(body.username);
      validateUsername(username);
      if (username !== existing.username) {
        const clash = await prisma.user.findUnique({ where: { username } });
        if (clash) throw conflict('Ya existe un usuario con ese nombre');
        data.username = username;
      }
    }

    if (body.role !== undefined) {
      const role = String(body.role || '').trim().toUpperCase();
      validateAssignableRole(role);
      if (existing.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
        const otherAdmins = await countActiveAdmins(existing.id);
        if (otherAdmins === 0) {
          throw forbidden('No se puede quitar el rol Admin del único administrador activo');
        }
      }
      data.role = role;
    }

    if (body.isActive !== undefined) {
      const isActive = parseIsActive(body.isActive, existing.isActive);
      if (
        existing.role === ROLES.ADMIN &&
        existing.isActive &&
        !isActive
      ) {
        const otherAdmins = await countActiveAdmins(existing.id);
        if (otherAdmins === 0) {
          throw forbidden('No se puede desactivar el único administrador activo');
        }
      }
      data.isActive = isActive;
    }

    if (body.password !== undefined && body.password !== '') {
      const password = validatePassword(body.password, { required: false });
      if (password) {
        data.passwordHash = await bcrypt.hash(password, 10);
      }
    }

    if (Object.keys(data).length === 0) {
      throw badRequest('No hay cambios para guardar');
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT
    });

    // Si se desactiva o cambia la contraseña, invalidar sesiones del usuario
    if (data.isActive === false || data.passwordHash) {
      await destroyUserSessions(id);
    }

    return res.json(user);
  } catch (error) {
    if (error.status) {
      const label =
        error.status === 404
          ? 'No encontrado'
          : error.status === 403
            ? 'Sin permiso'
            : error.status === 409
              ? 'Conflicto'
              : 'Solicitud inválida';
      return res.status(error.status).json({ error: label, message: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflicto',
        message: 'Ya existe un usuario con ese nombre'
      });
    }
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('Usuario no encontrado');

    if (existing.role === ROLES.ADMIN) {
      throw forbidden('Los usuarios Admin no se pueden eliminar');
    }

    if (req.user?.id === id) {
      throw forbidden('No podés eliminar tu propio usuario');
    }

    await destroyUserSessions(id);
    await prisma.user.delete({ where: { id } });
    return res.json({ ok: true, id });
  } catch (error) {
    if (error.status) {
      const label =
        error.status === 404
          ? 'No encontrado'
          : error.status === 403
            ? 'Sin permiso'
            : 'Solicitud inválida';
      return res.status(error.status).json({ error: label, message: error.message });
    }
    return next(error);
  }
}

module.exports = {
  login,
  logout,
  me,
  listUsers,
  listRoles,
  createUser,
  updateUser,
  deleteUser
};
