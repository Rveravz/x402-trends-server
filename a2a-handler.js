// Read-only A2A v1.0 JSON-RPC bridge. Never executes paid x402 tools.
import { randomUUID } from "node:crypto";

const API_BASE = "https://x402-trends-server.onrender.com";
const MAX_BODY_BYTES = 16 * 1024;
const GUIDE = "This A2A interface provides discovery and instructions only. To retrieve paid data, call the appropriate /api/* endpoint with a compatible x402 client and a valid Base Mainnet USDC payment. No paid action was performed.";

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function handleA2ARequest(body, version = "1.0") {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(null, -32600, "Invalid JSON-RPC request");
  }
  const id = typeof body.id === "string" || typeof body.id === "number" || body.id === null ? body.id : null;
  if (body.jsonrpc !== "2.0" || !Object.hasOwn(body, "id")) {
    return errorResponse(id, -32600, "Invalid JSON-RPC request");
  }
  if (version !== "1.0") {
    return errorResponse(id, -32600, "Unsupported A2A-Version; supported version: 1.0");
  }
  if (body.method !== "SendMessage") {
    return errorResponse(id, -32601, "Method not found");
  }
  const message = body.params?.message;
  if (!message || typeof message !== "object" || Array.isArray(message) ||
      typeof message.messageId !== "string" || !message.messageId.trim() ||
      message.role !== "ROLE_USER" || !Array.isArray(message.parts) ||
      message.parts.length === 0 || message.parts.length > 16 ||
      message.parts.some(part => !part || typeof part !== "object" || Array.isArray(part) ||
        !(typeof part.text === "string" || (part.data && typeof part.data === "object")))) {
    return errorResponse(id, -32602, "Invalid SendMessage params");
  }
  return {
    jsonrpc: "2.0",
    id,
    result: {
      message: {
        messageId: randomUUID(),
        contextId: typeof message.contextId === "string" && message.contextId ? message.contextId : randomUUID(),
        role: "ROLE_AGENT",
        parts: [{ text: GUIDE + " Service: " + API_BASE + "/llms.txt" }],
      },
    },
  };
}

export function registerA2ARoute(app) {
  app.post("/a2a", (req, res) => {
    res.set("A2A-Version", "1.0");
    res.set("Cache-Control", "no-store");
    if (Buffer.byteLength(JSON.stringify(req.body ?? null)) > MAX_BODY_BYTES) {
      return res.status(413).json(errorResponse(null, -32600, "Request too large"));
    }
    return res.status(200).json(handleA2ARequest(req.body, req.get("A2A-Version") || "1.0"));
  });
}
