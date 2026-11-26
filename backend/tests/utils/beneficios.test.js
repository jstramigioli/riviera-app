const {
  decidirEstado,
  lineaBonificable,
  prepararBeneficio,
  consumirBeneficio,
  anularBeneficioManual,
  BeneficioError
} = require('../../src/utils/beneficios');

const cenaCancelada = { estado: 'CANCELADA', vigente: true };

describe('decidirEstado — Almuerzo sin cargo', () => {
  const disponible = { estado: 'DISPONIBLE', motivoAnulacion: null };

  it('sigue disponible con la cena cancelada y la reserva en curso', () => {
    expect(decidirEstado(disponible, cenaCancelada, 'INGRESADA')).toBeNull();
    expect(decidirEstado(disponible, cenaCancelada, 'PENDIENTE')).toBeNull();
  });

  it('check-out lo anula y revertir el check-out lo restaura', () => {
    expect(decidirEstado(disponible, cenaCancelada, 'FINALIZADA')).toEqual({
      estado: 'ANULADO',
      motivoAnulacion: 'CHECKOUT'
    });
    expect(
      decidirEstado({ estado: 'ANULADO', motivoAnulacion: 'CHECKOUT' }, cenaCancelada, 'INGRESADA')
    ).toEqual({ estado: 'DISPONIBLE', motivoAnulacion: null });
  });

  it('se anula si se reactiva la cena o la fecha sale de la estadía; vuelve si se revierte', () => {
    expect(decidirEstado(disponible, { estado: 'PREVISTA', vigente: true }, 'INGRESADA')).toEqual({
      estado: 'ANULADO',
      motivoAnulacion: 'CENA_REACTIVADA'
    });
    expect(decidirEstado(disponible, { estado: 'CANCELADA', vigente: false }, 'INGRESADA')).toEqual({
      estado: 'ANULADO',
      motivoAnulacion: 'FUERA_DE_ESTADIA'
    });
    expect(decidirEstado(disponible, cenaCancelada, 'CANCELADA')).toEqual({
      estado: 'ANULADO',
      motivoAnulacion: 'FUERA_DE_ESTADIA'
    });
    expect(
      decidirEstado({ estado: 'ANULADO', motivoAnulacion: 'FUERA_DE_ESTADIA' }, cenaCancelada, 'CONFIRMADA')
    ).toEqual({ estado: 'DISPONIBLE', motivoAnulacion: null });
  });

  it('un beneficio utilizado o anulado a mano no cambia solo', () => {
    expect(decidirEstado({ estado: 'UTILIZADO' }, cenaCancelada, 'FINALIZADA')).toBeNull();
    expect(
      decidirEstado({ estado: 'ANULADO', motivoAnulacion: 'MANUAL' }, cenaCancelada, 'INGRESADA')
    ).toBeNull();
  });

  it('actualiza el motivo si cambia la causa de la anulación', () => {
    expect(
      decidirEstado({ estado: 'ANULADO', motivoAnulacion: 'CHECKOUT' }, { estado: 'PREVISTA', vigente: true }, 'FINALIZADA')
    ).toEqual({ estado: 'ANULADO', motivoAnulacion: 'CENA_REACTIVADA' });
  });
});

describe('aplicación en comanda', () => {
  const lines = [
    { category: 'MINUTAS', descripcion: 'Milanesa' },
    { category: 'BEBIDAS', descripcion: 'Agua' }
  ];
  const db = (beneficio) => ({
    beneficioGastronomico: { findUnique: jest.fn().mockResolvedValue(beneficio) }
  });
  const disponible = { id: 3, reservationId: 40, estado: 'DISPONIBLE' };

  it('todo sin cargo salvo bebidas', async () => {
    expect(lineaBonificable({ category: 'MINUTAS' })).toBe(true);
    expect(lineaBonificable({ category: 'BEBIDAS' })).toBe(false);
    const { lines: marcadas } = await prepararBeneficio(db(disponible), {
      beneficioId: 3,
      ambito: 'MINUTAS',
      reservationId: 40,
      lines
    });
    expect(marcadas.map((l) => l.bonificado)).toEqual([true, false]);
  });

  it('solo en Minutas, de la misma reserva, disponible y con algo más que bebidas', async () => {
    const base = { beneficioId: 3, ambito: 'MINUTAS', reservationId: 40, lines };
    await expect(prepararBeneficio(db(disponible), { ...base, ambito: 'CAFETERIA' })).rejects.toThrow('Minutas');
    await expect(prepararBeneficio(db(disponible), { ...base, reservationId: null })).rejects.toThrow('reserva');
    await expect(prepararBeneficio(db(disponible), { ...base, reservationId: 41 })).rejects.toThrow('no corresponde');
    await expect(
      prepararBeneficio(db({ ...disponible, estado: 'UTILIZADO' }), base)
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prepararBeneficio(db(disponible), { ...base, lines: [lines[1]] })
    ).rejects.toThrow('no sea bebida');
  });

  it('consumir falla si otro ya lo usó (carrera)', async () => {
    const tx = { beneficioGastronomico: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(consumirBeneficio(tx, 3, 9)).rejects.toBeInstanceOf(BeneficioError);
  });

  it('no se anula a mano uno ya utilizado', async () => {
    await expect(
      anularBeneficioManual(db({ id: 3, estado: 'UTILIZADO' }), 3)
    ).rejects.toThrow('anulá su comanda');
  });
});
