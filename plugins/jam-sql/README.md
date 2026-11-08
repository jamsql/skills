# Jam SQL Studio plugin for Claude Code

Lets Claude Code list your saved database connections, read their schema, run queries, compare schemas and open
tabs in [Jam SQL Studio](https://jamsql.com/), a desktop SQL IDE for SQL Server, PostgreSQL, MySQL and MariaDB,
Oracle, SQLite and Azure Data Explorer. Claude works through the `jam-sql` command-line tool that ships with the app,
and never receives connection credentials: the app keeps them and runs every query itself. Each connection has a
permission level you set in the app (Block, Read-only or Confirm). At Confirm, every write waits for your approval in
Jam SQL Studio's own window, which shows the whole SQL and, for most `UPDATE` and `DELETE` statements, how many rows
they affect.

## What it contains

- **One skill** (`skills/jam-sql`): the `jam-sql` commands and when to use them. It is the same skill that
  `npx skills add jamsql/skills --skill jam-sql` and the app's `jam-sql add-skill` install.
- No MCP server, scripts or programs. The `jam-sql` command it uses is installed by the app.

## Requirements

- [Jam SQL Studio](https://jamsql.com/download/) running on the same computer, with
  **Settings → AI Integrations → Enable MCP server** on (the `jam-sql` CLI talks to the app through it).
- The `jam-sql` CLI on your PATH, which the app installs. On first use Claude runs `jam-sql pair`, and you approve the
  dialog in Jam SQL Studio.

## Install in Claude Code

```
/plugin marketplace add jamsql/skills
/plugin install jam-sql@jamsql
```

## What it reads, sends and runs

- Claude runs `jam-sql` commands in your terminal. The CLI reads `~/.jamsql/mcp-discovery.json` (the app's port) and
  `~/.jamsql/credentials` (the pairing token), and connects only to the Jam SQL Studio app on this computer.
- The plugin itself holds only Markdown, JSON, a license and its icon. It sends nothing anywhere.
- Queries run inside Jam SQL Studio under the permission level you set. The app's own anonymous usage statistics are
  described in its [privacy policy](https://jamsql.com/legal/privacy-policy/).

## MCP clients

For Claude Desktop, Cursor, VS Code and other MCP clients, use the app's MCP server through
[`@jamsql/mcp`](https://github.com/jamsql/mcp).

## Links

- Documentation: <https://jamsql.com/docs/ai-integrations-mcp/>
- Support: [support@jamsql.com](mailto:support@jamsql.com)
- License: MIT (this plugin). Jam SQL Studio itself is free for personal, non-commercial use; commercial use needs
  [Pro](https://jamsql.com/pricing/).
