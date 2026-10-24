# Agent buyer workflows — Base intelligence (draft)

These are integration patterns for buyers, not evidence of organic demand or a guarantee of transaction finality. All paid calls use x402 Base Mainnet USDC. Agents must decide whether to authorize each charge; this document does not trigger or simulate payments.

## 1. Confirm a Base transaction after submission

- Call `GET /api/base-tx-status?hash=0x...` only when a transaction hash exists.
- Price advertised by the service: **$0.005 per successful paid call**.
- Record the returned transaction status, block number, confirmation count, gas/receipt fields, and the observation timestamp in the buyer's own workflow.
- For a still-pending transaction, poll at a bounded interval **only while needed**, with an explicit spending budget and a maximum number of retries. Do not pay to poll a final transaction indefinitely.
- Treat missing RPC data, timeouts, reorg risk, and a pending receipt as unknown rather than successful settlement.

## 2. Check a Base wallet before a planned action

- Call `GET /api/base-wallet-balance?address=0x...` with a validated EVM address.
- Advertised price: **$0.003 per successful paid call**.
- Inspect native ETH (gas) and USDC balances and the block height at which the values were observed.
- Do not interpret a positive balance as authorization to spend. Never transmit wallet private keys or signing material to this API.

## 3. Chain a balance check with a transaction-status check

- Read the wallet balance, then verify a known transaction hash, and read the balance again only when an observed state change requires it.
- Keep the address, transaction hash, chain ID (`eip155:8453`), timestamp, and response provenance together in your own audit trail.
- Two calls cost **$0.008 USDC** at the currently advertised prices, excluding any additional retries. The workflow itself is not a bundled product.

## Safe discovery and integration

- Service catalog: `GET /`
- API schema: `GET /openapi.json`
- AgentCard: `GET /.well-known/agent-card.json`
- Health: `GET /health`
- An unpaid request to a protected route should return **HTTP 402** and payment requirements; this can be inspected without submitting a signature.
- Use the buyer's trusted x402 client for payment authorization. The seller never needs the buyer's wallet seed phrase.
- Always cap retries, total spend, request timeout, and concurrency. Cache responses only according to their freshness and sensitivity.

## Current verification limits (2026-10-20)

The public Agenstry listing shows ten individual paid resources, omitting `/api/base-wallet-balance` and `/api/base-tx-status`, even though the repository and public AgentCard advertise both. This could be indexing lag, metadata filtering, or a lack of qualifying settlement history; **the cause has not been established**. The connected production deployment still uses `main`; this document lives on a draft PR branch and is not a production change.

These examples describe potential recurring use, **not** verified repeat customers. Organic revenue requires transaction-level attribution independent of operator tests, crawlers, and verifiers.
