const {
  normalizeDocumentNumber,
  normalizePersonName,
  namesMatch,
  buildIdentityKey,
  resolveClientIdentity
} = require('../../src/services/resolveClientIdentity');

describe('resolveClientIdentity helpers', () => {
  it('normaliza número de documento', () => {
    expect(normalizeDocumentNumber('12.345.678')).toBe('12345678');
    expect(normalizeDocumentNumber('AB-12 34')).toBe('AB1234');
    expect(normalizeDocumentNumber('  ')).toBeNull();
  });

  it('compara nombres sin acentos ni mayúsculas', () => {
    expect(normalizePersonName('José María')).toBe('jose maria');
    expect(namesMatch('José', 'Pérez', 'jose', 'perez')).toBe(true);
    expect(namesMatch('José', 'Pérez', 'Juan', 'Pérez')).toBe(false);
  });

  it('arma clave documental', () => {
    expect(buildIdentityKey({ documentType: 'DNI', documentNumber: '12.345.678' })).toEqual({
      documentType: 'DNI',
      documentNumber: '12.345.678',
      documentNumberNormalized: '12345678',
      documentIssuingCountry: 'AR'
    });
  });
});

describe('resolveClientIdentity', () => {
  function mockDb({ existing = null } = {}) {
    const created = [];
    const updated = [];
    return {
      client: {
        findFirst: jest.fn(async () => existing),
        findUnique: jest.fn(async ({ where }) =>
          existing && existing.id === where.id ? existing : null
        ),
        create: jest.fn(async ({ data }) => {
          const row = { id: 99, ...data };
          created.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) => {
          const row = { ...(existing || {}), id: where.id, ...data };
          updated.push(row);
          return row;
        })
      },
      _created: created,
      _updated: updated
    };
  }

  it('crea cliente si no hay match', async () => {
    const db = mockDb();
    const result = await resolveClientIdentity(db, {
      firstName: 'Ana',
      lastName: 'López',
      documentType: 'DNI',
      documentNumber: '30111222',
      documentIssuingCountry: 'AR'
    });
    expect(result.created).toBe(true);
    expect(result.needsManualReview).toBe(false);
    expect(db.client.create).toHaveBeenCalled();
  });

  it('actualiza ficha si el documento coincide y el nombre también', async () => {
    const existing = {
      id: 7,
      firstName: 'Ana',
      lastName: 'Lopez',
      notes: null,
      documentType: 'DNI',
      documentIssuingCountry: 'AR',
      documentNumberNormalized: '30111222'
    };
    const db = mockDb({ existing });
    const result = await resolveClientIdentity(db, {
      firstName: 'Ana',
      lastName: 'López',
      email: 'ana@example.com',
      documentType: 'DNI',
      documentNumber: '30.111.222',
      documentIssuingCountry: 'AR'
    });
    expect(result.updated).toBe(true);
    expect(result.needsManualReview).toBe(false);
    expect(db.client.update).toHaveBeenCalled();
    const data = db.client.update.mock.calls[0][0].data;
    expect(data.firstName).toBe('Ana');
    expect(data.email).toBe('ana@example.com');
  });

  it('no sobrescribe nombre ante discrepancia y marca revisión', async () => {
    const existing = {
      id: 7,
      firstName: 'Ana',
      lastName: 'Lopez',
      notes: null,
      documentType: 'DNI',
      documentIssuingCountry: 'AR',
      documentNumberNormalized: '30111222'
    };
    const db = mockDb({ existing });
    const result = await resolveClientIdentity(db, {
      firstName: 'María',
      lastName: 'Gómez',
      phone: '111',
      documentType: 'DNI',
      documentNumber: '30111222',
      documentIssuingCountry: 'AR'
    });
    expect(result.needsManualReview).toBe(true);
    expect(result.identityConflictNote).toMatch(/coincide/);
    const data = db.client.update.mock.calls[0][0].data;
    expect(data.firstName).toBeUndefined();
    expect(data.lastName).toBeUndefined();
    expect(data.phone).toBe('111');
    expect(data.needsIdentityReview).toBe(true);
  });
});
