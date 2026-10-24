# Bazaar visibility: zero-payment operator checklist

Updated: 2026-10-20. This is an investigation guide, not proof of paid demand.

## Current evidence
- Production catalog advertises 12 paid endpoints.
- Public Agenstry facilitator listing exposes 10 endpoint URLs, omitting `/api/base-wallet-balance` and `/api/base-tx-status`.
- Coinbase Bazaar metrics are **not** a ledger of verified external customers. Separate settled calls, unique payer wallets, tests, and organic purchases.
- Do not perform self-payments or change paid Render resources to influence ranking.

## Safe diagnostics
1. Inspect `GET /health`, `GET /`, `GET /openapi.json`, and `GET /.well-known/agent-card.json` without payment.
2. Request the two Base endpoints without payment headers and require an HTTP 402 response with a valid x402 challenge; never follow through with payment.
3. Read the Coinbase CDP merchant discovery listing by the configured `payTo` address; paginate and compare canonical URLs, methods, network, USDC amount, and quality fields. A merchant API authentication error is *not* evidence of absence.
4. Verify the Bazaar extension metadata and sample input/output schemas match the actual HTTP method.
5. Check the facilitator settlement logs (redacting payer data and all credentials) to determine whether any legitimate, independently initiated settlement submitted the Bazaar extension. A route may be absent if it has never been legitimately settled.
6. Compare trailing 30-day calls and distinct wallets, but count organic purchases only when supported by independent transaction and customer attribution.
7. Review `scripts/audit-public-x402-discovery.mjs` for a read-only live surface check.

## Release gate
The A2A branch must pass `node scripts/check-a2a-ingress-order.mjs` and the offline HTTP tests, and the production payment-gated routes must still return unpaid 402 before any deployment. Never merge or deploy an untested A2A parser change.

Official documentation: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/get-merchant-resources-by-payto-address
