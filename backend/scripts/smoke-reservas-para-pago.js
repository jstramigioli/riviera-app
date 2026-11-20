/* Smoke: login → GET /reservation-payments/reservas-para-pago tiene opciones */
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

  const occupied = await req('GET', '/api/consumptions/occupied-rooms', null, cookie);
  const occupiedBody = JSON.parse(occupied.body);
  console.log(
    'occupied-rooms',
    occupied.status,
    'count=',
    occupiedBody.count ?? occupiedBody.data?.length
  );

  const picker = await req('GET', '/api/reservation-payments/reservas-para-pago', null, cookie);
  const pickerBody = JSON.parse(picker.body);
  console.log('reservas-para-pago', picker.status, 'count=', pickerBody.count);
  if (picker.status !== 200) {
    throw new Error(`picker failed: ${picker.status} ${picker.body}`);
  }
  if (!Array.isArray(pickerBody.data) || pickerBody.data.length === 0) {
    throw new Error('picker vacío: se esperaban reservas activas');
  }
  console.log(
    'sample:',
    pickerBody.data.slice(0, 3).map((r) => ({
      id: r.reservationId,
      label: r.label,
      status: r.status
    }))
  );
  console.log('OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
