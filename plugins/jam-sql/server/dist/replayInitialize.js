"use strict";
/**
 * Opens a fresh MCP session for a client that is already initialized: sends
 * the client's own `initialize` params again (under a bridge-private id the
 * client never sees), then `notifications/initialized`. Used after the app
 * restarted or switched its MCP server off and on, which drops every session.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayInitialize = void 0;
const httpTransport_1 = require("./httpTransport");
const jsonrpc_1 = require("./jsonrpc");
const replayInitialize = async (target, params, id) => {
    const { endpoint, token } = target;
    let version = null;
    const result = await (0, httpTransport_1.exchange)({
        endpoint,
        token,
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id, method: 'initialize', params }),
        onStreamMessage: (message) => {
            version = (0, jsonrpc_1.protocolVersionOf)(message) ?? version;
        },
    });
    if (result.kind === 'json')
        version = result.messages.map(jsonrpc_1.protocolVersionOf).find((v) => v !== null) ?? null;
    if ((result.kind !== 'json' && result.kind !== 'stream') || !version)
        return { ok: false, result };
    await (0, httpTransport_1.exchange)({
        endpoint,
        token,
        sessionId: result.sessionId ?? undefined,
        protocolVersion: version,
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    return { ok: true, sessionId: result.sessionId, protocolVersion: version };
};
exports.replayInitialize = replayInitialize;
