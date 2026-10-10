// Non-paying A2A compatibility checks. Run: node --test test/a2a-handler.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { handleA2ARequest, registerA2ARoute } from "../a2a-handler.js";

const request = (overrides = {}) => ({
  jsonrpc: "2.0",
  id: "probe-1",
  method: "SendMessage",
  params: {
    message: {
      messageId: "message-1",
      role: "ROLE_USER",
      parts: [{ text: "heartbeat" }],
    },
  },
  ...overrides,
});

test("SendMessage responds with JSON-RPC 2.0 and preserves request ID", () => {
  const reply = handleA2ARequest(request());
  assert.equal(reply.jsonrpc, "2.0");
  assert.equal(reply.id, "probe-1");
  assert.equal(reply.result.message.role, "ROLE_AGENT");
  assert.ok(reply.result.message.messageId);
  assert.ok(reply.result.message.contextId);
});

test("numeric request IDs are preserved", () => {
  assert.equal(handleA2ARequest(request({ id: 7 })).id, 7);
});

test("caller context ID is preserved", () => {
  const req = request();
  req.params.message.contextId = "context-123";
  assert.equal(handleA2ARequest(req).result.message.contextId, "context-123");
});

test("response only describes payment flow, never claims paid execution", () => {
  const text = handleA2ARequest(request()).result.message.parts[0].text;
  assert.match(text, /no paid action was performed/i);
  assert.match(text, /x402/i);
});

test("invalid JSON-RPC envelopes are rejected", () => {
  assert.equal(handleA2ARequest(null).error.code, -32600);
  assert.equal(handleA2ARequest([]).error.code, -32600);
  assert.equal(handleA2ARequest(request({ jsonrpc: "1.0" })).error.code, -32600);
  const noId = request();
  delete noId.id;
  assert.equal(handleA2ARequest(noId).error.code, -32600);
});

test("unsupported A2A version is rejected", () => {
  assert.equal(handleA2ARequest(request(), "0.3").error.code, -32600);
});

test("unknown JSON-RPC method is rejected", () => {
  assert.equal(handleA2ARequest(request({ method: "message/send" })).error.code, -32601);
});

test("missing SendMessage parameters are rejected", () => {
  assert.equal(handleA2ARequest(request({ params: {} })).error.code, -32602);
});

test("invalid role and empty parts are rejected", () => {
  const req = request();
  req.params.message.role = "ROLE_AGENT";
  assert.equal(handleA2ARequest(req).error.code, -32602);
  req.params.message.role = "ROLE_USER";
  req.params.message.parts = [];
  assert.equal(handleA2ARequest(req).error.code, -32602);
});

test("too many parts and invalid part types are rejected", () => {
  const req = request();
  req.params.message.parts = Array.from({ length: 17 }, () => ({ text: "x" }));
  assert.equal(handleA2ARequest(req).error.code, -32602);
  req.params.message.parts = [null];
  assert.equal(handleA2ARequest(req).error.code, -32602);
});

function mockRoute() {
  let path;
  let handler;
  registerA2ARoute({
    post(route, fn) { path = route; handler = fn; },
  });
  function invoke(body, version) {
    const headers = {};
    const res = {
      statusCode: 200,
      set(name, value) { headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    handler({
      body,
      get(name) { return name === "A2A-Version" ? version : undefined; },
    }, res);
    return { res, headers };
  }
  return { path, invoke };
}

test("route is isolated at POST /a2a with non-cacheable response", () => {
  const route = mockRoute();
  assert.equal(route.path, "/a2a");
  const { res, headers } = route.invoke(request(), "1.0");
  assert.equal(res.statusCode, 200);
  assert.equal(headers["A2A-Version"], "1.0");
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(res.body.id, "probe-1");
});

test("oversized JSON body is rejected without paid calls", () => {
  const { res } = mockRoute().invoke({ payload: "x".repeat(17_000) });
  assert.equal(res.statusCode, 413);
  assert.equal(res.body.error.code, -32600);
});
