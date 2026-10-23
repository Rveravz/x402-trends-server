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
4. Query **Coinbase's authenticated merchant discovery API** (read-only): `GET /platform/v2/x402/discovery/merchant` using the service's existing public `payTo` address, with `limit`/`offset` pagination. Official reference: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/get-merchant-resources-by-payto-address. This API requires authorized access; if no existing permitted read-only access is available, record **not checked**, rather than claiming the Bazaar lacks the resources. Do not create accounts, rotate credentials, or expose bearer tokens.
5. Compare the merchant API's exact `resource` URLs and HTTP methods against both Base paths; record `lastUpdated`, `quality.l30DaysTotalCalls`, `quality.l30DaysUniquePayers`, `quality.lastCalledAt`, and `accepts` (price/network/asset). A zero or missing quality field is not evidence of zero organic buyers. Record retrieval time and whether pagination was exhaustive.
6. Cross-check Coinbase's authenticated search API (`/platform/v2/x402/discovery/search`) only if already authorized; search relevance ranking is distinct from merchant listing presence. Compare third-party directories separately: their missing entries do not prove missing Coinbase Bazaar entries.
7. Directory lag, missing settlement history, indexing filters, and metadata mismatch are hypotheses until supported by live response evidence. An HTTP 402 challenge establishes payability metadata, **not** a successful purchase or marketplace indexing.
8. If live challenges differ from source declarations, prepare a minimal **draft-only** patch. Run unpaid 402 regression checks on all 12 endpoints before any production merge.
9. Record UTC timestamps, status codes, resource counts, and limitations without storing tokens or signatures. Never generate paid self-traffic to induce indexing.

## Safe limits
No Render billing/plan changes, no secret reads or edits, no paid calls, no resource creation, no mass outreach, and no merge to `main` without regression evidence.
