import { describe, it, expect } from 'vitest';
import {
  filterConfigNav,
  getEnabledConfigNav,
  normalizeSearch
} from './configNav';

describe('configNav', () => {
  it('normalizeSearch quita acentos y pasa a minúsculas', () => {
    expect(normalizeSearch('  Tarifás  ')).toBe('tarifas');
  });

  it('getEnabledConfigNav solo incluye permisos del rol', () => {
    const can = (p) => p === 'mediosPago' || p === 'promociones' || p === 'auditoria';
    const nav = getEnabledConfigNav(can);
    expect(nav.map((s) => s.id)).toEqual(['medios-pago', 'promociones', 'auditoria']);
    expect(nav.find((s) => s.id === 'usuarios')).toBeUndefined();
    expect(nav.find((s) => s.id === 'hotel')).toBeUndefined();
  });

  it('admin ve usuarios y settings', () => {
    const can = (p) =>
      p === 'settings' || p === 'users' || p === 'mediosPago' || p === 'promociones' || p === 'auditoria';
    const ids = getEnabledConfigNav(can).map((s) => s.id);
    expect(ids).toContain('usuarios');
    expect(ids).toContain('hotel');
    expect(ids).toContain('auditoria');
  });

  it('sin query no expone children', () => {
    const can = (p) => p === 'settings';
    const filtered = filterConfigNav(getEnabledConfigNav(can), '');
    const cargos = filtered.find((s) => s.id === 'cargos-tarifas');
    expect(cargos.children).toBeUndefined();
  });

  it('busca subsección Servicios bajo Cargos y Tarifas', () => {
    const can = (p) => p === 'settings';
    const filtered = filterConfigNav(getEnabledConfigNav(can), 'servicios');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('cargos-tarifas');
    expect(filtered[0].children.map((c) => c.label)).toEqual(['Servicios']);
  });

  it('no muestra secciones de otros roles aunque matcheen el texto', () => {
    const can = (p) => p === 'auditoria';
    const filtered = filterConfigNav(getEnabledConfigNav(can), 'hotel');
    expect(filtered).toHaveLength(0);
  });
});
