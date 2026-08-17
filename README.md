# x402 Agent Data API

![x402](https://img.shields.io/badge/x402-v2-111827)
![Network](https://img.shields.io/badge/network-Base%20Mainnet-0052FF)
![Payment](https://img.shields.io/badge/payment-USDC-2775CA)
![Version](https://img.shields.io/badge/version-2.6.0-2ea44f)
![Node](https://img.shields.io/badge/node-%3E%3D22-339933)

Production pay-per-request API server built for AI agents using the x402 payment protocol on Base Mainnet.

**Live API:** https://x402-trends-server.onrender.com  
**OpenAPI:** https://x402-trends-server.onrender.com/openapi.json  
**Network:** Base Mainnet (`eip155:8453`)  
**Payment token:** USDC  
**Current server version:** `2.6.0`

## Why this exists

AI agents often need one small piece of current data without maintaining another account, subscription, API key, billing relationship, or long-lived credential. This service packages useful data into small structured endpoints that can be purchased per request with x402.

The project is optimized around:

- low-cost pay-per-call access
- Base Mainnet USDC payments
- Coinbase CDP x402 settlement
- Coinbase Bazaar discovery metadata
- structured JSON responses for AI agents
- inexpensive or free upstream data sources where practical
- endpoint selection based on real buyer demand rather than endpoint count

## Featured agent tools

### Base wallet balance — `$0.003`

```text
GET /api/base-wallet-balance?address=0x...
```

Returns Base Mainnet ETH and USDC balances plus the current block number.

### Base transaction status — `$0.005`

```text
GET /api/base-tx-status?hash=0x...
```

Returns transaction state, confirmations, block, sender/recipient, value, gas usage, receipt details, and a Basescan URL.

### Website research — `$0.10`

```text
POST /api/website-research
```

Returns a structured research snapshot for a public website.

### Sports game brief — `$0.05`

```text
GET /api/sports-game-brief?league=MLB&date=2026-08-16&limit=5
```

Supports NBA, NFL, MLB, and EPL schedules, scores, and game briefs.

## Paid endpoints

| Method | Endpoint | Price | Purpose |
|---|---|---:|---|
| POST | `/api/scrape` | $0.005 | Extract clean readable text from a public webpage |
| GET | `/api/exchange-rate` | $0.01 | Currency conversion using current reference rates |
| GET | `/api/trends` | $0.02 | Latest spaceflight and space-industry news |
| GET | `/api/weather` | $0.02 | U.S. NOAA/NWS weather forecast by coordinates |
| POST | `/api/url-analyze` | $0.03 | Analyze webpage metadata, headings, links, emails, and socials |
| POST | `/api/parse-receipt` | $0.05 | Convert raw receipt text into structured purchase data |
| GET | `/api/crypto-market` | $0.05 | Coinbase Exchange crypto ticker and market statistics |
| GET | `/api/sec-company` | $0.05 | SEC EDGAR company details and recent filings |
| POST | `/api/website-research` | $0.10 | Detailed website research snapshot |
| GET | `/api/sports-game-brief` | $0.05 | NBA, NFL, MLB, and EPL schedules, scores, and game briefs |
| GET | `/api/base-wallet-balance` | $0.003 | Base Mainnet ETH and USDC wallet balances |
| GET | `/api/base-tx-status` | $0.005 | Base transaction status, confirmations, gas, and receipt data |

## Free discovery endpoints

These routes do not require payment:

- `GET /` — service information and endpoint catalog
- `GET /health` — health/status information
- `GET /openapi.json` — OpenAPI description

## For AI agents

A normal unpaid request to a protected route returns HTTP `402 Payment Required` with x402 payment requirements. A compatible x402 client can read that challenge, authorize the Base USDC payment, retry the request, and receive JSON.

Probe a protected endpoint without making a payment:

```bash
curl -i "https://x402-trends-server.onrender.com/api/base-wallet-balance?address=0xF61F957D9aC432309219549b1Ae79Ae8b7C71fF5"
```

Other examples:

```text
GET /api/crypto-market?pair=BTC-USD
GET /api/sec-company?ticker=TSLA
GET /api/sports-game-brief?league=NFL&date=2026-09-13&limit=5
```

## x402 payment flow

1. An agent requests a protected endpoint.
2. The server responds with HTTP `402` and x402 payment requirements.
3. A compatible x402 client signs the Base Mainnet USDC payment authorization.
4. The request is retried with the payment payload.
5. Coinbase CDP verifies and settles the payment.
6. The server returns the requested JSON data.

No traditional API subscription is required for the buyer.

## Discovery

Paid routes declare Coinbase Bazaar discovery metadata with structured inputs, outputs, descriptions, and examples. The project is designed to be found by agents searching for capabilities rather than by a human memorizing endpoint names.

The broader x402 ecosystem also maintains public discovery surfaces such as x402scan, Agentic.Market, Pay.sh, and Ampersend. The project is actively being optimized for legitimate discovery and real external usage rather than synthetic self-traffic.

## Request an endpoint

Have an agent workflow that needs a paid capability? Open an **Endpoint request** issue:

https://github.com/Rveravz/x402-trends-server/issues/new/choose

Strong requests explain the agent use case, example input/output, upstream source, and why pay-per-call is useful.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution guidelines.

## Data providers

Current upstream sources include:

- BALLDONTLIE — NBA, NFL, MLB, EPL
- Coinbase Exchange — public crypto market data
- NOAA / National Weather Service — U.S. weather
- U.S. SEC EDGAR — public-company filings and metadata
- Frankfurter — currency reference rates
- Spaceflight News API — spaceflight news
- Base Mainnet JSON-RPC — blockchain balances and transaction data

Some routes also process public webpage content directly.

## Local development

Requirements:

- Node.js 22+
- npm

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

## Environment variables

Required in production:

```text
CDP_API_KEY_ID
CDP_API_KEY_SECRET
X402_PAY_TO
SERVICE_CONTACT
BALLDONTLIE_API_KEY
```

Optional:

```text
BASE_RPC_URL
```

If `BASE_RPC_URL` is not set, the server uses the public Base Mainnet RPC endpoint. A dedicated RPC provider is recommended if blockchain traffic becomes significant.

**Never commit secrets, private keys, seed phrases, or `.env` files to this repository.**

## Deployment

The production service is deployed on Render from the `main` branch.

Typical Render configuration:

```text
Build Command: npm install
Start Command: npm start
```

Commits to `main` can trigger a new deployment when Render auto-deploy is enabled.

## Validation

The repository contains a GitHub Actions workflow that validates the live x402 configuration for key endpoints. It checks items such as:

- HTTP 402 behavior
- x402 version 2
- Base Mainnet network configuration
- seller wallet
- expected payment amount
- Bazaar discovery metadata
- Coinbase validation when available

The validation workflow does not intentionally make paid self-transactions.

## Project strategy

This project is being optimized around real x402 demand rather than endpoint count alone. New products are selected by looking at factors such as:

- unique buyer demand
- paid-call volume
- marketplace search visibility
- competitor pricing
- repeat agent utility
- upstream operating cost
- ability to return structured, current data

The current roadmap prioritizes blockchain utilities, web search/research, structured market intelligence, and other categories showing meaningful agent demand.

See [`PROJECT_LOG.md`](PROJECT_LOG.md) for the working project history and operating notes.

## Status

Production service: **active**  
Payment mode: **real Base Mainnet USDC**  
Bazaar discovery: **enabled**

---

This project is experimental infrastructure for machine-to-machine paid API access. Users are responsible for reviewing the data, upstream provider terms, and payment behavior appropriate for their own use case.
