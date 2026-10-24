// Offline-only A2A ingress regression tests. No credentials, Render calls or x402 payments.
// Run: node --test test/a2a-ingress-http.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { registerA2ARoute } from "../a2a-handler.js";

async function withLocalServer(run) {
  const app = express();
  // Mirrors the intended production parser order; static guard checks server.js itself.
  app.use("/a2a", express.json({ limit: "16kb" }));
  registerA2ARoute(app);
  app.use(express.json({ limit: "1mb" }));
  app.post("/_unpaid-parser-probe", (req, res) => res.json({ length: req.body?.text?.length ?? 0 }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}

function a2aMessage(text = "heartbeat") {
  return { jsonrpc: "2.0", id: "offline-test", method: "SendMessage", params: {
    message: { messageId: "offline-1", role: "ROLE_USER", parts: [{ text }] }
  }};
}

async function post(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "A2A-Version": "1.0" }, body: JSON.stringify(body) });
}

test("A2A responds to a small, unpaid JSON-RPC message", async () => {
  await withLocalServer(async base => {
    const res = await post(base + "/a2a", a2aMessage());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("a2a-version"), "1.0");
    const json = await res.json();
    assert.equal(json.id, "offline-test");
    assert.match(json.result.message.parts[0].text, /No paid action was performed/i);
  });
});

test("A2A rejects >16 KiB raw JSON at HTTP ingress", async () => {
  await withLocalServer(async base => {
    const res = await post(base + "/a2a", a2aMessage("x".repeat(17_000)));
    assert.equal(res.status, 413);
    assert.equal(res.headers.get("a2a-version"), "1.0");
    const json = await res.json();
    assert.equal(json.jsonrpc, "2.0");
    assert.equal(json.error.code, -32600);
    assert.equal(json.error.message, "Request too large");
  });
});

test("non-A2A JSON retains 1 MB parser limit", async () => {
  await withLocalServer(async base => {
    const res = await post(base + "/_unpaid-parser-probe", { text: "x".repeat(17_000) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).length, 17_000);
  });
});

test("malformed A2A JSON fails without reaching any paid route", async () => {
  await withLocalServer(async base => {
    const res = await fetch(base + "/a2a", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad-json" });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get("a2a-version"), "1.0");
    const json = await res.json();
    assert.equal(json.jsonrpc, "2.0");
    assert.equal(json.error.code, -32700);
  });
});

test("A2A HTTP rejects unsupported methods and versions without invoking payment", async () => {
  await withLocalServer(async base => {
    const unsupported = await post(base + "/a2a", { ...a2aMessage(), id: 19, method: "message/send" });
    assert.equal(unsupported.status, 200);
    assert.equal(unsupported.headers.get("cache-control"), "no-store");
    assert.equal(unsupported.headers.get("payment-required"), null);
    const unknownMethod = await unsupported.json();
    assert.equal(unknownMethod.id, 19);
    assert.equal(unknownMethod.error.code, -32601);

    const oldVersion = await fetch(base + "/a2a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "A2A-Version": "0.3" },
      body: JSON.stringify(a2aMessage()),
    });
    assert.equal(oldVersion.status, 200);
    assert.equal(oldVersion.headers.get("a2a-version"), "1.0");
    assert.equal(oldVersion.headers.get("payment-required"), null);
    const unsupportedVersion = await oldVersion.json();
    assert.equal(unsupportedVersion.id, "offline-test");
    assert.equal(unsupportedVersion.error.code, -32600);
  });
});
