const { resumenDietas, contarConDieta } = require('../../src/utils/dietas');

test('resume dietas de los huéspedes para cocina', () => {
  expect(
    resumenDietas([
      { dietVegetariano: true },
      { dietVegetariano: true, dietCeliaco: true },
      { dietVegano: false }
    ])
  ).toEqual(['Celíaco ×1', 'Vegetariano ×2']);
  expect(resumenDietas([])).toEqual([]);
  expect(resumenDietas(undefined)).toEqual([]);
});

test('«otra» dieta en texto libre: se agrupa sin distinguir mayúsculas y cuenta personas con régimen', () => {
  const personas = [
    { dietOtra: 'sin sal' },
    { dietOtra: '  Sin sal ', dietCeliaco: true },
    { dietOtra: '' },
    { dietVegano: false }
  ];
  expect(resumenDietas(personas)).toEqual(['Celíaco ×1', 'Sin sal ×2']);
  expect(contarConDieta(personas)).toBe(2);
});
