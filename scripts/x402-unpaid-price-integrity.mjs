#!/usr/bin/env node
// Unpaid, read-only challenge price guard. No wallets, private keys, payment headers or settlement calls.
// Usage: node scripts/x402-unpaid-price-integrity.mjs [base-url] [--self-test]
// Probes each route with its declared HTTP method; POST probes send only an empty JSON body.
const base = (process.argv[2]?.startsWith('http') ? process.argv[2] : 'https://x402-trends-server.onrender.com').replace(/\/$/, '');
const expected = [
  ['POST', '/api/scrape', '5000'], ['GET', '/api/exchange-rate', '10000'],
  ['GET', '/api/trends', '20000'], ['GET', '/api/weather', '20000'],
  ['POST', '/api/url-analyze', '30000'], ['POST', '/api/parse-receipt', '50000'],
  ['GET', '/api/crypto-market', '50000'], ['GET', '/api/sec-company', '50000'],
  ['POST', '/api/website-research', '100000'], ['GET', '/api/sports-game-brief', '50000'],
  ['GET', '/api/base-wallet-balance', '3000'], ['GET', '/api/base-tx-status', '5000'],
];
const usdcBase = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
function decode(value) {
  if (!value) return null;
  try {
    const text = value.trim();
    if (text.startsWith('{')) return JSON.parse(text);
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64').toString('utf8'));
  } catch { return null; }
}
function validChallenge(status, header, amount) {
  const body = decode(header);
  return status === 402 && Array.isArray(body?.accepts) && body.accepts.some(a =>
    a?.network === 'eip155:8453' && String(a.amount ?? a.maxAmountRequired ?? '') === amount &&
    String(a.asset ?? '').toLowerCase() === usdcBase);
}
if (process.argv.includes('--self-test')) {
  const fixture = { x402Version: 2, accepts: [{ network: 'eip155:8453', amount: '5000', asset: usdcBase }] };
  const header = Buffer.from(JSON.stringify(fixture)).toString('base64url');
  const assertions = [
    validChallenge(402, header, '5000'), !validChallenge(402, header, '5001'),
    !validChallenge(200, header, '5000'), !validChallenge(402, 'not-json', '5000'),
    validChallenge(402, JSON.stringify(fixture), '5000'),
    !validChallenge(402, Buffer.from(JSON.stringify({ accepts: [{...fixture.accepts[0], network: 'eip155:84532'}] })).toString('base64'), '5000'),
    expected.length === 12 && expected.filter(([method]) => method === 'POST').length === 4,
  ];
  if (assertions.some(x => !x)) { console.error('FAIL unpaid price integrity fixtures'); process.exitCode = 1; }
  else console.log(`PASS ${assertions.length}/${assertions.length} unpaid challenge fixtures`);
} else {
  let passed = 0;
  for (const [method, path, amount] of expected) {
    try {
      // Never provide payment credentials. POST routes receive only '{}' and must return 402.
      const response = await fetch(base + path, { method, redirect: 'manual',
        signal: AbortSignal.timeout(12000),
        headers: { Accept: 'application/json', 'User-Agent': 'x402-unpaid-price-integrity/1.0',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: '{}' } : {}),
      });
      const header = response.headers.get('payment-required') || response.headers.get('x-payment-required');
      const ok = validChallenge(response.status, header, amount);
      if (ok) passed++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${path}: HTTP ${response.status}, expected ${amount} USDC base units`);
    } catch (e) { console.log(`FAIL ${method} ${path}: ${e?.message || e}`); }
  }
  console.log(`${passed}/${expected.length} payment challenges have expected Base USDC price. No payments sent.`);
  if (passed !== expected.length) process.exitCode = 1;
}
