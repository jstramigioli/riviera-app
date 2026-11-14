const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

const SESSION_COOKIE = 'riviera_session';
const DEFAULT_SESSION_DAYS = Number(process.env.SESSION_DAYS || 14);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sessionMaxAgeMs() {
  return DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive
  };
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs());

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt
    }
  });

  return { token, expiresAt };
}

async function findSessionUser(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user || !session.user.isActive) return null;

  return { session, user: session.user };
}

async function destroySession(token) {
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

async function destroyUserSessions(userId) {
  await prisma.session.deleteMany({ where: { userId } });
}

async function authenticateUser(username, password) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized || !password) {
    const err = new Error('Usuario y contraseña son obligatorios');
    err.status = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { username: normalized } });
  if (!user || !user.isActive) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  return user;
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

module.exports = {
  SESSION_COOKIE,
  publicUser,
  createSession,
  findSessionUser,
  destroySession,
  destroyUserSessions,
  authenticateUser,
  setSessionCookie,
  clearSessionCookie,
  hashToken
};
