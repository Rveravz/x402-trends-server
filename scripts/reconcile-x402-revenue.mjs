#!/usr/bin/env node
// Offline, read-only x402 transaction reconciliation. No network requests or payment actions.
// node scripts/reconcile-x402-revenue.mjs --input transactions.csv [--previous previous-snapshot.json]
// Required CSV headers: timestamp,tx_hash,log_index,amount_usdc,endpoint,paid_request_id,
// request_status,attribution,payer_verified_external,evidence_link,payer_address
// Attribution is operator-confirmed; this tool never guesses that a wallet is a customer.
import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

function csvRows(input) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted field');
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const nonempty = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!nonempty.length) throw new Error('Empty CSV');
  const headers = nonempty.shift().map(v => v.trim());
  const required = ['timestamp','tx_hash','log_index','amount_usdc','endpoint','paid_request_id',
    'request_status','attribution','payer_verified_external','evidence_link','payer_address'];
  for (const h of required) if (!headers.includes(h)) throw new Error(`Missing CSV column: ${h}`);
  return nonempty.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`Row ${i + 2}: expected ${headers.length} columns, got ${r.length}`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
function toMicros(s) {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(s)) throw new Error(`Invalid USDC amount: ${s}`);
  const [whole, fractional = ''] = s.split('.');
  return BigInt(whole) * 1000000n + BigInt(fractional.padEnd(6, '0'));
}
function money(n) { const sign = n < 0n ? '-' : ''; const a = n < 0n ? -n : n; return `${sign}${a / 1000000n}.${(a % 1000000n).toString().padStart(6,'0')}`; }
function classify(r) {
  const category = r.attribution.toLowerCase();
  if (['test','self-test','verifier','crawler'].includes(category)) return 'excluded_test_or_verifier';
  const validEvidence = r.paid_request_id && r.endpoint.startsWith('/api/') &&
    /^2\d\d$/.test(r.request_status) && r.payer_verified_external.toLowerCase() === 'true' &&
    /^https?:\/\//.test(r.evidence_link) && /^0x[a-f\d]{40}$/i.test(r.payer_address);
  return category === 'organic' && validEvidence ? 'confirmed_organic' : 'unattributed';
}
function reconcile(rows, previous) {
  const seen = new Set(); let observed = 0n, organic = 0n, excluded = 0n, unknown = 0n;
  const buyers = new Map(); let duplicates = 0;
  for (const r of rows) {
    if (!/^0x[a-f\d]{64}$/i.test(r.tx_hash)) throw new Error(`Invalid tx hash: ${r.tx_hash}`);
    if (!/^\d+$/.test(r.log_index)) throw new Error(`Invalid log index: ${r.log_index}`);
    if (Number.isNaN(Date.parse(r.timestamp))) throw new Error(`Invalid timestamp: ${r.timestamp}`);
    const key = `${r.tx_hash.toLowerCase()}:${BigInt(r.log_index)}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const amount = toMicros(r.amount_usdc); observed += amount;
    const type = classify(r);
    if (type === 'confirmed_organic') {
      organic += amount;
      const payer = r.payer_address.toLowerCase(); buyers.set(payer, (buyers.get(payer) || 0) + 1);
    } else if (type === 'excluded_test_or_verifier') excluded += amount;
    else unknown += amount;
  }
  let change = null;
  if (previous && /^\d+\.\d{6}$/.test(previous.observed_inflow_usdc || '')) {
    change = money(observed - toMicros(previous.observed_inflow_usdc));
  }
  return {
    generated_at: new Date().toISOString(),
    source: 'offline operator-supplied transaction CSV; no on-chain or payment verification performed',
    observed_inflow_usdc: money(observed), confirmed_organic_usdc: money(organic),
    excluded_test_verifier_usdc: money(excluded), unattributed_usdc: money(unknown),
    change_since_previous_snapshot_usdc: change,
    unique_confirmed_organic_payers: buyers.size,
    repeat_confirmed_organic_payers: [...buyers.values()].filter(n => n > 1).length,
    unique_transfer_events: seen.size, duplicate_rows_ignored: duplicates,
    caveat: 'Organic classification requires explicit operator evidence; CSV claims and URLs are not independently authenticated.'
  };
}
function selfTest() {
  const h = '0x' + 'a'.repeat(64), j = '0x' + 'b'.repeat(64), payer = '0x' + 'c'.repeat(40);
  const base = {timestamp:'2026-10-19T01:00:00Z',log_index:'0',amount_usdc:'0.010000',endpoint:'/api/weather',paid_request_id:'req-1',request_status:'200',attribution:'organic',payer_verified_external:'true',evidence_link:'https://example.com/evidence',payer_address:payer};
  const rows = [{...base,tx_hash:h},{...base,tx_hash:h},{...base,tx_hash:j,attribution:'verifier',amount_usdc:'0.005000'}];
  const result = reconcile(rows,{observed_inflow_usdc:'0.010000'});
  if (result.observed_inflow_usdc !== '0.015000' || result.confirmed_organic_usdc !== '0.010000' ||
      result.excluded_test_verifier_usdc !== '0.005000' || result.duplicate_rows_ignored !== 1 ||
      result.change_since_previous_snapshot_usdc !== '0.005000') throw new Error('Self-test failed');
  console.log('PASS offline reconciliation self-test (dedupe, attribution, amount, delta)');
}
const args = argv.slice(2);
try {
  if (args.includes('--self-test')) selfTest();
  else {
    const inputAt = args.indexOf('--input');
    if (inputAt < 0 || !args[inputAt + 1]) throw new Error('Usage: node reconcile-x402-revenue.mjs --input transactions.csv [--previous snapshot.json]');
    const prevAt = args.indexOf('--previous');
    const previous = prevAt < 0 ? null : JSON.parse(readFileSync(args[prevAt + 1], 'utf8'));
    console.log(JSON.stringify(reconcile(csvRows(readFileSync(args[inputAt + 1], 'utf8')), previous), null, 2));
  }
} catch (e) { console.error(`ERROR: ${e.message}`); exit(1); }
