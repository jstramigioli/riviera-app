const { roleHasPermission, ROLES } = require('../../src/auth/permissions');
const { ACTIVE_ROLES, isActiveRole, roleLabel } = require('../../src/auth/roles');

describe('roleHasPermission', () => {
  test('admin tiene todos los permisos clave', () => {
    expect(roleHasPermission(ROLES.ADMIN, 'users')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'settings')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'tarifas')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'facturacion')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'reportes')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'auditoria')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'mediosPago')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'promociones')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'reservas')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'finanzas')).toBe(true);
  });

  test('propietario ve settings/tarifas pero no gestiona usuarios', () => {
    expect(roleHasPermission(ROLES.PROPIETARIO, 'users')).toBe(false);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'settings')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'tarifas')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'facturacion')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'reportes')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'auditoria')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'mediosPago')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'promociones')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'reservas')).toBe(true);
    expect(roleHasPermission(ROLES.PROPIETARIO, 'finanzas')).toBe(true);
  });

  test('gerencia no gestiona usuarios ni settings/tarifas/facturacion', () => {
    expect(roleHasPermission(ROLES.GERENCIA, 'users')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'settings')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'tarifas')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'facturacion')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'reportes')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'auditoria')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'mediosPago')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'promociones')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'reservas')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'finanzas')).toBe(true);
  });

  test('recepcion solo operativa diaria', () => {
    expect(roleHasPermission(ROLES.RECEPCION, 'users')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'settings')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'tarifas')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'facturacion')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'reportes')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'auditoria')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'mediosPago')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'promociones')).toBe(false);
    expect(roleHasPermission(ROLES.RECEPCION, 'reservas')).toBe(true);
    expect(roleHasPermission(ROLES.RECEPCION, 'clientes')).toBe(true);
    expect(roleHasPermission(ROLES.RECEPCION, 'finanzas')).toBe(true);
  });

  test('roles inactivos no tienen permisos de back-office', () => {
    for (const role of [ROLES.CAMARERO, ROLES.COCINA, ROLES.MUCAMA, ROLES.MANTENIMIENTO]) {
      expect(roleHasPermission(role, 'users')).toBe(false);
      expect(roleHasPermission(role, 'settings')).toBe(false);
      expect(roleHasPermission(role, 'reservas')).toBe(false);
      expect(isActiveRole(role)).toBe(false);
    }
  });
});

describe('roles catalog', () => {
  test('activos son Admin, Propietario, Gerencia, Recepción', () => {
    expect(ACTIVE_ROLES).toEqual([
      ROLES.ADMIN,
      ROLES.PROPIETARIO,
      ROLES.GERENCIA,
      ROLES.RECEPCION
    ]);
  });

  test('labels legibles', () => {
    expect(roleLabel(ROLES.ADMIN)).toBe('Admin');
    expect(roleLabel(ROLES.PROPIETARIO)).toBe('Propietario');
    expect(roleLabel(ROLES.CAMARERO)).toBe('Camarero/a');
    expect(roleLabel(ROLES.MANTENIMIENTO)).toBe('Mantenimiento');
  });
});
