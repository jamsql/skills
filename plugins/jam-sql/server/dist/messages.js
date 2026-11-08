"use strict";
/**
 * Everything the bridge tells a person: the failure reasons, their stderr /
 * JSON-RPC wording and error codes. Each message links the setup docs. None
 * of them ever contains the bearer token.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpError = exports.connectionLost = exports.unreachable = exports.invalidConfig = exports.tokenRejected = exports.notPaired = exports.mcpDisabled = exports.appNotRunning = exports.errorCodeFor = exports.DOCS_URL = exports.BRIDGE_VERSION = void 0;
exports.BRIDGE_VERSION = '1.0.1';
exports.DOCS_URL = 'https://jamsql.com/docs/ai-integrations-mcp/#stdio-bridge';
/** JSON-RPC implementation-defined server errors (-32000..-32099), one per reason. */
const ERROR_CODES = {
    'app-not-running': -32001,
    'mcp-disabled': -32002,
    'not-paired': -32003,
    'token-rejected': -32004,
    'invalid-config': -32005,
    unreachable: -32006,
    'connection-lost': -32007,
    'http-error': -32008,
};
const errorCodeFor = (reason) => ERROR_CODES[reason];
exports.errorCodeFor = errorCodeFor;
const withDocs = (text) => `${text} Setup and troubleshooting: ${exports.DOCS_URL}`;
const appNotRunning = () => ({
    reason: 'app-not-running',
    message: withDocs('Jam SQL Studio is not running. Start the app and keep it open while your AI tool uses it.'),
});
exports.appNotRunning = appNotRunning;
const mcpDisabled = () => ({
    reason: 'mcp-disabled',
    message: withDocs('Jam SQL Studio is running, but its MCP server is turned off. Turn it on in Settings → AI Integrations → Enable MCP server.'),
});
exports.mcpDisabled = mcpDisabled;
const notPaired = () => ({
    reason: 'not-paired',
    message: withDocs('Not paired with Jam SQL Studio: no token in ~/.jamsql/credentials. Run `jam-sql pair` in a terminal, or set JAMSQL_MCP_TOKEN to the token from Settings → AI Integrations.'),
});
exports.notPaired = notPaired;
const tokenRejected = () => ({
    reason: 'token-rejected',
    message: withDocs('Jam SQL Studio rejected the pairing token (it may have been regenerated). Run `jam-sql pair` again, or update JAMSQL_MCP_TOKEN.'),
});
exports.tokenRejected = tokenRejected;
const invalidConfig = (detail) => ({
    reason: 'invalid-config',
    message: withDocs(detail),
});
exports.invalidConfig = invalidConfig;
const unreachable = (endpoint, code) => ({
    reason: 'unreachable',
    message: withDocs(`Could not reach Jam SQL Studio's MCP server at ${endpoint} (${code}). Check that the app is running and its MCP server is enabled.`),
});
exports.unreachable = unreachable;
const connectionLost = () => ({
    reason: 'connection-lost',
    message: withDocs('Jam SQL Studio closed the connection before answering (the app or its MCP server may have restarted). Try again.'),
});
exports.connectionLost = connectionLost;
const httpError = (status, detail) => ({
    reason: 'http-error',
    message: withDocs(`Jam SQL Studio answered HTTP ${status}${detail ? `: ${detail}` : ''}.`),
});
exports.httpError = httpError;
