const { normalizeDishName } = require('./dishNameNorm');

describe('normalizeDishName', () => {
  it('quita acentos y unifica mayúsculas', () => {
    expect(normalizeDishName('  Milanesa Napolitána  ')).toBe('milanesa napolitana');
    expect(normalizeDishName('Ñoquis')).toBe('noquis');
  });
});
