/** Matriz de permisos por rol (PGH-36 + Propietario PGH-161). */
const { ROLES } = require('./roles');

const PERMISSIONS = {
  /** Solo Admin gestiona usuarios. */
  users: [ROLES.ADMIN],
  settings: [ROLES.ADMIN, ROLES.PROPIETARIO],
  tarifas: [ROLES.ADMIN, ROLES.PROPIETARIO],
  /** Submenú Facturación A/B + descarga/subida PDF de factura. */
  facturacion: [ROLES.ADMIN, ROLES.PROPIETARIO],
  reportes: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  /** Historial de cambios (PGH-44): admin, propietario y gerencia. */
  auditoria: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  /** Medios de pago / % descuento (PGH-135). */
  mediosPago: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  /** Motor de promociones / descuentos (PGH-144). */
  promociones: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  reservas: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION],
  clientes: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION],
  finanzas: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION],
  /** Menús diarios media pensión (independiente del menú a la carta). */
  gastronomia: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.RECEPCION]
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
