import test from 'node:test';
import assert from 'node:assert/strict';
import { unwrapBaseRpcResult } from '../base-rpc-response.js';

test('accepts a valid hex result', () => {
  assert.equal(unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12, result: '0x42' }, 12), '0x42');
});
test('preserves legitimate null result (transaction not found)', () => {
  assert.equal(unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12, result: null }, 12), null);
});
test('rejects missing result rather than treating it as a missing transaction', () => {
  assert.throws(() => unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12 }, 12), /missing result/);
});
test('rejects wrong request id', () => {
  assert.throws(() => unwrapBaseRpcResult({ jsonrpc: '2.0', id: 13, result: null }, 12), /Invalid Base RPC response envelope/);
});
test('rejects wrong protocol and malformed payloads', () => {
  for (const payload of [null, [], {}, { id: 12, result: '0x1' }, { jsonrpc: '1.0', id: 12, result: '0x1' }]) {
    assert.throws(() => unwrapBaseRpcResult(payload, 12), /Invalid Base RPC response envelope/);
  }
});
test('propagates JSON-RPC error codes', () => {
  assert.throws(() => unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12, error: { code: -32005, message: 'rate limited' } }, 12),
    error => error.message === 'rate limited' && error.rpcCode === -32005);
});
test('handles JSON-RPC errors with missing message', () => {
  assert.throws(() => unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12, error: { code: -32603 } }, 12),
    /Base RPC error -32603/);
});
test('maps JSON-RPC rate-limit code to retryable HTTP 429 for existing route handlers', () => {
  assert.throws(() => unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12, error: { code: -32005, message: 'request limit exceeded' } }, 12),
    error => error.rpcCode === -32005 && error.response?.status === 429 && error.response.data.error === 'request limit exceeded');
});
test('does not misclassify unrelated RPC errors as HTTP 429', () => {
  assert.throws(() => unwrapBaseRpcResult({ jsonrpc: '2.0', id: 12, error: { code: -32603, message: 'internal error' } }, 12),
    error => error.rpcCode === -32603 && error.response === undefined);
});
