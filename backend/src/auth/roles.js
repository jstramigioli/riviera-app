/** Catálogo de roles de usuario (PGH-161). */

const ROLES = {
  ADMIN: 'ADMIN',
  PROPIETARIO: 'PROPIETARIO',
  GERENCIA: 'GERENCIA',
  RECEPCION: 'RECEPCION',
  CAMARERO: 'CAMARERO',
  COCINA: 'COCINA',
  MUCAMA: 'MUCAMA',
  MANTENIMIENTO: 'MANTENIMIENTO'
};

/** Roles asignables al crear/editar usuarios (activos). */
const ACTIVE_ROLES = [
  ROLES.ADMIN,
  ROLES.PROPIETARIO,
  ROLES.GERENCIA,
  ROLES.RECEPCION
];

const ALL_ROLES = Object.values(ROLES);

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

function isKnownRole(role) {
  return ALL_ROLES.includes(role);
}

function isActiveRole(role) {
  return ACTIVE_ROLES.includes(role);
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '';
}

function rolesCatalog() {
  return ALL_ROLES.map((value) => ({
    value,
    label: roleLabel(value),
    active: isActiveRole(value)
  }));
}

module.exports = {
  ROLES,
  ACTIVE_ROLES,
  ALL_ROLES,
  ROLE_LABELS,
  isKnownRole,
  isActiveRole,
  roleLabel,
  rolesCatalog
};
