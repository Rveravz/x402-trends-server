# x402 revenue attribution: read-only operator procedure

This procedure is designed for hourly reporting. It does not send x402 payments, require new paid services, or change production.

## Evidence tiers

1. **Application settlement event:** the service logged a successful x402 settlement with a transaction hash, payer, receiving wallet, chain, and amount. Treat as *logged*, not independently chain-confirmed.
2. **On-chain transfer:** independently verify transaction receipt success and the Base Mainnet USDC Transfer log to the configured seller address. Record the exact amount and transaction hash. Treat as *observed inflow*, not automatically organic revenue.
3. **Organic purchase:** additionally establish the payer is independent of the operator, is not a known self-test, verifier, crawler, or paid sweep, and that the transaction corresponds to a genuine external paid API request. Without this evidence, classification is **unattributed**.
4. **Repeat organic purchase:** at least two independently attributed organic purchases from the same independently identified payer, with distinct transaction hashes. Repeat wallet alone is insufficient.

## Hourly reconciliation

- Use America/Los_Angeles for the human report and UTC for log queries; include exact window boundaries.
- Parse only `X402 PAYMENT SETTLED` events and their transaction/amount/chain/payer context. USDC has six decimals: `10000` base units = `0.01` USDC. Never treat a generic 402 challenge, crawler, or Bazaar `processing` status as payment.
- Deduplicate by `(chainId, transactionHash, receivingWallet, token)`, not log line count. The same transaction may appear in both Render logs and the on-chain ledger.
- Check the Base receipt and USDC Transfer event for each unique transaction before labeling it chain-confirmed. Exclude failed/reverted receipts and non-USDC transfers.
- Compute the change from the previous hourly **observed set** of unique transaction hashes. If the previous set is unavailable, label the change *not comparable* rather than estimating.
- A public 30-day inflow snapshot and new Render settlement logs may overlap. Report them separately until hash-level deduplication proves a combined total.
- Preserve a compact evidence record with `firstSeenAt`, `transactionHash`, `chainId`, `token`, `seller`, `amountBaseUnits`, `onChainVerified`, `attribution` (organic / test / verifier / crawler / unattributed), and `attributionReason`.
- Redact payer wallet addresses from public status reports unless specifically needed; never log credentials, payment headers, API keys, or secrets.

## Required report line

**REVENUE — Confirmed organic:** independently verified amount or `$0 independently verified (actual unknown)`; **Observed inflow:** independently verified 30-day on-chain total (with snapshot timestamp) and separately any new unreconciled logged settlements; **Hourly change:** verified delta, logged-only delta, or `unknown` if not comparable.

No organic amount may be inferred from Bazaar call counts, wallet independence scores, or repeated payments alone.

## Release and cost boundaries

Do not create paid self-transactions to validate discovery. Use read-only queries and unpaid HTTP 402 checks. Do not change Render plans, billing, secrets, production payment middleware, or deploy a draft A2A branch without explicit release-gate validation.
