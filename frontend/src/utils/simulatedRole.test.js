import { afterEach, describe, expect, it } from 'vitest';
import { ROLES } from '../auth/roles';
import {
  clearSimulatedRole,
  getSimulatedRole,
  setSimulatedRole,
  SIMULATED_ROLE_STORAGE_KEY
} from './simulatedRole';

describe('simulatedRole', () => {
  afterEach(() => {
    clearSimulatedRole();
  });

  it('guarda y limpia el rol simulado en localStorage', () => {
    expect(getSimulatedRole()).toBeNull();
    setSimulatedRole(ROLES.RECEPCION);
    expect(getSimulatedRole()).toBe(ROLES.RECEPCION);
    expect(localStorage.getItem(SIMULATED_ROLE_STORAGE_KEY)).toBe(ROLES.RECEPCION);
    clearSimulatedRole();
    expect(getSimulatedRole()).toBeNull();
  });

  it('ignora roles desconocidos', () => {
    setSimulatedRole('NO_EXISTE');
    expect(getSimulatedRole()).toBeNull();
  });
});
