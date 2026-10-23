// Validate Base Mainnet JSON-RPC envelopes before paid endpoints interpret results.
// A missing result is a provider failure, not a legitimate null transaction.
export function unwrapBaseRpcResult(payload, expectedId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      payload.jsonrpc !== '2.0' || payload.id !== expectedId) {
    throw new Error('Invalid Base RPC response envelope');
  }
  if (payload.error != null) {
    const code = payload.error?.code;
    const message = typeof payload.error?.message === 'string' && payload.error.message
      ? payload.error.message : `Base RPC error ${code ?? 'unknown'}`;
    const error = new Error(message);
    error.rpcCode = code;
    // Public RPCs may report rate limiting inside an HTTP 200 JSON-RPC error.
    // The existing paid route handlers recognize HTTP 429 as a retryable 503.
    if (code === -32005) {
      error.response = { status: 429, data: { error: message } };
    }
    throw error;
  }
  if (!Object.hasOwn(payload, 'result')) {
    throw new Error('Base RPC response missing result');
  }
  return payload.result;
}
