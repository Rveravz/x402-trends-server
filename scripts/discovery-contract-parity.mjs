// Offline-only drift check. No network, wallet, credentials or paid calls.
import { readFileSync } from 'node:fs';
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const discovery = readFileSync(new URL('../discovery-bootstrap.js', import.meta.url), 'utf8');
const guard = readFileSync(new URL('./x402-unpaid-price-integrity.mjs', import.meta.url), 'utf8');
function block(source, start, end) {
  const i = source.indexOf(start);
  if (i < 0) throw Error('Missing section: ' + start);
  const j = source.indexOf(end, i + start.length);
  if (j < 0) throw Error('Unterminated section: ' + start);
  return source.slice(i, j);
}
function rows(source, pattern, label) {
  const found = new Map();
  for (const match of source.matchAll(pattern)) {
    const [, method, path, price] = match;
    if (found.has(path)) throw Error(label + ' duplicate: ' + path);
    found.set(path, {method, price});
  }
  return found;
}
const serverRows = rows(block(server, 'const paidEndpoints = {', '\n};'),
  /^\s*\w+:\s*\{\s*method:\s*["'](GET|POST)["'],\s*path:\s*["'](\/api\/[^"']+)["'],\s*price:\s*["'](\$[\d.]+)["']/gm, 'server');
const manifestRows = rows(block(discovery, 'const endpoints = [', '\n];'),
  /^\s*\{\s*method:\s*["'](GET|POST)["'],\s*path:\s*["'](\/api\/[^"']+)["'],\s*price:\s*["'](\$[\d.]+)["']/gm, 'manifest');
const guardRows = rows(guard, /\['(GET|POST)', '(\/api\/[^']+)', '(\d+)'\]/g, 'unpaid guard');
const openapi = server.slice(server.indexOf('app.get("/openapi.json"'));
const issues = [];
for (const [name, map] of [['server', serverRows], ['manifest', manifestRows], ['unpaid guard', guardRows]]) {
  if (map.size !== 12) issues.push(name + ': expected 12 paths, found ' + map.size);
}
for (const path of new Set([...serverRows.keys(), ...manifestRows.keys(), ...guardRows.keys()])) {
  const a = serverRows.get(path), b = manifestRows.get(path), c = guardRows.get(path);
  if (!a || !b || !c) { issues.push(path + ': absent from a contract'); continue; }
  if (a.method !== b.method || a.method !== c.method) issues.push(path + ': HTTP method mismatch');
  if (a.price !== b.price) issues.push(path + ': price mismatch');
  const parts = /^\$(\d+)\.(\d{1,6})$/.exec(a.price);
  if (!parts) issues.push(path + ': invalid USDC price');
  else if ((BigInt(parts[1])*1000000n+BigInt(parts[2].padEnd(6,'0'))).toString() !== c.price) issues.push(path + ': unpaid challenge fixture price mismatch');
  const i = openapi.indexOf('"' + path + '"');
  const operation = i < 0 ? null : /^\s*:\s*\{\s*(get|post)\s*:/.exec(openapi.slice(i + path.length + 2));
  if (!operation || operation[1].toUpperCase() !== a.method) issues.push(path + ': OpenAPI method missing/mismatched');
}
for (const issue of issues) console.error('FAIL', issue);
console.log((issues.length ? 'FAIL' : 'PASS') + ': 12 route contracts compared across server, manifest, OpenAPI and unpaid challenge fixtures; zero network/payments');
if (issues.length) process.exitCode = 1;
