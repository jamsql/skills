"use strict";
/**
 * The little JSON-RPC 2.0 the bridge needs to understand: which incoming
 * messages are requests (they get an answer, also when the app cannot be
 * reached), and how to build an error answer. Everything else passes through
 * untouched.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.describePayload = exports.protocolVersionOf = exports.isAppSessionExpiredAnswer = exports.parseErrorResponse = exports.errorResponse = exports.isJsonRpcMessage = exports.isResponseTo = exports.requestIds = exports.asList = exports.isInitialize = exports.isRequest = exports.isJsonRpcPayload = void 0;
const messages_1 = require("./messages");
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isJsonRpcPayload = (value) => isObject(value) || (Array.isArray(value) && value.length > 0 && value.every(isObject));
exports.isJsonRpcPayload = isJsonRpcPayload;
const isId = (value) => typeof value === 'string' || typeof value === 'number';
/** A request carries a method and an id; notifications and responses get no answer. */
const isRequest = (message) => typeof message.method === 'string' && isId(message.id);
exports.isRequest = isRequest;
const isInitialize = (payload) => !Array.isArray(payload) && payload.method === 'initialize' && (0, exports.isRequest)(payload);
exports.isInitialize = isInitialize;
const asList = (payload) => (Array.isArray(payload) ? payload : [payload]);
exports.asList = asList;
/** Ids of the requests in a payload — the answers the client is waiting for. */
const requestIds = (payload) => (0, exports.asList)(payload)
    .filter(exports.isRequest)
    .map((message) => message.id);
exports.requestIds = requestIds;
/** A response (result or error) for one of `ids`. */
const isResponseTo = (message, ids) => isObject(message) && typeof message.method !== 'string' && isId(message.id) && ids.includes(message.id);
exports.isResponseTo = isResponseTo;
const isJsonRpcMessage = (value) => isObject(value) && (typeof value.method === 'string' || 'result' in value || 'error' in value);
exports.isJsonRpcMessage = isJsonRpcMessage;
const errorResponse = (id, failure) => ({
    jsonrpc: '2.0',
    id,
    error: {
        code: (0, messages_1.errorCodeFor)(failure.reason),
        message: failure.message,
        data: { reason: failure.reason, docs: messages_1.DOCS_URL },
    },
});
exports.errorResponse = errorResponse;
const parseErrorResponse = () => ({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error: each stdin line must be one JSON-RPC message.' },
});
exports.parseErrorResponse = parseErrorResponse;
/**
 * The app's answer to a non-initialize request on a session it no longer
 * knows (it restarted, or its MCP server was switched off and on): a 200
 * JSON "result" with `isError` and this text — electron/mcpServer.ts. The
 * bridge re-initializes on it instead of passing it to the client.
 */
const isAppSessionExpiredAnswer = (messages) => {
    if (messages.length !== 1 || !isObject(messages[0]))
        return false;
    const result = messages[0].result;
    if (!isObject(result) || result.isError !== true || !Array.isArray(result.content))
        return false;
    const first = result.content[0];
    return isObject(first) && typeof first.text === 'string' && first.text.startsWith('MCP session expired');
};
exports.isAppSessionExpiredAnswer = isAppSessionExpiredAnswer;
/** The negotiated protocol version from an initialize result, if this is one. */
const protocolVersionOf = (message) => {
    if (!isObject(message) || !isObject(message.result))
        return null;
    const version = message.result.protocolVersion;
    return typeof version === 'string' && version !== '' ? version : null;
};
exports.protocolVersionOf = protocolVersionOf;
/** Method names only (no params: they can hold SQL) — for JAMSQL_MCP_DEBUG logging. */
const describePayload = (payload) => (0, exports.asList)(payload)
    .map((message) => (typeof message.method === 'string' ? message.method : 'response'))
    .join(', ');
exports.describePayload = describePayload;
