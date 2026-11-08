# Jam SQL Studio skills and Claude plugin

AI integrations for [Jam SQL Studio](https://jamsql.com/), a desktop SQL IDE for SQL Server, PostgreSQL, MySQL and
MariaDB, Oracle, SQLite and Azure Data Explorer on macOS, Windows and Linux. Both work through the app running on
your computer: the AI tool never receives connection credentials, and each write waits for your approval in Jam SQL
Studio.

| | For | What it uses |
|---|---|---|
| [`skills/jam-sql`](skills/jam-sql/SKILL.md) | Any agent that reads skills: Claude Code, Codex, Cursor, Copilot, Gemini CLI and others | The `jam-sql` CLI that ships with the app |
| [`plugins/jam-sql`](plugins/jam-sql/README.md) | Claude Code | The app's MCP server, plus a skill for its tools |

## The `jam-sql` skill

```
npx skills add jamsql/skills --skill jam-sql
```

The skill teaches the agent the `jam-sql` commands: list connections, run queries, compare schemas, browse Azure
Storage, open tabs in the app. On first use the agent runs `jam-sql pair`, and you approve the dialog in Jam SQL
Studio.

## The Claude Code plugin

```
/plugin marketplace add jamsql/skills
/plugin install jam-sql@jamsql
```

See [plugins/jam-sql/README.md](plugins/jam-sql/README.md) for what it contains and what it reads, sends and runs.

## Requirements

- [Jam SQL Studio](https://jamsql.com/download/) running on the same computer, with
  **Settings → AI Integrations → Enable MCP server** on.
- Each connection's AI permission level (Block, Read-only or Confirm) is set in the app. It starts at
  Block until you change it.

Documentation: <https://jamsql.com/docs/ai-integrations-mcp/> · Support:
[support@jamsql.com](mailto:support@jamsql.com) · License: MIT (this repository). Jam SQL Studio itself is free for
personal, non-commercial use; commercial use needs [Pro](https://jamsql.com/pricing/).
