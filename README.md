# Jam SQL Studio skills and Claude Code plugin

[![skills.sh](https://skills.sh/b/jamsql/skills)](https://skills.sh/jamsql/skills/jam-sql)

The `jam-sql` agent skill for [Jam SQL Studio](https://jamsql.com/), a desktop SQL IDE for SQL Server, PostgreSQL,
MySQL and MariaDB, Oracle, SQLite and Azure Data Explorer on macOS, Windows and Linux. The skill teaches an AI agent
the `jam-sql` command-line tool that ships with the app: list connections, run queries, compare schemas, browse Azure
Storage, open tabs in the app. The agent never receives connection credentials, and writes never run without your
approval in Jam SQL Studio.

| | For | Install |
|---|---|---|
| [`skills/jam-sql`](skills/jam-sql/SKILL.md) | Any agent that reads skills: Claude Code, Codex, Cursor, Copilot, Gemini CLI and others | `npx skills add jamsql/skills --skill jam-sql` |
| [`plugins/jam-sql`](plugins/jam-sql/README.md) | Claude Code, as a plugin (the same skill) | `/plugin marketplace add jamsql/skills`, then `/plugin install jam-sql@jamsql` |

On first use the agent runs `jam-sql pair`, and you approve the dialog in Jam SQL Studio.

For MCP clients (Claude Desktop, Cursor, VS Code and others), use the app's MCP server through
[`@jamsql/mcp`](https://github.com/jamsql/mcp).

## Requirements

- [Jam SQL Studio](https://jamsql.com/download/) running on the same computer, with
  **Settings → AI Integrations → Enable MCP server** on.
- Each connection's AI permission level (Block, Read-only or Confirm) is set in the app. It starts at
  Block until you change it.

Documentation: <https://jamsql.com/docs/ai-integrations-mcp/> · Support:
[support@jamsql.com](mailto:support@jamsql.com) · License: MIT (this repository). Jam SQL Studio itself is free for
personal, non-commercial use; commercial use needs [Pro](https://jamsql.com/pricing/).
