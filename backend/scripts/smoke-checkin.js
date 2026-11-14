const base = 'http://127.0.0.1:3001/api';
async function main() {
  const loginRes = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const cookie = loginRes.headers.getSetCookie?.()?.map(c => c.split(';')[0]).join('; ')
    || (loginRes.headers.get('set-cookie') || '').split(',').map(p => p.split(';')[0].trim()).filter(Boolean).join('; ');
  console.log('login', loginRes.status, loginBody.user?.username || loginBody.error || loginBody.message, 'cookie?', !!cookie);

  const listRes = await fetch(base + '/reservations', { headers: { Cookie: cookie } });
  const reservations = await listRes.json();
  const withEmail = (Array.isArray(reservations) ? reservations : []).find(r => r.mainClient?.email) || reservations[0];
  console.log('reservation', withEmail?.id, withEmail?.mainClient?.email);

  const sendRes = await fetch(base + `/reservations/${withEmail.id}/check-in/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({})
  });
  const sendBody = await sendRes.json();
  console.log('send', sendRes.status, { emailed: sendBody.emailed, url: sendBody.checkInUrl, err: sendBody.error });
  if (!sendBody.checkInUrl) process.exit(1);
  const token = sendBody.checkInUrl.split('/').pop();

  const getRes = await fetch(base + `/public/check-in/${token}`);
  const getBody = await getRes.json();
  console.log('public get', getRes.status, getBody.fields?.firstName, getBody.fields?.vehiclePlate);

  const postRes = await fetch(base + `/public/check-in/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...getBody.fields,
      vehiclePlate: 'AB123CD',
      city: getBody.fields?.city || 'Villa Gesell'
    })
  });
  const postBody = await postRes.json();
  console.log('public post', postRes.status, postBody);

  const statusRes = await fetch(base + `/reservations/${withEmail.id}/check-in`, { headers: { Cookie: cookie } });
  const statusBody = await statusRes.json();
  console.log('status', statusRes.status, statusBody.vehiclePlate, statusBody.checkIn?.status);
}
main().catch(e => { console.error(e); process.exit(1); });
