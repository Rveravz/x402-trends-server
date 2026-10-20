# Organic x402 revenue attribution (operator runbook)

This runbook prevents on-chain wallet inflow and Bazaar counters from being misreported as organic customer sales. It performs no payments or wallet operations.

## Data sources (read-only)
- Production request logs: timestamp (UTC), route, method, status, latency, request ID if already logged. Do not log authorization headers, payment signatures, raw payment payloads, or user IP addresses for attribution.
- Coinbase Bazaar: per-resource 30-day settled-call count, unique payer count, lastCalledAt and listed price. These are discovery counters, not proof of organic customers.
- Base USDC Transfer logs: chain ID, transaction hash, log index, block timestamp, sender, recipient and raw amount. Include only finalized transfers into the actual settlement wallet. Use token decimals and chain ID to avoid cross-chain mistakes.
- Facilitator settlement records, when available: correlate payment transaction hash to protected route and request ID without exposing credentials.
- Known operator-controlled test wallets and documented verifier addresses, held privately (never publish them to this repository).

## Classification
1. **Confirmed organic**: finalized, successful x402 settlement for a protected route, matched to a production request, from an independently established external buyer and not a known self-test, verifier or crawler. Do not infer external independence solely from distinct addresses.
2. **Known test / verifier**: documented operator test, payment facilitator verification, grading or crawler transaction. Exclude from organic totals.
3. **Unattributed**: transfer into the wallet without trustworthy request/settlement correlation or buyer independence evidence. Include in observed inflow, never in confirmed organic revenue.
4. **Other inflow**: refunds, transfers unrelated to the service, and non-x402 deposits. Report separately from paid-call revenue.

## Dedupe and reconciliation
- Deduplicate transfers by (chainId, transactionHash, logIndex); do not count one payment twice when seen in both a facilitator report and a blockchain explorer.
- Attribute revenue only once to a specific route and buyer; maintain separate counts for distinct payer wallets and **verified** independent customers.
- A wallet used by multiple services requires route-level reconciliation; never credit all wallet inflow to this service.
- Track refunds and reversals separately, not as new purchases.
- A trailing 30-day total can remain unchanged while new sales and old sales age out. For hourly delta use new finalized transactions between check timestamps, not subtraction of trailing totals alone.
- If no fresh source is available, report `unknown`, not zero. Never treat lack of logs as proof of zero traffic.

## Minimum hourly report
`REVENUE — Confirmed organic: $X verified | Observed on-chain inflow (30d): $Y | Since last check: $Z confirmed organic / $W observed (or unknown)`

Also report: new confirmed external buyers, repeat confirmed buyers, test/verifier/unattributed counts when available, source freshness, and confidence. A historical 30-day Bazaar call count must never be called an hourly paid-call count.

## Safety
Use read-only queries and unpaid HTTP 402 challenges. Never self-pay, change credentials, expose wallets' private keys, purchase third-party data, or change Render billing/resources. If transaction-level matching is unavailable, leave organic revenue **unverified**.
