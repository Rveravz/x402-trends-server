import express from "express";

const LIVE_BASE = "https://x402-trends-server.onrender.com";
const NETWORK = "eip155:8453";
const PAYMENT_TOKEN = "USDC";

const endpoints = [
  { method: "POST", path: "/api/scrape", price: "$0.005", description: "Extract clean readable text from a public webpage." },
  { method: "GET", path: "/api/exchange-rate", price: "$0.01", description: "Convert fiat currencies using current reference rates." },
  { method: "GET", path: "/api/trends", price: "$0.02", description: "Get the latest spaceflight and space-industry news." },
  { method: "GET", path: "/api/weather", price: "$0.02", description: "Get U.S. NOAA/NWS forecasts by latitude and longitude." },
  { method: "POST", path: "/api/url-analyze", price: "$0.03", description: "Analyze public webpage metadata, headings, links, emails, and social profiles." },
  { method: "POST", path: "/api/parse-receipt", price: "$0.05", description: "Parse raw receipt text into structured purchase data." },
  { method: "GET", path: "/api/crypto-market", price: "$0.05", description: "Get live Coinbase Exchange crypto ticker and market statistics." },
  { method: "GET", path: "/api/sec-company", price: "$0.05", description: "Get SEC EDGAR company information and recent filings by ticker." },
  { method: "POST", path: "/api/website-research", price: "$0.10", description: "Create a detailed public website research snapshot." },
  { method: "GET", path: "/api/sports-game-brief", price: "$0.05", description: "Get normalized NBA, NFL, MLB, and EPL schedules, scores, and game briefs." },
  { method: "GET", path: "/api/base-wallet-balance", price: "$0.003", description: "Get Base Mainnet ETH and USDC wallet balances." },
  { method: "GET", path: "/api/base-tx-status", price: "$0.005", description: "Get Base transaction status, confirmations, gas, and receipt details." },
];

const llmsText = `# x402 Agent Data API

> Production pay-per-request data API for AI agents using x402 payments in USDC on Base Mainnet.

## Service
- Base URL: ${LIVE_BASE}
- Protocol: x402 v2
- Network: Base Mainnet (${NETWORK})
- Payment token: ${PAYMENT_TOKEN}
- OpenAPI: ${LIVE_BASE}/openapi.json
- Health: ${LIVE_BASE}/health
- Machine manifest: ${LIVE_BASE}/.well-known/x402.json
- GitHub: https://github.com/Rveravz/x402-trends-server

## How to use
Protected routes return HTTP 402 with x402 payment requirements. A compatible x402 client signs the Base Mainnet USDC authorization and retries the request with the payment payload. The server verifies and settles through Coinbase CDP, then returns JSON data.

## Paid endpoints
${endpoints.map((endpoint) => `- ${endpoint.method} ${endpoint.path} — ${endpoint.price} — ${endpoint.description}`).join("\n")}

## Free discovery endpoints
- GET / — service and pricing catalog
- GET /health — uptime and configuration status
- GET /openapi.json — OpenAPI description
- GET /llms.txt — LLM-oriented service summary
- GET /agents.json — agent-oriented machine manifest
- GET /.well-known/agents.json — well-known alias for the agent manifest
- GET /.well-known/x402.json — x402-oriented machine manifest
- GET /.well-known/x402 — alias for the x402 machine manifest

## Best agent use cases
- Base wallet balance and transaction verification
- Web scraping, URL analysis, and website research
- Current crypto market data
- SEC company and filing research
- Sports schedules and scores
- U.S. weather forecasts
- Currency conversion
- Structured receipt parsing

All paid prices are per request and denominated in USDC-equivalent dollar amounts via x402.
`;

function buildManifest() {
  return {
    name: "x402 Agent Data API",
    description: "Pay-per-request structured data tools for AI agents using x402 on Base Mainnet.",
    version: "2.6.0",
    baseUrl: LIVE_BASE,
    protocol: "x402",
    x402Version: 2,
    network: NETWORK,
    networkName: "Base Mainnet",
    paymentToken: PAYMENT_TOKEN,
    paymentAsset: "USDC",
    openapi: `${LIVE_BASE}/openapi.json`,
    llms: `${LIVE_BASE}/llms.txt`,
    health: `${LIVE_BASE}/health`,
    repository: "https://github.com/Rveravz/x402-trends-server",
    discovery: {
      bazaar: true,
      manifest: `${LIVE_BASE}/.well-known/x402.json`,
      agentManifest: `${LIVE_BASE}/.well-known/agents.json`,
    },
    endpoints: endpoints.map((endpoint) => ({
      ...endpoint,
      url: `${LIVE_BASE}${endpoint.path}`,
      paymentRequired: true,
    })),
  };
}

function registerDiscoveryRoutes(app) {
  app.get("/llms.txt", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.type("text/plain; charset=utf-8").send(llmsText);
  });

  const manifestHandler = (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.json(buildManifest());
  };

  app.get("/agents.json", manifestHandler);
  app.get("/.well-known/agents.json", manifestHandler);
  app.get("/.well-known/x402.json", manifestHandler);
  app.get("/.well-known/x402", manifestHandler);
}

const originalInit = express.application.init;

express.application.init = function patchedInit(...args) {
  const result = originalInit.apply(this, args);
  registerDiscoveryRoutes(this);
  return result;
};
