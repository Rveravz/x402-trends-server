# Distribution and discovery surfaces

This project favors legitimate, machine-readable discovery over synthetic traffic, paid self-calls, or unsolicited outreach.

## Canonical machine discovery

Production base URL: `https://x402-trends-server.onrender.com`

- `GET /openapi.json` — OpenAPI description
- `GET /llms.txt` — LLM-oriented service summary
- `GET /.well-known/api-catalog` — RFC 9727 API catalog
- `GET /.well-known/agent-card.json` — A2A AgentCard
- `GET /.well-known/x402.json` — x402 machine manifest
- `GET /health` — health/status endpoint

The AgentCard declares A2A 1.0 interfaces, routable skills, and x402 payment security metadata. Paid execution remains protected by the existing x402 v2 payment middleware on Base Mainnet USDC.

## Ecosystem discovery surfaces to monitor

These are useful places to verify whether the service is discoverable. Inclusion can change independently of this repository.

- Coinbase CDP Bazaar — primary x402 discovery metadata and quality metrics
- Circle Agent Marketplace / Discovery API — keyless discovery across x402 services
- Agentic Market — independent x402 catalog
- x402.new — independent x402 directory and usage view
- Agenstry — agent/discovery visibility and observed on-chain inflow
- TOLL Index — cross-registry visibility, delisting/relisting signals, and registry health
- Signal402 — independent service/category tracking and ecosystem demand signals
- x402 Trust — independent reachability, payment-envelope compliance, and settlement tracking
- A2A directories — useful for validating AgentCard indexing and routability

## Operating rules

- Do not generate paid self-traffic to improve rankings.
- Do not treat verifier/test transactions as organic customers.
- Do not publish secrets, private keys, seed phrases, or environment values.
- Prefer low-cost, reversible metadata/documentation improvements.
- Preserve existing payment behavior when changing discovery surfaces.
- Measure unique payers and repeat purchases, not call count alone.
- Favor endpoint categories with repeat agent utility and inexpensive upstream data.

## Current positioning

The strongest demonstrated product categories in this service are inexpensive web extraction/research and structured agent utilities. Blockchain transaction intelligence is a natural adjacent category because Base RPC data can be sourced at very low operating cost.

Market monitoring should prioritize payer diversity over raw call volume. Whole-catalog measurements repeatedly show that many x402 listings have only one payer, so a small number of independent repeat buyers is a stronger product signal than synthetic or concentrated traffic.

This document is informational only; it does not register the service with third parties or submit wallet/account information.