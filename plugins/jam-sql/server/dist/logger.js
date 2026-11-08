"use strict";
/**
 * stderr logging for the bridge. stdout carries only JSON-RPC, so every human
 * line goes here, prefixed `jamsql-mcp:`. Any registered secret (the bearer
 * token) is replaced before a line is written, so a message that somehow
 * picked up the token still cannot print it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = exports.REDACTED = void 0;
exports.REDACTED = '[redacted]';
const createLogger = (output, debugEnabled) => {
    const secrets = new Set();
    const redact = (message) => {
        let safe = message;
        for (const secret of secrets)
            safe = safe.split(secret).join(exports.REDACTED);
        return safe;
    };
    const write = (message) => {
        output.write(`jamsql-mcp: ${redact(message)}\n`);
    };
    return {
        info: write,
        debug: (message) => {
            if (debugEnabled)
                write(message);
        },
        addSecret: (secret) => {
            if (secret.length >= 4)
                secrets.add(secret);
        },
    };
};
exports.createLogger = createLogger;
