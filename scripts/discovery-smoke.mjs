// Read-only discovery and payment-challenge smoke checks.
// No payment headers, signatures, wallet access, or settlement requests are sent.
const base = (process.argv[2] || 'https://x402-trends-server.onrender.com').replace(/\/$/, '');
const checks = [];
async function probe(label, path, init, validate) {
  try {
    const response = await fetch(`${base}${path}`, {
      redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json', 'User-Agent': 'x402-discovery-smoke/1.0', ...(init?.headers || {}) },
      ...init,
    });
    const result = await validate(response);
    checks.push({ label, ok: Boolean(result), status: response.status });
  } catch (error) {
    checks.push({ label, ok: false, error: String(error?.message || error) });
  }
}
await probe('health', '/health', undefined, async r => r.status === 200 && (await r.json()).status === 'ok');
await probe('AgentCard', '/.well-known/agent-card.json', undefined, async r => {
  if (r.status !== 200) return false;
  const card = await r.json();
  return Array.isArray(card.supportedInterfaces) && card.supportedInterfaces.some(x => x.protocolBinding === 'JSONRPC' && x.url.endsWith('/a2a'));
});
await probe('A2A SendMessage (read-only)', '/a2a', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'A2A-Version': '1.0' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 'smoke-1', method: 'SendMessage', params: { message: { messageId: 'smoke-1', role: 'ROLE_USER', parts: [{ text: 'List capabilities; do not execute paid tools.' }] } } }),
}, async r => {
  if (r.status !== 200) return false;
  const body = await r.json();
  return body.jsonrpc === '2.0' && body.id === 'smoke-1' && body.result?.message?.role === 'ROLE_AGENT';
});
await probe('unpaid x402 challenge', '/api/crypto-market?pair=BTC-USD', undefined, async r => {
  if (r.status !== 402) return false;
  const challenge = r.headers.get('payment-required') || r.headers.get('x-payment-required');
  if (!challenge) return false;
  try {
    const normalized = challenge.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return Array.isArray(payload.accepts) && payload.accepts.some(x => x.network === 'eip155:8453');
  } catch { return false; }
});
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.label}: ${c.status ?? c.error}`);
const failures = checks.filter(c => !c.ok).length;
console.log(`${checks.length - failures}/${checks.length} checks passed. No payments sent.`);
if (failures) process.exitCode = 1;
