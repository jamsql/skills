"use strict";
/**
 * Finds the running Jam SQL Studio MCP endpoint and the bearer token — the
 * same contract the Go `jam-sql` CLI uses (cli/jam-sql/internal/config):
 *
 *  - `~/.jamsql/mcp-discovery.json`, written by the app on start
 *    (electron/mcp-pairing/discovery.ts): `pid`, `endpoint`, `port`,
 *    `mcpEnabled`, `version`. A dead `pid` means a stale file.
 *  - `~/.jamsql/credentials`, written by `jam-sql pair`: `{ "token": … }`.
 *
 * Environment overrides win over both: `JAMSQL_MCP_URL` / `JAMSQL_MCP_TOKEN`,
 * plus the CLI's own names `JAM_SQL_MCP_ENDPOINT` / `JAM_SQL_MCP_TOKEN`.
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
exports.resolveTarget = exports.discoveryEndpoint = exports.isPidAlive = exports.readCredentialsToken = exports.readDiscovery = exports.jamsqlDir = exports.TOKEN_ENV_NAMES = exports.URL_ENV_NAMES = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const messages_1 = require("./messages");
exports.URL_ENV_NAMES = ['JAMSQL_MCP_URL', 'JAM_SQL_MCP_ENDPOINT'];
exports.TOKEN_ENV_NAMES = ['JAMSQL_MCP_TOKEN', 'JAM_SQL_MCP_TOKEN'];
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const jamsqlDir = (homeDir) => path.join(homeDir, '.jamsql');
exports.jamsqlDir = jamsqlDir;
const readJson = (filePath) => {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
};
/** The app's discovery file, or null when it is missing or unreadable. */
const readDiscovery = (homeDir) => {
    const raw = readJson(path.join((0, exports.jamsqlDir)(homeDir), 'mcp-discovery.json'));
    if (!raw || typeof raw.pid !== 'number')
        return null;
    return {
        pid: raw.pid,
        port: typeof raw.port === 'number' && raw.port > 0 ? raw.port : null,
        endpoint: typeof raw.endpoint === 'string' && raw.endpoint !== '' ? raw.endpoint : null,
        mcpEnabled: raw.mcpEnabled === true,
        version: typeof raw.version === 'string' ? raw.version : null,
    };
};
exports.readDiscovery = readDiscovery;
/** The token `jam-sql pair` saved, or null. */
const readCredentialsToken = (homeDir) => {
    const raw = readJson(path.join((0, exports.jamsqlDir)(homeDir), 'credentials'));
    return raw && typeof raw.token === 'string' && raw.token.trim() !== '' ? raw.token.trim() : null;
};
exports.readCredentialsToken = readCredentialsToken;
/** Signal 0 checks existence; EPERM means the process exists but is not ours. */
const isPidAlive = (pid) => {
    if (!Number.isInteger(pid) || pid <= 0)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === 'EPERM';
    }
};
exports.isPidAlive = isPidAlive;
const firstEnv = (env, names) => {
    for (const name of names) {
        const value = env[name]?.trim();
        if (value)
            return { name, value };
    }
    return null;
};
/** Accepts a pasted "Bearer xyz" as well as the bare token. */
const normalizeToken = (value) => value.replace(/^Bearer\s+/i, '').trim();
const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
};
const isLoopbackHttpUrl = (value) => isHttpUrl(value) && new URL(value).protocol === 'http:' && LOOPBACK_HOSTS.has(new URL(value).hostname);
/** The endpoint from the discovery file, mirroring the CLI's `buildEndpoint` fallback. */
const discoveryEndpoint = (info) => info.endpoint ?? (info.port ? `http://127.0.0.1:${info.port}/mcp` : null);
exports.discoveryEndpoint = discoveryEndpoint;
/**
 * Resolves where to send MCP traffic. App state is reported before pairing:
 * pairing cannot succeed until the app runs with its MCP server on.
 */
const resolveTarget = ({ env, homeDir, pidAlive = exports.isPidAlive }) => {
    const urlOverride = firstEnv(env, exports.URL_ENV_NAMES);
    let endpoint;
    let appVersion = null;
    if (urlOverride) {
        if (!isHttpUrl(urlOverride.value)) {
            return { ok: false, failure: (0, messages_1.invalidConfig)(`${urlOverride.name} must be an http:// or https:// URL.`) };
        }
        endpoint = urlOverride.value;
    }
    else {
        const info = (0, exports.readDiscovery)(homeDir);
        if (!info || !pidAlive(info.pid))
            return { ok: false, failure: (0, messages_1.appNotRunning)() };
        const found = (0, exports.discoveryEndpoint)(info);
        if (!info.mcpEnabled || !found)
            return { ok: false, failure: (0, messages_1.mcpDisabled)() };
        if (!isLoopbackHttpUrl(found)) {
            return { ok: false, failure: (0, messages_1.invalidConfig)('~/.jamsql/mcp-discovery.json names a non-local endpoint; refusing to send the token there.') };
        }
        endpoint = found;
        appVersion = info.version;
    }
    const tokenOverride = firstEnv(env, exports.TOKEN_ENV_NAMES);
    const token = tokenOverride ? normalizeToken(tokenOverride.value) : (0, exports.readCredentialsToken)(homeDir);
    if (!token)
        return { ok: false, failure: (0, messages_1.notPaired)() };
    return { ok: true, target: { endpoint, token, source: urlOverride ? 'env' : 'discovery', appVersion } };
};
exports.resolveTarget = resolveTarget;
