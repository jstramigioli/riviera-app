/**
 * Smoke PGH-44: login → update Client → list audit-logs → check createdAt on Client.
 * Uso: node scripts/smoke-audit.js [baseUrl]
 */
const base = process.argv[2] || 'http://127.0.0.1:3011/api';

async function main() {
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) throw new Error(`login ${loginRes.status}: ${JSON.stringify(loginBody)}`);

  const cookie = loginRes.headers.getSetCookie?.()?.[0]?.split(';')[0]
    || (loginRes.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('sin cookie de sesión');

  const clientsRes = await fetch(`${base}/clients`, { headers: { Cookie: cookie } });
  const clients = await clientsRes.json();
  if (!clientsRes.ok || !Array.isArray(clients) || clients.length === 0) {
    throw new Error(`clients fail: ${clientsRes.status}`);
  }

  const sample = clients[0];
  if (!sample.createdAt || !sample.updatedAt) {
    throw new Error(`Client sin timestamps: ${JSON.stringify(sample)}`);
  }

  const note = `audit-smoke ${new Date().toISOString()}`;
  const updateRes = await fetch(`${base}/clients/${sample.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      firstName: sample.firstName,
      lastName: sample.lastName,
      email: sample.email,
      phone: sample.phone,
      documentType: sample.documentType,
      documentNumber: sample.documentNumber,
      country: sample.country,
      province: sample.province,
      city: sample.city,
      notes: note,
      wantsPromotions: sample.wantsPromotions
    })
  });
  const updated = await updateRes.json();
  if (!updateRes.ok) throw new Error(`update ${updateRes.status}: ${JSON.stringify(updated)}`);

  // pequeña espera por si el write de audit es async (aquí es await, pero igual)
  await new Promise((r) => setTimeout(r, 200));

  const auditRes = await fetch(`${base}/audit-logs?entity=Client&limit=5`, {
    headers: { Cookie: cookie }
  });
  const audit = await auditRes.json();
  if (!auditRes.ok) throw new Error(`audit ${auditRes.status}: ${JSON.stringify(audit)}`);

  const hit = (audit.items || []).find((row) => row.entityId === String(sample.id) && row.action === 'UPDATE');
  if (!hit) throw new Error(`no AuditLog UPDATE Client#${sample.id}: ${JSON.stringify(audit.items)}`);
  if (hit.actorUsername !== 'admin') throw new Error(`actor inesperado: ${hit.actorUsername}`);

  const deniedLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'recepcion', password: 'recepcion123' })
  });
  const deniedCookie = deniedLogin.headers.getSetCookie?.()?.[0]?.split(';')[0]
    || (deniedLogin.headers.get('set-cookie') || '').split(';')[0];
  const denied = await fetch(`${base}/audit-logs`, { headers: { Cookie: deniedCookie } });
  if (denied.status !== 403) throw new Error(`recepcion debería 403, got ${denied.status}`);

  console.log(JSON.stringify({
    ok: true,
    clientId: sample.id,
    clientCreatedAt: sample.createdAt,
    auditId: hit.id,
    actor: hit.actorUsername,
    summary: hit.summary
  }, null, 2));
}

main().catch((err) => {
  console.error('SMOKE_FAIL', err.message);
  process.exit(1);
});
