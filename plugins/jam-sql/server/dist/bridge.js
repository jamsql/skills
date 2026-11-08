"use strict";
/**
 * stdio side of the bridge: newline-delimited JSON-RPC on stdin, answers on
 * stdout, human messages on stderr. Every request gets an answer — when the
 * app cannot be reached the answer is a JSON-RPC error carrying the same
 * actionable message that goes to stderr.
 *
 * Messages that arrive while the client's `initialize` is in flight wait for
 * it, so they travel on the session it creates.
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
exports.runBridge = void 0;
const readline = __importStar(require("node:readline"));
const jsonrpc_1 = require("./jsonrpc");
const logger_1 = require("./logger");
const messages_1 = require("./messages");
const session_1 = require("./session");
const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;
const invalidRequest = { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request: expected a JSON-RPC message.' } };
const runBridge = (options) => {
    const log = (0, logger_1.createLogger)(options.errorOutput, options.env.JAMSQL_MCP_DEBUG === '1');
    const session = (0, session_1.createAppSession)({
        env: options.env,
        homeDir: options.homeDir,
        log,
        pidAlive: options.pidAlive,
        retryDelaysMs: options.retryDelaysMs,
    });
    const inflight = new Set();
    let initializing = Promise.resolve();
    let lastFailure = '';
    let connected = false;
    const write = (message) => {
        options.output.write(`${JSON.stringify(message)}\n`);
    };
    const reportFailure = (failure) => {
        if (failure.message === lastFailure)
            return;
        lastFailure = failure.message;
        connected = false;
        log.info(failure.message);
    };
    const handle = async (payload) => {
        const result = await session.send(payload, write);
        if (!result.ok) {
            reportFailure(result.failure);
            for (const id of result.unansweredIds)
                write((0, jsonrpc_1.errorResponse)(id, result.failure));
            return;
        }
        lastFailure = '';
        if (!connected && (0, jsonrpc_1.isInitialize)(payload)) {
            connected = true;
            log.info(`Connected to ${session.describeTarget()}.`);
        }
    };
    const track = (work) => {
        const settled = work.catch((error) => {
            log.info(`Unexpected bridge error: ${error instanceof Error ? error.message : String(error)}`);
        });
        inflight.add(settled);
        void settled.finally(() => inflight.delete(settled));
    };
    const onLine = (line) => {
        if (line.trim() === '')
            return;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            log.info('Ignored a stdin line that is not JSON.');
            write((0, jsonrpc_1.parseErrorResponse)());
            return;
        }
        if (!(0, jsonrpc_1.isJsonRpcPayload)(parsed)) {
            write(invalidRequest);
            return;
        }
        const payload = parsed;
        if ((0, jsonrpc_1.isInitialize)(payload)) {
            const run = handle(payload);
            initializing = run.catch(() => undefined);
            track(run);
            return;
        }
        const waitFor = initializing;
        track(waitFor.then(() => handle(payload)));
    };
    log.info(`${messages_1.BRIDGE_VERSION} — bridging stdio to Jam SQL Studio's local MCP server. Docs: ${messages_1.DOCS_URL}`);
    const lines = readline.createInterface({ input: options.input, crlfDelay: Infinity, terminal: false });
    lines.on('line', onLine);
    const finished = new Promise((done) => {
        lines.once('close', () => {
            const drained = Promise.allSettled([...inflight]);
            const timeout = new Promise((elapsed) => setTimeout(elapsed, options.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS).unref());
            void Promise.race([drained, timeout])
                .then(() => session.close())
                .then(() => done());
        });
    });
    return { finished, close: () => session.close() };
};
exports.runBridge = runBridge;
