/* Smoke: login → Factura B (transferencia) + Factura A (efectivo) + billing profile */
const http = require('http');

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: 'localhost',
        port: 3001,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let b = '';
        res.on('data', (d) => {
          b += d;
        });
        res.on('end', () => {
          const set = res.headers['set-cookie'];
          resolve({
            status: res.statusCode,
            body: b,
            cookie: set ? set.map((c) => c.split(';')[0]).join('; ') : cookie
          });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const login = await req('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${login.body}`);
  }
  const cookie = login.cookie;
  const clients = JSON.parse((await req('GET', '/api/clients', null, cookie)).body);
  const client = clients[0];
  const rbody = JSON.parse(
    (await req('GET', '/api/reservation-payments/reservas-saldos', null, cookie)).body
  );
  const rows = Array.isArray(rbody) ? rbody : [];
  const rid = rows[0]?.id || rows[0]?.reservaId;
  if (!rid) throw new Error('no reservation');

  const pagoB = await req(
    'POST',
    `/api/reservation-payments/reservas/${rid}/pagos`,
    {
      monto: 150,
      moneda: 'ARS',
      metodo: 'Transferencia',
      requiereFacturacion: true,
      factura: {
        tipo: 'B',
        fecha: new Date().toISOString(),
        motivo: 'Smoke facturacion',
        firstName: client.firstName,
        lastName: client.lastName,
        documentType: 'DNI',
        documentNumber: client.documentNumber || '30111222',
        address: 'Calle Falsa 123',
        email: client.email || 'test@example.com'
      }
    },
    cookie
  );
  console.log('pagoB', pagoB.status, pagoB.body.slice(0, 400));
  if (pagoB.status !== 201) process.exit(1);

  const billClientId = rows[0].mainClient?.id || client.id;
  const bill = await req('GET', `/api/clients/${billClientId}/billing-profile`, null, cookie);
  console.log('billing', bill.status, bill.body.slice(0, 400));
  if (bill.status !== 200) process.exit(1);
  const billJson = JSON.parse(bill.body);
  if (!billJson.hasSavedProfile) {
    console.error('expected saved billing profile');
    process.exit(1);
  }

  const pagoA = await req(
    'POST',
    `/api/reservation-payments/reservas/${rid}/pagos`,
    {
      monto: 200,
      moneda: 'ARS',
      metodo: 'Efectivo',
      requiereFacturacion: true,
      factura: {
        tipo: 'A',
        fecha: new Date().toISOString(),
        motivo: 'Empresa',
        businessName: 'ACME SA',
        cuit: '30-71234567-1',
        commercialAddress: 'Av Siempre Viva 742',
        email: 'billing@acme.test',
        ivaCondition: 'Responsable Inscripto'
      }
    },
    cookie
  );
  console.log('pagoA', pagoA.status, pagoA.body.slice(0, 400));
  if (pagoA.status !== 201) process.exit(1);

  console.log('SMOKE_OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
