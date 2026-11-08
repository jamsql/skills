#!/usr/bin/env node
"use strict";
/**
 * `jamsql-mcp` — lets stdio-only MCP clients (Claude Desktop, or any client
 * started with `npx -y @jamsql/mcp`) use Jam SQL Studio's local MCP server.
 * Zero configuration: the endpoint and token come from `~/.jamsql`, exactly
 * as the `jam-sql` CLI finds them. Runs on Node 18+.
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
const os = __importStar(require("node:os"));
const bridge_1 = require("./bridge");
const messages_1 = require("./messages");
const USAGE = `jamsql-mcp ${messages_1.BRIDGE_VERSION}
Connects a stdio MCP client to Jam SQL Studio's local MCP server.

Usage: npx -y @jamsql/mcp

Run it from your MCP client's configuration; it speaks JSON-RPC on stdin/stdout.
It finds the running app through ~/.jamsql/mcp-discovery.json and the token
saved by \`jam-sql pair\` in ~/.jamsql/credentials.

Environment (optional):
  JAMSQL_MCP_URL     MCP endpoint, e.g. http://127.0.0.1:14507/mcp
  JAMSQL_MCP_TOKEN   Bearer token from Settings → AI Integrations
  JAMSQL_MCP_DEBUG   1 = log each forwarded method to stderr

Docs: ${messages_1.DOCS_URL}
`;
const main = () => {
    const args = process.argv.slice(2);
    if (args.includes('--version') || args.includes('-v')) {
        process.stdout.write(`${messages_1.BRIDGE_VERSION}\n`);
        return;
    }
    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(USAGE);
        return;
    }
    if (args.length > 0) {
        process.stderr.write(`jamsql-mcp: unknown argument ${args[0]}\n\n${USAGE}`);
        process.exitCode = 2;
        return;
    }
    // A client that goes away leaves stdout broken; there is nobody left to answer.
    process.stdout.on('error', () => process.exit(0));
    const bridge = (0, bridge_1.runBridge)({
        env: process.env,
        homeDir: os.homedir(),
        input: process.stdin,
        output: process.stdout,
        errorOutput: process.stderr,
    });
    const shutdown = () => {
        void bridge.close().finally(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    void bridge.finished.then(() => process.exit(0));
};
main();
