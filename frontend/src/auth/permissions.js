import { ROLES } from './roles';

export { ROLES };

const PERMISSIONS = {
  users: [ROLES.ADMIN],
  settings: [ROLES.ADMIN, ROLES.PROPIETARIO],
  tarifas: [ROLES.ADMIN, ROLES.PROPIETARIO],
  /** Submenú Facturación A/B + subida PDF de factura. */
  facturacion: [ROLES.ADMIN, ROLES.PROPIETARIO],
  reportes: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  auditoria: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  /** Medios de pago (catálogo; descuentos solo en promociones). */
  mediosPago: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  /** Motor de promociones / descuentos (PGH-144). */
  promociones: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA],
  reservas: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION],
  clientes: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION],
  finanzas: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION],
  /** Menús diarios media pensión (independiente del menú a la carta). */
  gastronomia: [ROLES.ADMIN, ROLES.PROPIETARIO, ROLES.GERENCIA, ROLES.RECEPCION]
};

export function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed || !role) return false;
  return allowed.includes(role);
}

export { roleLabel } from './roles';
