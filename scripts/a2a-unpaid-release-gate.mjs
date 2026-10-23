#!/usr/bin/env node
// Read-only release gate. Never sends x402 payment headers or authorizes payment.
// Usage: node scripts/a2a-unpaid-release-gate.mjs [base-url]
const base = (process.argv[2] || 'https://x402-trends-server.onrender.com').replace(/\/$/, '');
const results = [];
async function probe(name, path, init, validate) {
  try {
    const response = await fetch(base + path, {
      ...init, redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json', 'User-Agent': 'x402-a2a-unpaid-gate/1.0', ...(init.headers || {}) },
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    results.push({ name, ok: Boolean(validate(response, data)), status: response.status });
  } catch (e) {
    results.push({ name, ok: false, status: 'ERROR', reason: String(e?.message || e) });
  }
}
const jsonHeaders = { 'Content-Type': 'application/json', 'A2A-Version': '1.0' };
const send = (id, method='SendMessage') => JSON.stringify({
  jsonrpc: '2.0', id, method, params: { message: {
    messageId: 'release-gate-no-pay-1', role: 'ROLE_USER',
    parts: [{ text: 'heartbeat (discovery only, do not run paid tools)' }]
  } }
});
await probe('health', '/health', { method: 'GET' }, (r, d) => r.status === 200 && d?.status === 'ok');
await probe('AgentCard', '/.well-known/agent-card.json', { method: 'GET' }, (r, d) =>
  r.status === 200 && Array.isArray(d?.supportedInterfaces) &&
  d.supportedInterfaces.some(i => i.protocolBinding === 'JSONRPC' && i.url === `${base}/a2a`));
await probe('A2A SendMessage heartbeat', '/a2a', { method: 'POST', headers: jsonHeaders, body: send('gate-42') }, (r, d) =>
  r.status === 200 && r.headers.get('a2a-version') === '1.0' && d?.jsonrpc === '2.0' &&
  d?.id === 'gate-42' && d?.result?.message?.role === 'ROLE_AGENT' &&
  /no paid action was performed/i.test(d?.result?.message?.parts?.[0]?.text || ''));
await probe('A2A unknown method', '/a2a', { method: 'POST', headers: jsonHeaders, body: send(12, 'not_a_method') }, (r, d) =>
  r.status === 200 && d?.id === 12 && d?.error?.code === -32601);
await probe('A2A bad version', '/a2a', { method: 'POST', headers: { ...jsonHeaders, 'A2A-Version': '0.3' }, body: send('bad-version') }, (r, d) =>
  r.status === 200 && d?.error?.code === -32600);
await probe('A2A 16KB body bound', '/a2a', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ big: 'x'.repeat(17000) }) }, (r, d) =>
  r.status === 413 && d?.error?.code === -32600);
await probe('A2A malformed JSON', '/a2a', { method: 'POST', headers: jsonHeaders, body: '{bad-json' }, (r, d) =>
  r.status === 400 && d?.jsonrpc === '2.0' && d?.error?.code === -32700);
await probe('OpenAPI Base paths', '/openapi.json', { method: 'GET' }, (r, d) =>
  r.status === 200 && d?.openapi === '3.1.0' &&
  Boolean(d?.paths?.['/api/base-wallet-balance']?.get) &&
  Boolean(d?.paths?.['/api/base-tx-status']?.get));
for (const path of [
  '/api/crypto-market', '/api/exchange-rate', '/api/trends', '/api/weather',
  '/api/sec-company', '/api/sports-game-brief',
  '/api/base-wallet-balance', '/api/base-tx-status',
]) {
  await probe(`unpaid GET ${path}`, path, { method: 'GET' }, r => r.status === 402);
}
for (const path of ['/api/scrape', '/api/url-analyze', '/api/parse-receipt', '/api/website-research']) {
  await probe(`unpaid POST ${path}`, path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }, r => r.status === 402);
}
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed; no payment headers or settlements sent.`);
if (failed) process.exitCode = 1;
