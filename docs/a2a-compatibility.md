# A2A JSON-RPC readiness and regression checklist

Status (2026-10-07): **discovery metadata is published, but A2A execution is not yet verified**. The current AgentCard advertises a JSON-RPC interface at the service root. Third-party probes have returned 404 for A2A messages even though the well-known card and ordinary GET health checks are reachable.

## Safe implementation boundary

- Preserve existing `/api/*` x402 payment middleware, facilitator configuration, pay-to wallet, and HTTP 402 challenges.
- Add a dedicated free `POST /a2a` handler **before** paid middleware, with a strict JSON body size limit and no paid execution.
- Update only the AgentCard `supportedInterfaces[0].url` to point to the actual handler **after** it is implemented and tested. Do not advertise an unimplemented protocol.
- Support A2A-Version negotiation, JSON-RPC request IDs, validation/error responses, and the v1.0 `SendMessage` contract using the official A2A schema. Do not invent successful task completion or imply paid tools were run.
- If a message requests a paid data skill, respond with accurate instructions for the existing x402 endpoint and required payment flow; never invoke paid endpoints without authorization.
- Use no new paid APIs, secrets, external network calls, or infrastructure resources.

## Acceptance tests (no payments)

1. `GET /.well-known/agent-card.json` returns HTTP 200, JSON, ten declared skills, and an accurate `supportedInterfaces` entry.
2. `POST /a2a` with a well-formed A2A v1.0 heartbeat returns a valid JSON-RPC response with the same request ID and appropriate A2A-Version header.
3. Invalid JSON-RPC methods and malformed inputs return bounded, schema-valid errors (not HTTP 500), with no secret leakage.
4. `GET /health` and `GET /openapi.json` continue to respond as before.
5. Unpaid requests to protected GET routes and the crawler-compatible GET probes for POST-only routes still return the expected x402 HTTP 402 challenges.
6. Existing paid-route tests run in non-paying verification mode; **no settlement or paid self-test**.
7. Validate in an isolated branch and run syntax/tests locally before any production merge or deployment. Check live external A2A conformance only after release.

## Measurement notes

- HTTP 200 health probes prove reachability, **not** A2A conformance.
- Bazaar calls, directory impressions, and on-chain wallet transfers are **not** proof of organic customers.
- Track unique repeat payers separately from tests, crawlers, facilitator/verifier activity, and attribution-unknown transfers.
