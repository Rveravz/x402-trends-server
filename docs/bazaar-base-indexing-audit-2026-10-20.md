# Non-paying Bazaar indexing audit — Base endpoints (2026-10-20)

**Scope:** `GET /api/base-wallet-balance` ($0.003) and `GET /api/base-tx-status` ($0.005) on Base Mainnet. This is an investigation guide, **not** proof of live indexing or settlement.

## Verified source facts
- `server.js` declares both paths in `paidEndpoints` and `/openapi.json`, and defines `baseWalletBalanceDiscovery` and `baseTxStatusDiscovery` using the Bazaar discovery extension.
- The public Agenstry listing currently exposes 10 individual paid resources, excluding these two. The AgentCard skill list includes Base chain intelligence, but a skill declaration is not a Bazaar listing.
- The connected Render service deploys from `main`, and the current live commit is `b2b8e89`. This document is on the draft A2A branch and must not trigger production deployment.

## Read-only, no-payment validation plan
1. Inspect `GET /`, `GET /openapi.json`, and `GET /.well-known/agent-card.json`; compare the 12 expected paths and method/price declarations.
2. Issue **unpaid** requests to both Base GET paths with syntactically valid placeholder inputs. Require an x402 HTTP 402 challenge rather than a 404/500 or successful paid data. Do **not** include payment signatures or send any on-chain transaction.
3. Decode only the publicly returned payment challenge metadata; verify Base Mainnet `eip155:8453`, expected USDC amount, pay-to wallet, and discovery `inputSchema` / `outputSchema`. Never print secrets.
4. Query the public Coinbase CDP Bazaar resource catalog for exact host + path, recording retrieval time, resource ID, price, quality, l30DaysCalls, and l30DaysUniquePayers. Treat unique wallet counts as **unattributed**, not organic buyers.
5. Compare with third-party directory coverage; directory lag, missing settlement history, indexing filters, and metadata mismatch are hypotheses until proven.
6. If the live challenges differ from source declarations, prepare a minimal **draft-only** patch. Run unpaid 402 regression checks on all 12 endpoints before any production merge.
7. Record evidence, including UTC timestamps and response codes. Never generate paid self-traffic to induce indexing.

## Safe limits
No Render billing/plan changes, no secret reads or edits, no paid calls, no resource creation, no mass outreach, and no merge to `main` without regression evidence.
