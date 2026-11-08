"use strict";
/**
 * The bridge's side of one MCP session with the app: which endpoint and
 * token to use, the `Mcp-Session-Id` / `Mcp-Protocol-Version` headers, and
 * recovery when the app goes away underneath an open client.
 *
 * Recovery rules:
 *  - A request that never reached the app (connection refused) is retried
 *    after re-reading discovery — the app may be restarting, maybe on a new
 *    port. Its old session died with it, so the client's `initialize` is
 *    replayed first.
 *  - An answer saying the session is unknown (the app's "MCP session
 *    expired" result, or a spec 404) replays `initialize` and retries once.
 *  - A 401 re-reads the token once (the user may have re-paired).
 *  - A request that reached the app is never retried: it may have run.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppSession = void 0;
const httpTransport_1 = require("./httpTransport");
const discovery_1 = require("./discovery");
const jsonrpc_1 = require("./jsonrpc");
const messages_1 = require("./messages");
const replayInitialize_1 = require("./replayInitialize");
const DEFAULT_RETRY_DELAYS_MS = [250, 500, 1000];
const CLOSE_TIMEOUT_MS = 1000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const createAppSession = (options) => {
    const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    const { log } = options;
    let target = null;
    let everResolved = false;
    let sessionId = null;
    let protocolVersion = null;
    let initParams;
    let generation = 0;
    let sessionStale = false;
    let reconnecting = null;
    let reconnectCount = 0;
    const resolve = () => {
        if (target)
            return { ok: true, target };
        const resolution = (0, discovery_1.resolveTarget)({ env: options.env, homeDir: options.homeDir, pidAlive: options.pidAlive });
        if (resolution.ok) {
            target = resolution.target;
            everResolved = true;
            log.addSecret(target.token);
        }
        return resolution;
    };
    const failureOf = (result, endpoint) => {
        if (result.kind === 'network-error') {
            if (result.connected)
                return { ok: false, failure: (0, messages_1.connectionLost)(), retryable: false };
            // Refused: discovery may explain it (app closed, MCP switched off) better than the socket error.
            target = null;
            const again = resolve();
            return { ok: false, failure: again.ok ? (0, messages_1.unreachable)(endpoint, result.code) : again.failure, retryable: true };
        }
        if (result.kind === 'http-error' && result.status === 401)
            return { ok: false, failure: (0, messages_1.tokenRejected)(), retryable: false };
        const detail = result.kind === 'http-error' ? result.detail : 'initialize returned no result';
        return { ok: false, failure: (0, messages_1.httpError)(result.status, detail), retryable: false };
    };
    /** Replays the client's initialize on a fresh session; concurrent callers share one attempt. */
    const reconnect = () => {
        if (reconnecting)
            return reconnecting;
        reconnecting = (async () => {
            sessionId = null;
            const resolution = resolve();
            if (!resolution.ok)
                return { ok: false, failure: resolution.failure, retryable: true };
            const replay = await (0, replayInitialize_1.replayInitialize)(resolution.target, initParams, `jamsql-mcp-reconnect-${(reconnectCount += 1)}`);
            if (!replay.ok)
                return failureOf(replay.result, resolution.target.endpoint);
            sessionId = replay.sessionId;
            protocolVersion = replay.protocolVersion;
            generation += 1;
            sessionStale = false;
            log.info(`Reconnected to ${describeTarget()} (new MCP session).`);
            return { ok: true };
        })().finally(() => {
            reconnecting = null;
        });
        return reconnecting;
    };
    const send = async (payload, onMessage) => {
        const init = (0, jsonrpc_1.isInitialize)(payload);
        const ids = (0, jsonrpc_1.requestIds)(payload);
        const fail = (failure, unansweredIds = ids) => ({ ok: false, failure, unansweredIds });
        if (init) {
            initParams = payload.params;
            sessionId = null;
            protocolVersion = null;
            sessionStale = false;
            generation += 1;
        }
        let attempts = 0;
        let replayed = false;
        let tokenReread = false;
        const retryLater = async () => {
            if (attempts >= delays.length)
                return false;
            await sleep(delays[attempts]);
            attempts += 1;
            target = null;
            return true;
        };
        for (;;) {
            const resolution = resolve();
            if (!resolution.ok) {
                // Only an app that was reachable before is worth waiting for (it is likely restarting).
                if (everResolved && (await retryLater()))
                    continue;
                return fail(resolution.failure);
            }
            if (!init && sessionStale && initParams !== undefined) {
                const reconnected = await reconnect();
                if (!reconnected.ok) {
                    if (reconnected.retryable && (await retryLater()))
                        continue;
                    return fail(reconnected.failure);
                }
            }
            const { endpoint, token } = resolution.target;
            const usedGeneration = generation;
            // A newer session than the one this request used means another request already reconnected.
            const markStale = () => {
                if (!init && initParams !== undefined && generation === usedGeneration)
                    sessionStale = true;
            };
            const answered = new Set();
            const deliver = (message) => {
                if (!(0, jsonrpc_1.isJsonRpcMessage)(message))
                    return;
                if ((0, jsonrpc_1.isResponseTo)(message, ids))
                    answered.add(message.id);
                if (init)
                    protocolVersion = (0, jsonrpc_1.protocolVersionOf)(message) ?? protocolVersion;
                onMessage(message);
            };
            log.debug(`→ ${(0, jsonrpc_1.describePayload)(payload)}`);
            const result = await (0, httpTransport_1.exchange)({
                endpoint,
                token,
                sessionId: init ? undefined : (sessionId ?? undefined),
                protocolVersion: init ? undefined : (protocolVersion ?? undefined),
                method: 'POST',
                body: JSON.stringify(payload),
                onStreamMessage: deliver,
            });
            log.debug(`← ${result.kind}${'status' in result ? ` ${result.status}` : ` ${result.code}`}`);
            if (result.kind === 'network-error') {
                if (!result.connected) {
                    markStale();
                    if (await retryLater())
                        continue;
                }
                return fail(failureOf(result, endpoint).failure);
            }
            if (result.kind === 'http-error' && result.status === 401 && !tokenReread) {
                tokenReread = true;
                target = null;
                const again = resolve();
                if (!again.ok)
                    return fail(again.failure);
                if (again.target.token !== token)
                    continue;
                return fail((0, messages_1.tokenRejected)());
            }
            const sessionUnknown = (result.kind === 'http-error' && result.status === 404) ||
                (result.kind === 'json' && (0, jsonrpc_1.isAppSessionExpiredAnswer)(result.messages));
            if (sessionUnknown && !init && !replayed && initParams !== undefined) {
                replayed = true;
                markStale();
                continue;
            }
            if (result.kind === 'http-error')
                return fail(failureOf(result, endpoint).failure);
            if (init && result.kind !== 'accepted')
                sessionId = result.sessionId;
            if (result.kind === 'json')
                result.messages.forEach(deliver);
            const unanswered = ids.filter((id) => !answered.has(id));
            return unanswered.length === 0 ? { ok: true } : fail((0, messages_1.connectionLost)(), unanswered);
        }
    };
    const close = async () => {
        if (!target || !sessionId)
            return;
        const request = (0, httpTransport_1.exchange)({
            endpoint: target.endpoint,
            token: target.token,
            sessionId,
            protocolVersion: protocolVersion ?? undefined,
            method: 'DELETE',
            connectTimeoutMs: CLOSE_TIMEOUT_MS,
        });
        sessionId = null;
        await Promise.race([request, sleep(CLOSE_TIMEOUT_MS)]);
    };
    const describeTarget = () => target ? `Jam SQL Studio${target.appVersion ? ` ${target.appVersion}` : ''} at ${target.endpoint}` : 'Jam SQL Studio';
    return { send, close, describeTarget };
};
exports.createAppSession = createAppSession;
