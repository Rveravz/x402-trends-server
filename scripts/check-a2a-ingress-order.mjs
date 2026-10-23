// Static, non-paying release guard for the A2A 16 KiB ingress limit.
// Run: node scripts/check-a2a-ingress-order.mjs
// This intentionally does not start the server, contact Render, or execute payments.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../server.js"), "utf8");
const a2aHandler = readFileSync(resolve(here, "../a2a-handler.js"), "utf8");
const a2aErrorAt = a2aHandler.search(/app\\.use\\(\\s*["']\\/a2a["']\\s*,\\s*\\(\\s*err\\b/);
const a2aPostAt = a2aHandler.search(/app\\.post\\(\\s*["']\\/a2a["']/);
const handlesTooLarge = /err\\?\\.type\\s*===\\s*["']entity\\.too\\.large["']/.test(a2aHandler);
const handlesMalformed = /err\\?\\.type\\s*===\\s*["']entity\\.parse\\.failed["']/.test(a2aHandler);


const globalParser = /app\.use\(\s*express\.json\(\s*\{\s*limit:\s*["']1mb["']/i;
const dedicatedParser = /app\.use\(\s*["']\/a2a["']\s*,\s*express\.json\(\s*\{\s*limit:\s*["']16kb["']/i;
const globalAt = source.search(globalParser);
const dedicatedAt = source.search(dedicatedParser);
const registerAt = source.indexOf("registerA2ARoute(app)");

if (globalAt < 0 || dedicatedAt < 0 || registerAt < 0 ||
    !(dedicatedAt < registerAt && registerAt < globalAt) ||
    !(a2aErrorAt >= 0 && a2aPostAt > a2aErrorAt && handlesTooLarge && handlesMalformed)) {
  console.error("FAIL: A2A needs a 16kb parser, route-scoped 413/400 error handling, and route registration BEFORE the global 1mb parser.");
  console.error("This is a static guard, not proof of live HTTP 413 or x402 behavior.");
  process.exitCode = 1;
} else {
  console.log("PASS: A2A 16kb parser, 413/400 error handling, and route registration precede global 1mb parser.");
  console.log("Still run live, unpaid HTTP 413/402 regression checks before deploying.");
}
