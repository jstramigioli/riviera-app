const { roleHasPermission, ROLES } = require('../../src/auth/permissions');

describe('roleHasPermission', () => {
  test('admin tiene todos los permisos clave', () => {
    expect(roleHasPermission(ROLES.ADMIN, 'users')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'settings')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'tarifas')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'facturacion')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'reportes')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'auditoria')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'mediosPago')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'reservas')).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, 'finanzas')).toBe(true);
  });

  test('gerencia no gestiona usuarios ni settings/tarifas/facturacion', () => {
    expect(roleHasPermission(ROLES.GERENCIA, 'users')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'settings')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'tarifas')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'facturacion')).toBe(false);
    expect(roleHasPermission(ROLES.GERENCIA, 'reportes')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'auditoria')).toBe(true);
    expect(roleHasPermission(ROLES.GERENCIA, 'mediosPago')).toBe(true);
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
    expect(roleHasPermission(ROLES.RECEPCION, 'reservas')).toBe(true);
    expect(roleHasPermission(ROLES.RECEPCION, 'clientes')).toBe(true);
    expect(roleHasPermission(ROLES.RECEPCION, 'finanzas')).toBe(true);
  });
});

