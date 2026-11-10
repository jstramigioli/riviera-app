/** Matriz de permisos por rol (confirmada PGH-36). */
const ROLES = {
  ADMIN: 'ADMIN',
  GERENCIA: 'GERENCIA',
  RECEPCION: 'RECEPCION'
};

const PERMISSIONS = {
  users: [ROLES.ADMIN],
  settings: [ROLES.ADMIN],
  tarifas: [ROLES.ADMIN],
  reportes: [ROLES.ADMIN, ROLES.GERENCIA],
  /** Historial de cambios (PGH-44): admin y gerencia. */
  auditoria: [ROLES.ADMIN, ROLES.GERENCIA],
  reservas: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.RECEPCION],
  clientes: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.RECEPCION],
  finanzas: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.RECEPCION]
};

function roleHasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

module.exports = {
  ROLES,
  PERMISSIONS,
  roleHasPermission
};
