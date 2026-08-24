const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Períodos Operacionales', () => {
  it('GET /api/operational-periods/:hotelId responde 501 (schema no disponible)', async () => {
    const response = await request(app)
      .get('/api/operational-periods/test-hotel')
      .expect(501);

    expect(response.body.code).toBe('SCHEMA_UNAVAILABLE');
  });

  it('POST /api/operational-periods/:hotelId responde 501', async () => {
    await request(app)
      .post('/api/operational-periods/test-hotel')
      .send({ startDate: '2024-01-01', endDate: '2024-03-31' })
      .expect(501);
  });

  it('PUT /api/operational-periods/:id responde 501', async () => {
    await request(app)
      .put('/api/operational-periods/1')
      .send({ label: 'Actualizado' })
      .expect(501);
  });

  it('DELETE /api/operational-periods/:id responde 501', async () => {
    await request(app)
      .delete('/api/operational-periods/1')
      .expect(501);
  });
});
