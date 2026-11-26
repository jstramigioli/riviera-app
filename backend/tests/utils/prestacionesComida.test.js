const {
  resolveMealFlags,
  computeDesiredPrestaciones,
  planSync
} = require('../../src/utils/prestacionesComida');

const ST = new Map([
  ['solo', { id: 'solo', incluyeDesayuno: false, incluyeCena: false }],
  ['des', { id: 'des', incluyeDesayuno: true, incluyeCena: false }],
  ['mp', { id: 'mp', incluyeDesayuno: true, incluyeCena: true }]
]);

function seg(startDate, endDate, service, extra = {}) {
  return { startDate, endDate, services: [service], guestCount: 2, isActive: true, ...extra };
}

function keys(list) {
  return list.map((p) => `${p.fecha} ${p.tipo}`);
}

describe('resolveMealFlags', () => {
  it('usa el régimen interno del ServiceType', () => {
    expect(resolveMealFlags('mp', ST)).toEqual({ breakfast: true, dinner: true });
    expect(resolveMealFlags('des', ST)).toEqual({ breakfast: true, dinner: false });
    expect(resolveMealFlags('solo', ST)).toEqual({ breakfast: false, dinner: false });
  });

  it('interpreta referencias legacy en texto', () => {
    expect(resolveMealFlags('con_desayuno')).toEqual({ breakfast: true, dinner: false });
    expect(resolveMealFlags('media_pension')).toEqual({ breakfast: true, dinner: true });
    expect(resolveMealFlags('Sin desayuno')).toEqual({ breakfast: false, dinner: false });
    expect(resolveMealFlags(null)).toEqual({ breakfast: false, dinner: false });
  });
});

describe('computeDesiredPrestaciones — reglas de ingreso y egreso', () => {
  it('media pensión: cena el día de ingreso, ambas en días intermedios, desayuno el de salida', () => {
    const r = { status: 'CONFIRMADA', segments: [seg('2026-12-01', '2026-12-04', 'mp')] };
    expect(keys(computeDesiredPrestaciones(r, ST))).toEqual([
      '2026-12-01 CENA',
      '2026-12-02 CENA',
      '2026-12-02 DESAYUNO',
      '2026-12-03 CENA',
      '2026-12-03 DESAYUNO',
      '2026-12-04 DESAYUNO'
    ]);
  });

  it('con desayuno: solo desayunos, desde el día siguiente al ingreso hasta la salida', () => {
    const r = { status: 'CONFIRMADA', segments: [seg('2026-12-01', '2026-12-03', 'des')] };
    expect(keys(computeDesiredPrestaciones(r, ST))).toEqual([
      '2026-12-02 DESAYUNO',
      '2026-12-03 DESAYUNO'
    ]);
  });

  it('solo alojamiento no genera comidas', () => {
    const r = { status: 'CONFIRMADA', segments: [seg('2026-12-01', '2026-12-03', 'solo')] };
    expect(computeDesiredPrestaciones(r, ST)).toEqual([]);
  });

  it('cambio de servicio entre tramos: el desayuno sigue a la noche anterior', () => {
    const r = {
      status: 'INGRESADA',
      segments: [seg('2026-12-01', '2026-12-03', 'mp'), seg('2026-12-03', '2026-12-05', 'des')]
    };
    expect(keys(computeDesiredPrestaciones(r, ST))).toEqual([
      '2026-12-01 CENA',
      '2026-12-02 CENA',
      '2026-12-02 DESAYUNO',
      '2026-12-03 DESAYUNO',
      '2026-12-04 DESAYUNO',
      '2026-12-05 DESAYUNO'
    ]);
  });

  it('prerreservas generan comidas; canceladas y no presentadas no', () => {
    const segments = [seg('2026-12-01', '2026-12-02', 'mp')];
    expect(computeDesiredPrestaciones({ status: 'PENDIENTE', segments }, ST)).toHaveLength(2);
    expect(computeDesiredPrestaciones({ status: 'CANCELADA', segments }, ST)).toEqual([]);
    expect(computeDesiredPrestaciones({ status: 'NO_PRESENTADA', segments }, ST)).toEqual([]);
  });

  it('ignora tramos inactivos', () => {
    const r = {
      status: 'CONFIRMADA',
      segments: [seg('2026-12-01', '2026-12-02', 'mp', { isActive: false })]
    };
    expect(computeDesiredPrestaciones(r, ST)).toEqual([]);
  });

  it('comensales: colapsa componentes de una habitación virtual', () => {
    const r = {
      status: 'CONFIRMADA',
      guests: [],
      segments: [
        seg('2026-12-01', '2026-12-02', 'mp', { guestCount: 4, virtualRoomId: 7 }),
        seg('2026-12-01', '2026-12-02', 'mp', { guestCount: 1, virtualRoomId: 7 })
      ]
    };
    const result = computeDesiredPrestaciones(r, ST);
    expect(result.every((p) => p.pax === 4)).toBe(true);
  });

  it('comensales: el desayuno usa los de la noche anterior', () => {
    const r = {
      status: 'CONFIRMADA',
      segments: [
        seg('2026-12-01', '2026-12-02', 'des', { guestCount: 3 }),
        seg('2026-12-02', '2026-12-03', 'des', { guestCount: 2 })
      ]
    };
    const [d1, d2] = computeDesiredPrestaciones(r, ST);
    expect(d1).toMatchObject({ fecha: '2026-12-02', pax: 3 });
    expect(d2).toMatchObject({ fecha: '2026-12-03', pax: 3 });
  });
});

describe('planSync — no pierde datos operativos', () => {
  const row = (id, fecha, tipo, extra = {}) => ({
    id,
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    tipo,
    pax: 2,
    paxManual: false,
    estado: 'PREVISTA',
    vigente: true,
    notas: null,
    ...extra
  });

  it('crea las que faltan y no duplica las existentes', () => {
    const plan = planSync(
      [row(1, '2026-12-01', 'CENA')],
      [
        { fecha: '2026-12-01', tipo: 'CENA', pax: 2 },
        { fecha: '2026-12-02', tipo: 'DESAYUNO', pax: 2 }
      ]
    );
    expect(plan.create).toEqual([{ fecha: '2026-12-02', tipo: 'DESAYUNO', pax: 2 }]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('actualiza comensales salvo que se hayan editado a mano', () => {
    const plan = planSync(
      [row(1, '2026-12-01', 'CENA'), row(2, '2026-12-02', 'CENA', { paxManual: true })],
      [
        { fecha: '2026-12-01', tipo: 'CENA', pax: 3 },
        { fecha: '2026-12-02', tipo: 'CENA', pax: 3 }
      ]
    );
    expect(plan.update).toEqual([{ id: 1, data: { pax: 3 } }]);
  });

  it('borra las sobrantes sin intervención y conserva (no vigentes) las canceladas o con notas', () => {
    const plan = planSync(
      [
        row(1, '2026-12-01', 'CENA'),
        row(2, '2026-12-02', 'CENA', { estado: 'CANCELADA' }),
        row(3, '2026-12-03', 'CENA', { notas: 'sin sal' })
      ],
      []
    );
    expect(plan.remove).toEqual([1]);
    expect(plan.update).toEqual([
      { id: 2, data: { vigente: false } },
      { id: 3, data: { vigente: false } }
    ]);
  });

  it('si la fecha vuelve a la estadía, reactiva la conservada con su cancelación', () => {
    const plan = planSync(
      [row(2, '2026-12-02', 'CENA', { estado: 'CANCELADA', vigente: false })],
      [{ fecha: '2026-12-02', tipo: 'CENA', pax: 2 }]
    );
    expect(plan.update).toEqual([{ id: 2, data: { vigente: true } }]);
    expect(plan.create).toEqual([]);
  });

  it('es idempotente cuando ya está todo sincronizado', () => {
    const plan = planSync(
      [row(1, '2026-12-01', 'CENA')],
      [{ fecha: '2026-12-01', tipo: 'CENA', pax: 2 }]
    );
    expect(plan).toEqual({ create: [], update: [], remove: [] });
  });
});
