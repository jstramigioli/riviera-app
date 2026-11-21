import { describe, expect, it } from 'vitest';
import {
  amountToArs,
  isEfectivo,
  maxVueltoARS,
  readCashTenderFields,
  suggestVueltoARS
} from './cashTender';

describe('cashTender FE — casos A–H (sync/helpers)', () => {
  it('A/B: sugiere vuelto ARS y max', () => {
    expect(isEfectivo('Efectivo')).toBe(true);
    expect(suggestVueltoARS({ dineroRecibido: 100000, moneda: 'ARS', montoIngresadoARS: 100000 })).toBe(
      0
    );
    expect(suggestVueltoARS({ dineroRecibido: 120000, moneda: 'ARS', montoIngresadoARS: 100000 })).toBe(
      20000
    );
    expect(maxVueltoARS({ dineroRecibido: 120000, moneda: 'ARS', montoIngresadoARS: 100000 })).toBe(
      20000
    );
  });

  it('D: USD recibido → vuelto ARS con mismo TC', () => {
    expect(amountToArs(100, 'USD', 1200)).toBe(120000);
    expect(
      suggestVueltoARS({
        dineroRecibido: 100,
        moneda: 'USD',
        tipoCambio: 1200,
        montoIngresadoARS: 100000
      })
    ).toBe(20000);
  });

  it('F: transferencia no es efectivo', () => {
    expect(isEfectivo('Transferencia')).toBe(false);
  });

  it('H: lectura histórica sin inventar vuelto', () => {
    expect(readCashTenderFields({ monto: 50 })).toEqual({ dineroRecibido: 50, vueltoARS: 0 });
    expect(readCashTenderFields({ monto: 80, dineroRecibido: 100, vueltoARS: 15 })).toEqual({
      dineroRecibido: 100,
      vueltoARS: 15
    });
  });
});
