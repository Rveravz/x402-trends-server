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

## Directory freshness and conflicting counters (2026-10-24 audit)
- Always record the directory's **data-as-of** timestamp separately from the time the page was fetched. A page crawled today can display stale payment statistics.
- On 2026-10-24, x402.new still displayed **8 calls / 4 payer wallets** for the Crypto Market resource with **Sep 9** as its last-called date, and **6 calls / 3 payer wallets** for Weather with **Aug 31** as its last-called date. Do not present these counters as new purchases in the last hour or independently confirmed rolling-30-day demand. They are stale or have inconsistent date labels.
- Agenstry displayed **$1.19 / 78 transfers** in a 30-day wallet-inflow panel synced **Oct 22**, while its attribution analysis used **$1.14 / 77 transfers**. brick.blue independently displayed **$1.14 / 78 settlements**. These represent different scopes, snapshots or classification rules until reconciled transaction-by-transaction; **never add them together** or silently substitute one for another.
- The Agenstry 5/5 `independently_paid` heuristic is useful third-party evidence, but it does **not** establish that an identifiable external customer paid for and received a protected API response. Maintain the strict confirmed-organic classification above.
- Compare hourly deltas from newly observed, finalized, deduplicated transfer IDs or trustworthy request/settlement joins. If sources have not advanced since the prior run, report **published snapshot unchanged; actual hourly delta unknown**, rather than claiming no new purchases occurred.

## Minimum hourly report
`REVENUE — Confirmed organic: $X verified | Observed on-chain inflow (30d): $Y | Since last check: $Z confirmed organic / $W observed (or unknown)`

Also report: new confirmed external buyers, repeat confirmed buyers, test/verifier/unattributed counts when available, source freshness, and confidence. A historical 30-day Bazaar call count must never be called an hourly paid-call count.

## Safety
Use read-only queries and unpaid HTTP 402 challenges. Never self-pay, change credentials, expose wallets' private keys, purchase third-party data, or change Render billing/resources. If transaction-level matching is unavailable, leave organic revenue **unverified**.
