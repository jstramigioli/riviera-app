const { isDebugEnabled } = require('../src/controllers/debugFakeReservations.controller');

describe('isDebugEnabled (PGH-374)', () => {
  const prevFlag = process.env.ENABLE_DEBUG_FAKE_RESERVATIONS;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ENABLE_DEBUG_FAKE_RESERVATIONS;
    else process.env.ENABLE_DEBUG_FAKE_RESERVATIONS = prevFlag;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it('respeta true explícito', () => {
    process.env.ENABLE_DEBUG_FAKE_RESERVATIONS = 'true';
    process.env.NODE_ENV = 'production';
    expect(isDebugEnabled()).toBe(true);
  });

  it('respeta false explícito también en development', () => {
    process.env.ENABLE_DEBUG_FAKE_RESERVATIONS = 'false';
    process.env.NODE_ENV = 'development';
    expect(isDebugEnabled()).toBe(false);
  });

  it('sin flag: on fuera de production/test', () => {
    delete process.env.ENABLE_DEBUG_FAKE_RESERVATIONS;
    process.env.NODE_ENV = 'development';
    expect(isDebugEnabled()).toBe(true);
    delete process.env.NODE_ENV;
    expect(isDebugEnabled()).toBe(true);
  });

  it('sin flag: off en production y test', () => {
    delete process.env.ENABLE_DEBUG_FAKE_RESERVATIONS;
    process.env.NODE_ENV = 'production';
    expect(isDebugEnabled()).toBe(false);
    process.env.NODE_ENV = 'test';
    expect(isDebugEnabled()).toBe(false);
  });
});
