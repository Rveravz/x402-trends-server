#!/usr/bin/env node
// Read-only x402 discovery regression check. No payment headers, signatures, or spending.
// Usage: node base-discovery-unpaid-gate.mjs [base-url]
const base = (process.argv[2] || 'https://x402-trends-server.onrender.com').replace(/\/$/, '');
const expected = [
  { key: 'baseWalletBalance', path: '/api/base-wallet-balance', price: '$0.003' },
  { key: 'baseTxStatus', path: '/api/base-tx-status', price: '$0.005' },
];
const results = [];
async function check(name, path, test) {
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json', 'User-Agent': 'x402-base-discovery-unpaid-gate/1.0' },
    });
    const raw = await response.text();
    let body = null;
    try { body = JSON.parse(raw); } catch {}
    results.push({ name, status: response.status, pass: Boolean(test(response, body)) });
  } catch (error) {
    results.push({ name, status: 'ERROR', pass: false, reason: String(error?.message || error) });
  }
}
await check('service root and Base route manifest', '/', (response, body) =>
  response.status === 200 && expected.every(({ key, path, price }) =>
    body?.paidEndpoints?.[key]?.path === path && body?.paidEndpoints?.[key]?.price === price));
// Verify all public discovery surfaces without sending any payment authorization.
await check('x402 manifest lists both Base resources', '/.well-known/x402.json', (response, body) =>
  response.status === 200 && expected.every(({ path, price }) =>
    Array.isArray(body?.endpoints) && body.endpoints.some(item =>
      item.path === path && item.method === 'GET' && item.price === price &&
      item.paymentRequired === true && item.url === `${base}${path}`)));
await check('RFC 9727 catalog links both Base resources', '/.well-known/api-catalog', (response, body) =>
  response.status === 200 && Array.isArray(body?.linkset) &&
  body.linkset.some(set => Array.isArray(set?.item) && expected.every(({ path }) =>
    set.item.some(item => item.href === `${base}${path}`))));
await check('OpenAPI declares both Base GET operations', '/openapi.json', (response, body) =>
  response.status === 200 && expected.every(({ path }) =>
    Boolean(body?.paths?.[path]?.get)));
await check('AgentCard discoverable', '/.well-known/agent-card.json', (response, body) =>
  response.status === 200 && Array.isArray(body?.skills) &&
  body.skills.some(skill => /base/i.test(JSON.stringify(skill))));
for (const { path } of expected) {
  await check(`unpaid ${path} requires payment`, path, response => response.status === 402);
}
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
const failed = results.filter(r => !r.pass).length;
console.log(`${results.length - failed}/${results.length} passed. No payment authorization sent.`);
if (failed) process.exitCode = 1;
