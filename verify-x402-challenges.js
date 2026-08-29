const BASE_URL = String(process.argv[2] || "https://x402-trends-server.onrender.com").replace(/\/$/, "");

const endpoints = [
  { method: "POST", path: "/api/scrape" },
  { method: "GET", path: "/api/exchange-rate" },
  { method: "GET", path: "/api/trends" },
  { method: "GET", path: "/api/weather" },
  { method: "POST", path: "/api/url-analyze" },
  { method: "POST", path: "/api/parse-receipt" },
  { method: "GET", path: "/api/crypto-market" },
  { method: "GET", path: "/api/sec-company" },
  { method: "POST", path: "/api/website-research" },
  { method: "GET", path: "/api/sports-game-brief" },
  { method: "GET", path: "/api/base-wallet-balance" },
  { method: "GET", path: "/api/base-tx-status" },
];

function decodeHeader(value) {
  if (!value) return null;

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

function getPaymentRequiredHeader(response) {
  return (
    response.headers.get("payment-required") ||
    response.headers.get("x-payment-required") ||
    response.headers.get("www-authenticate")
  );
}

async function probe(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;

  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      "User-Agent": "x402-production-verifier/1.0",
    },
  });

  const header = getPaymentRequiredHeader(response);
  const decoded = decodeHeader(header);
  const accepts = Array.isArray(decoded?.accepts) ? decoded.accepts : [];
  const baseMainnet = accepts.some((item) => item?.network === "eip155:8453");

  return {
    endpoint,
    status: response.status,
    hasPaymentRequired: Boolean(header),
    decodes: Boolean(decoded),
    baseMainnet,
    discoveryProbe: response.headers.get("x-x402-discovery-probe"),
  };
}

console.log("====================================================");
console.log("X402 PRODUCTION CHALLENGE VERIFICATION");
console.log("====================================================");
console.log(`Base URL: ${BASE_URL}`);
console.log("No payments will be made.\n");

let passed = 0;

for (const endpoint of endpoints) {
  try {
    const result = await probe(endpoint);
    const ok = result.status === 402 && result.hasPaymentRequired && result.decodes && result.baseMainnet;
    if (ok) passed += 1;

    const methodNote = endpoint.method === "POST" ? "GET discovery probe -> POST execution" : "GET execution";
    console.log(`${ok ? "✅" : "❌"} ${endpoint.path}`);
    console.log(`   Actual method: ${endpoint.method}`);
    console.log(`   Probe mode: ${methodNote}`);
    console.log(`   HTTP: ${result.status}`);
    console.log(`   PAYMENT-REQUIRED: ${result.hasPaymentRequired ? "yes" : "no"}`);
    console.log(`   Challenge decodes: ${result.decodes ? "yes" : "no"}`);
    console.log(`   Base Mainnet: ${result.baseMainnet ? "yes" : "no"}`);
    if (result.discoveryProbe) console.log(`   Compatibility: ${result.discoveryProbe}`);
    console.log("");
  } catch (error) {
    console.log(`❌ ${endpoint.path}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

console.log("----------------------------------------------------");
console.log(`${passed}/${endpoints.length} routes expose a valid crawler-visible x402 challenge.`);
console.log("----------------------------------------------------");

if (passed !== endpoints.length) process.exitCode = 1;
