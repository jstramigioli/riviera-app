const { resumenDietas } = require('../../src/utils/dietas');

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
