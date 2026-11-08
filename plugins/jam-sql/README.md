# Jam SQL Studio plugin for Claude

Lets Claude list your saved database connections, read their schema and run queries through
[Jam SQL Studio](https://jamsql.com/), a desktop SQL IDE for SQL Server, PostgreSQL, MySQL and MariaDB, Oracle,
SQLite and Azure Data Explorer. Claude never receives connection credentials: the app keeps them, and each
connection has a permission level you set in the app (Block, Read-only or Confirm). At Confirm, every write waits
for your approval in Jam SQL Studio's own window, which shows the whole SQL and, for most `UPDATE` and `DELETE`
statements, how many rows they affect.

## What it contains

- **An MCP server** (`server/`): the published [`@jamsql/mcp`](https://www.npmjs.com/package/@jamsql/mcp) 1.0.1
  package, unchanged. Claude Code starts it with `node`. It forwards MCP messages to the Jam SQL Studio app's local
  endpoint (`http://127.0.0.1:<port>/mcp`).
- **A skill** (`skills/sql-databases`): tells Claude how to use the tools and how permissions and approvals work.

## Requirements

- [Jam SQL Studio](https://jamsql.com/download/) running on the same computer, with
  **Settings → AI Integrations → Enable MCP server** on.
- Paired once with `jam-sql pair` (the `jam-sql` CLI ships with the app). Pairing stores a token in
  `~/.jamsql/credentials`.
- Node.js 18 or newer.

## Install in Claude Code

```
/plugin marketplace add jamsql/skills
/plugin install jam-sql@jamsql
```

If you already added Jam SQL Studio to Claude Code yourself (for example with **Copy for Claude Code CLI** in
**Settings → AI Integrations**), remove that `jam-sql` entry so the tools are not listed twice.

## What it reads, sends and runs

- Reads `~/.jamsql/mcp-discovery.json` (the app's port) and `~/.jamsql/credentials` (the pairing token), or the
  `JAMSQL_MCP_URL` and `JAMSQL_MCP_TOKEN` environment variables when set.
- Connects only to the Jam SQL Studio app on this computer. It sends nothing to any other server.
- Runs no other programs and downloads nothing.
- Queries run inside Jam SQL Studio under the permission level you set. The app's own anonymous usage statistics
  are described in its [privacy policy](https://jamsql.com/legal/privacy-policy/).

## Links

- Documentation: <https://jamsql.com/docs/ai-integrations-mcp/>
- Support: [support@jamsql.com](mailto:support@jamsql.com)
- License: MIT (this plugin). Jam SQL Studio itself is free for personal, non-commercial use; commercial use needs
  [Pro](https://jamsql.com/pricing/).
