const {
  formatCobroCodigo,
  parseCobroCodigo,
  allocateNextCobroCodigo,
  withCobroCodigoRetry,
  isCodigoConflict
} = require('../../src/utils/cobroCodigo');

describe('códigos de cobro', () => {
  test('format/parse ida y vuelta, con cambio de letra', () => {
    expect(formatCobroCodigo(0)).toBe('A000');
    expect(formatCobroCodigo(999)).toBe('A999');
    expect(formatCobroCodigo(1000)).toBe('B000');
    expect(parseCobroCodigo('b042')).toBe(1042);
    expect(parseCobroCodigo('X1')).toBeNull();
  });

  test('allocateNextCobroCodigo toma el máximo + 1', async () => {
    const db = { cobro: { findFirst: jest.fn().mockResolvedValue({ codigo: 'A999' }) } };
    await expect(allocateNextCobroCodigo(db)).resolves.toBe('B000');
    db.cobro.findFirst.mockResolvedValue(null);
    await expect(allocateNextCobroCodigo(db)).resolves.toBe('A000');
  });

  test('isCodigoConflict solo reconoce P2002 sobre codigo', () => {
    expect(isCodigoConflict({ code: 'P2002', meta: { target: ['codigo'] } })).toBe(true);
    expect(isCodigoConflict({ code: 'P2002', meta: { target: 'Cobro_codigo_key' } })).toBe(true);
    expect(isCodigoConflict({ code: 'P2002', meta: { target: ['cobroId', 'accountId'] } })).toBe(false);
    expect(isCodigoConflict({ code: 'P2003' })).toBe(false);
  });

  test('withCobroCodigoRetry reintenta ante choque de código y luego resuelve', async () => {
    const conflict = Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['codigo'] } });
    const run = jest.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce('ok');
    await expect(withCobroCodigoRetry(run)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('withCobroCodigoRetry no reintenta otros errores y se rinde tras N choques', async () => {
    const other = new Error('saldo');
    const run1 = jest.fn().mockRejectedValue(other);
    await expect(withCobroCodigoRetry(run1)).rejects.toBe(other);
    expect(run1).toHaveBeenCalledTimes(1);

    const conflict = Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['codigo'] } });
    const run2 = jest.fn().mockRejectedValue(conflict);
    await expect(withCobroCodigoRetry(run2, 3)).rejects.toBe(conflict);
    expect(run2).toHaveBeenCalledTimes(3);
  });
});
