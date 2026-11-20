/** Catálogo de roles (espejo backend PGH-161). */

export const ROLES = {
  ADMIN: 'ADMIN',
  PROPIETARIO: 'PROPIETARIO',
  GERENCIA: 'GERENCIA',
  RECEPCION: 'RECEPCION',
  CAMARERO: 'CAMARERO',
  COCINA: 'COCINA',
  MUCAMA: 'MUCAMA',
  MANTENIMIENTO: 'MANTENIMIENTO'
};

/** Roles asignables en la UI (activos). */
export const ACTIVE_ROLES = [
  ROLES.ADMIN,
  ROLES.PROPIETARIO,
  ROLES.GERENCIA,
  ROLES.RECEPCION
];

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.PROPIETARIO]: 'Propietario',
  [ROLES.GERENCIA]: 'Gerencia',
  [ROLES.RECEPCION]: 'Recepción',
  [ROLES.CAMARERO]: 'Camarero/a',
  [ROLES.COCINA]: 'Cocina',
  [ROLES.MUCAMA]: 'Mucama',
  [ROLES.MANTENIMIENTO]: 'Mantenimiento'
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || '';
}

export function isActiveRole(role) {
  return ACTIVE_ROLES.includes(role);
}

export function activeRoleOptions() {
  return ACTIVE_ROLES.map((value) => ({ value, label: roleLabel(value) }));
}
