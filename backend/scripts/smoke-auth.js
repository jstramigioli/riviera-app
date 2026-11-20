const request = require('supertest');
const app = require('../src/app');

async function main() {
  const agent = request.agent(app);

  const login = await agent.post('/api/auth/login').send({
    username: 'admin',
    password: 'admin123'
  });
  console.log('login', login.status, login.body.user?.role);

  const me = await agent.get('/api/auth/me');
  console.log('me', me.status, me.body.user?.username);

  const ratesAdmin = await agent.get('/api/rates');
  console.log('rates_admin', ratesAdmin.status);

  const logout = await agent.post('/api/auth/logout');
  console.log('logout', logout.status);

  const loginRec = await agent.post('/api/auth/login').send({
    username: 'recepcion',
    password: 'recepcion123'
  });
  console.log('login_recepcion', loginRec.status, loginRec.body.user?.role);

  const ratesRec = await agent.get('/api/rates');
  console.log('rates_recepcion', ratesRec.status);

  const roomsRec = await agent.get('/api/rooms');
  console.log('rooms_recepcion', roomsRec.status);

  const statsDenied = await agent.get('/api/configuracion');
  console.log('config_recepcion', statsDenied.status);

  if (login.status !== 200 || me.status !== 200 || ratesAdmin.status === 401) {
    process.exitCode = 1;
  }
  if (ratesRec.status !== 403 || roomsRec.status === 401 || statsDenied.status !== 403) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
