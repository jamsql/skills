"use strict";
/**
 * One MCP streamable-HTTP exchange with the app: POST a JSON-RPC payload and
 * read the answer, which is a 202 (notification/response accepted), a JSON
 * body, or an SSE stream whose messages are handed over as they arrive.
 *
 * Built on node:http rather than fetch: fetch prints an ExperimentalWarning on
 * Node 18 (what Claude Desktop ships), and node:http streams SSE without a
 * dependency. Never logs or returns the Authorization header.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchange = void 0;
const http = __importStar(require("node:http"));
const https = __importStar(require("node:https"));
const sse_1 = require("./sse");
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
const MAX_ERROR_DETAIL = 300;
const parseJsonMessages = (text) => {
    if (text.trim() === '')
        return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
    }
    catch {
        return null;
    }
};
/** A short, readable reason from an error body: `{ error: "…" }`, a JSON-RPC error, or the text. */
const errorDetail = (text) => {
    const messages = parseJsonMessages(text);
    const first = messages?.[0];
    if (first && typeof first.error === 'string')
        return first.error;
    if (first && first.error && typeof first.error.message === 'string') {
        return first.error.message;
    }
    const trimmed = text.trim();
    return trimmed.length > MAX_ERROR_DETAIL ? `${trimmed.slice(0, MAX_ERROR_DETAIL)}…` : trimmed;
};
const headerValue = (value) => (Array.isArray(value) ? value[0] : value) || null;
const exchange = (request) => new Promise((resolve) => {
    let settled = false;
    let connected = false;
    const finish = (result) => {
        if (settled)
            return;
        settled = true;
        clearTimeout(connectTimer);
        resolve(result);
    };
    const url = new URL(request.endpoint);
    const headers = {
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${request.token}`,
        // Lets the app tell bridged sessions from direct ones (its `via` analytics property; 1.0.1+).
        'X-Jam-Via': 'npm-bridge',
    };
    if (request.body !== undefined)
        headers['Content-Type'] = 'application/json';
    if (request.sessionId)
        headers['Mcp-Session-Id'] = request.sessionId;
    if (request.protocolVersion)
        headers['Mcp-Protocol-Version'] = request.protocolVersion;
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: request.method, headers, agent: false }, (res) => {
        const status = res.statusCode ?? 0;
        const sessionId = headerValue(res.headers['mcp-session-id']);
        const contentType = headerValue(res.headers['content-type']) ?? '';
        res.setEncoding('utf8');
        if (status >= 200 && status < 300 && contentType.includes('text/event-stream')) {
            let streamed = 0;
            const parser = (0, sse_1.createSseParser)((event) => {
                if (event.event !== 'message' || event.data.trim() === '')
                    return;
                try {
                    const message = JSON.parse(event.data);
                    streamed += 1;
                    request.onStreamMessage?.(message);
                }
                catch {
                    // A malformed event is skipped; the missing answer is reported by the caller.
                }
            });
            res.on('data', (chunk) => parser.feed(chunk));
            res.on('end', () => {
                parser.end();
                finish({ kind: 'stream', status, sessionId, streamed });
            });
            res.on('error', () => finish({ kind: 'stream', status, sessionId, streamed }));
            res.on('close', () => finish({ kind: 'stream', status, sessionId, streamed }));
            return;
        }
        let text = '';
        res.on('data', (chunk) => {
            text += chunk;
        });
        res.on('end', () => {
            if (status < 200 || status >= 300) {
                finish({ kind: 'http-error', status, sessionId, detail: errorDetail(text) });
                return;
            }
            if (status === 202 || text.trim() === '') {
                finish({ kind: 'accepted', status, sessionId });
                return;
            }
            const messages = parseJsonMessages(text);
            if (messages === null)
                finish({ kind: 'http-error', status, sessionId, detail: 'the answer was not JSON' });
            else
                finish({ kind: 'json', status, sessionId, messages });
        });
        res.on('error', () => finish({ kind: 'network-error', code: 'ECONNRESET', connected: true }));
    });
    const connectTimer = setTimeout(() => {
        if (!connected) {
            req.destroy();
            finish({ kind: 'network-error', code: 'ETIMEDOUT', connected: false });
        }
    }, request.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
    req.on('socket', (socket) => {
        const markConnected = () => {
            connected = true;
            clearTimeout(connectTimer);
        };
        if (!socket.connecting)
            markConnected();
        else
            socket.once(url.protocol === 'https:' ? 'secureConnect' : 'connect', markConnected);
    });
    req.on('error', (error) => {
        finish({ kind: 'network-error', code: error.code ?? 'ECONNRESET', connected });
    });
    if (request.body !== undefined)
        req.write(request.body);
    req.end();
});
exports.exchange = exchange;
