# A2A JSON-RPC readiness and regression checklist

Status (2026-10-14): **draft branch only; not deployed to production**. The draft branch now registers a read-only `POST /a2a` JSON-RPC handler before x402 payment middleware, points its generated AgentCard interface URL to `/a2a`, and advertises the route in generated `llms.txt`. Production is still deployed from `main` at `b2b8e89`, where third-party monitoring reports HTTP 404 for the advertised JSON-RPC interface. A2A conformance and existing x402 HTTP 402 payment behavior have **not** been jointly verified; do not merge or deploy on the strength of discovery metadata alone.

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


## Current draft verification gate

- Run `npm test` and `npm run verify:x402` locally with no payment credentials or payment authorization. Check that the verification script only sends unpaid challenges and cannot settle payments before running it.
- Test both a valid A2A v1.0 `SendMessage` and invalid/malformed requests, including request IDs and `A2A-Version` handling; confirm all replies remain read-only and bounded.
- Review JSON body size handling: the draft now places a 16 KB route-specific Express JSON parser before `/a2a`, with the shared 1 MB parser remaining for paid APIs. However, oversized bodies are rejected by the parser before the A2A handler runs; without route-specific error middleware, the response may not be the JSON-RPC HTTP 413 required by the release gate. Validate and fix this on the draft branch before production.
- Confirm generated AgentCard, OpenAPI, `llms.txt`, `/health`, and all existing paid-route 402 challenges are unchanged except for the intended A2A discovery URL.
- Require a non-paying local integration test of the full Express app and a clean production rollback plan before merging. Direct external live checks were unavailable in the October 14 automation environment due to DNS resolution failures.

## Measurement notes

- HTTP 200 health probes prove reachability, **not** A2A conformance.
- Bazaar calls, directory impressions, and on-chain wallet transfers are **not** proof of organic customers.
- Track unique repeat payers separately from tests, crawlers, facilitator/verifier activity, and attribution-unknown transfers.
