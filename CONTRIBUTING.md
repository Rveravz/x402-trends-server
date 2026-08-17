# Contributing to x402 Agent Data API

Thanks for your interest in improving the project.

This API is focused on small, structured, agent-friendly services that can be purchased per request with x402 on Base Mainnet.

## What makes a good endpoint

A strong endpoint should have most of these traits:

- useful to autonomous agents or developer workflows
- current or difficult-to-maintain data
- structured JSON output
- clear input and output schemas
- low upstream operating cost
- reliable public or licensed data source
- a practical reason to pay per call instead of maintaining another subscription/API key
- competitive pricing relative to similar x402 services

## Request an endpoint

Open a GitHub issue using the **Endpoint request** template. Include:

- what the endpoint should do
- who would use it
- example inputs
- example outputs
- why an agent would pay for it
- any upstream data source you know about
- what price you think would be reasonable

## Bug reports

Please include the endpoint, request parameters/body, HTTP status, and a sanitized response or error. Never include private keys, API keys, seed phrases, or other credentials.

## Pull requests

Keep changes focused and avoid committing secrets. If an endpoint introduces a paid upstream dependency, explain the expected per-call cost and rate limits.

## Security

Do not post credentials in issues, pull requests, logs, screenshots, or example files. If you believe you found a security-sensitive issue, do not publish exploitable details in a public issue.
