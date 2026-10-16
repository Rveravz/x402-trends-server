# Zero-cost operations: revenue attribution, reliability and release gate

This runbook is for the x402 Agent Data API on Base Mainnet. It does not authorize payments, changes to billing, or production deployment.

## Hourly revenue accounting

Report three fields, with timestamps and source: (1) **confirmed organic revenue** from independently attributed external buyers, (2) **observed x402 settlements / wallet inflow** (separately, because generic transfers and tests can overlap), and (3) **delta since the prior snapshot**. If either snapshot is stale or unavailable, say "unknown"; never convert an absence of evidence into $0 of activity. Do not sum overlapping sources.

A transfer is **organic** only when there is evidence linking it to a genuine external customer's paid API invocation, such as a matching transaction hash, recipient, expected price, endpoint, success response, and a payer that is not an operator/test/verifier/crawler wallet. Distinct wallet addresses alone are not proof of independent buyers. Treat facilitator-associated payments, one-off crawlers, own-wallet tests, unmatched inflows, and unknown attribution as **unverified**, not organic. Do not collect or publish customer PII.

Recommended private ledger columns: UTC timestamp, chain, transaction hash, payer address, recipient, USDC amount, endpoint, response status, source, attribution (organic/test/verifier/crawler/unknown), confidence and evidence link. Deduplicate by chain + transaction hash + log index, and track repeat purchasers only after independent attribution.

## Non-paying reliability checks

- Render service: x402-trends-server in My Workspace. Read only service status, last deploy commit, events, logs, CPU, memory, bandwidth, request counts, p95 latency and error statuses. Missing metrics must be labelled unavailable, not zero.
- GET /health and /.well-known/agent-card.json: verify response status and expected content, when network access permits. A third-party successful probe is historical evidence, not proof of reachability in the current hour.
- POST /a2a: use a non-paying JSON-RPC SendMessage heartbeat with A2A-Version 1.0 only after deployment; ensure no paid tool execution. The AgentCard must advertise the actual live URL.
- Existing /api/*: verify unauthenticated requests return HTTP 402 with valid payment requirements. For POST-only routes, validate the documented unpaid discovery probe. Never attach payment headers or authorize settlement during tests.
- Record timestamps, check environment and result. Escalate any newly observed 5xx, missing 402 challenge, deploy failure, or drift between AgentCard and live JSON-RPC.

## Release safety gate

Keep changes on a reviewable branch. Run syntax checks, unit tests, Express integration tests and unpaid x402 402-regression tests before merge. Preserve payment middleware, pay-to wallet, facilitator settings, secrets and deployed endpoint contracts. Do not auto-merge or deploy when tests cannot be run, especially while the A2A route body-size limit is checked only after the global 1 MB JSON parser. Prefer a route-specific 16 KB ingress parser before release. Verify a rollback commit is known.

## Distribution and product decisions

Compare Bazaar 30-day unique payers and calls per payer with caveats: both can include operator or verifier traffic. Rank candidate categories by repeat-use evidence, API upstream reliability, distinctiveness, and ongoing zero-cost feasibility. Improve OpenAPI request/response examples, provenance and freshness metadata before adding generic endpoints. Do not scrape private content, mass-message, buy traffic, or incur paid upstream costs.
