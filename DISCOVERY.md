# Machine discovery

This service exposes multiple free discovery surfaces so AI agents, x402 crawlers, API catalogs, and A2A-compatible clients can understand the service before making a paid request.

Production base URL: `https://x402-trends-server.onrender.com`

## Discovery routes

| Route | Purpose |
|---|---|
| `GET /` | Human- and machine-readable service/pricing catalog |
| `GET /health` | Service health and configuration status |
| `GET /openapi.json` | OpenAPI description |
| `GET /llms.txt` | LLM-oriented service summary |
| `GET /.well-known/api-catalog` | RFC 9727 API catalog linkset |
| `HEAD /.well-known/api-catalog` | RFC 9727 catalog discovery headers |
| `GET /agents.json` | Agent-oriented machine manifest |
| `GET /.well-known/agent-card.json` | Standard A2A AgentCard discovery route |
| `GET /.well-known/agent.json` | Legacy A2A-style AgentCard alias |
| `GET /.well-known/agents.json` | Well-known agent manifest alias |
| `GET /.well-known/x402.json` | x402-oriented machine manifest |
| `GET /.well-known/x402` | x402 manifest alias |

The AgentCard/manifest advertises A2A protocol version `1.0`, x402 v2, Base Mainnet (`eip155:8453`), USDC payment, supported skills, security requirements, OpenAPI, health, repository, and paid endpoint metadata.

## Paid-resource discovery probes

Some paid resources execute with `POST`. Discovery crawlers frequently probe resources with `GET` or `HEAD`, so POST-only resources expose an unpaid discovery compatibility probe. An unpaid GET/HEAD probe is internally translated only far enough to return the genuine x402 payment challenge.

This does **not** change the paid execution method. A request carrying a payment payload to a POST-only resource must still use `POST`.

Responses from this compatibility path include:

- `X-X402-Discovery-Probe: GET-to-POST`
- `X-X402-Execution-Method: POST`

## Payment behavior

Protected routes return HTTP `402 Payment Required` with machine-readable x402 payment requirements. Paid execution uses USDC on Base Mainnet and the configured Coinbase CDP x402 settlement path.

Discovery routes themselves are free and must never require a payment.

## Indexing targets

The project is designed to be consumable by legitimate ecosystem discovery surfaces, including Coinbase Bazaar/CDP discovery, Agentic.Market-style catalogs, x402 directory crawlers, A2A clients, generic OpenAPI tooling, RFC 9727-aware catalogs, and LLM-oriented discovery clients.

The project intentionally avoids synthetic paid traffic or paid self-transactions to inflate usage metrics. Unique external payers and repeat organic purchases are treated as stronger demand signals than raw call count.
