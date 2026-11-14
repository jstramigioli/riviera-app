export const ROLES = {
  ADMIN: 'ADMIN',
  GERENCIA: 'GERENCIA',
  RECEPCION: 'RECEPCION'
};

const PERMISSIONS = {
  users: [ROLES.ADMIN],
  settings: [ROLES.ADMIN],
  tarifas: [ROLES.ADMIN],
  /** Submenú Facturación A/B + subida PDF de factura. */
  facturacion: [ROLES.ADMIN],
  reportes: [ROLES.ADMIN, ROLES.GERENCIA],
  auditoria: [ROLES.ADMIN, ROLES.GERENCIA],
  /** Medios de pago / % descuento (PGH-135). */
  mediosPago: [ROLES.ADMIN, ROLES.GERENCIA],
  /** Motor de promociones / descuentos (PGH-144). */
  promociones: [ROLES.ADMIN, ROLES.GERENCIA],
  reservas: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.RECEPCION],
  clientes: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.RECEPCION],
  finanzas: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.RECEPCION]
};

export function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed || !role) return false;
  return allowed.includes(role);
}

export function roleLabel(role) {
  switch (role) {
    case ROLES.ADMIN:
      return 'Admin';
    case ROLES.GERENCIA:
      return 'Gerencia';
    case ROLES.RECEPCION:
      return 'Recepción';
    default:
      return role || '';
  }
}
