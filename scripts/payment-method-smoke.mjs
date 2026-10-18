// Non-paying x402 method checks; never sends payment credentials.
// Usage: node scripts/payment-method-smoke.mjs [base-url]
const base = (process.argv[2] || 'https://x402-trends-server.onrender.com').replace(/\/$/, '');
const endpoints = [
  ['GET', '/api/exchange-rate'], ['GET', '/api/trends'],
  ['GET', '/api/weather'], ['GET', '/api/crypto-market'],
  ['GET', '/api/sec-company'], ['GET', '/api/sports-game-brief'],
  ['GET', '/api/base-wallet-balance'], ['GET', '/api/base-tx-status'],
  ['POST', '/api/scrape'], ['POST', '/api/url-analyze'],
  ['POST', '/api/parse-receipt'], ['POST', '/api/website-research'],
];
const results = [];
async function check(method, path, expected) {
  try {
    const res = await fetch(base + path, {
      method, redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json', 'User-Agent': 'x402-unpaid-method-check/1.0',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    const ok = expected === 'challenge' ? res.status === 402 : res.status >= 400;
    results.push({ method, path, status: res.status, ok });
  } catch (error) {
    results.push({ method, path, status: 'ERROR', ok: false, detail: String(error?.message || error) });
  }
}
for (const [method, path] of endpoints) {
  await check(method, path, 'challenge');
  if (method === 'POST') await check('GET', path, 'challenge');
  await check('HEAD', path, 'deny');
}
for (const r of results) {
  console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.method + ' ' + r.path + ': ' + r.status +
    (r.detail ? ' (' + r.detail + ')' : ''));
}
const failed = results.filter(r => !r.ok).length;
console.log((results.length - failed) + '/' + results.length + ' non-paying checks passed; no payment headers or settlements sent.');
if (failed) process.exitCode = 1;
