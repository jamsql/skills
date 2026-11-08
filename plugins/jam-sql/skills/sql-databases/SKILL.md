---
name: sql-databases
description: Work with the user's databases (SQL Server, PostgreSQL, MySQL/MariaDB, Oracle, SQLite, Azure Data Explorer) through the Jam SQL Studio desktop app's MCP tools — list saved connections, read schema, run queries, show results in the app. Use when the user asks about data or schema in a database they have saved in Jam SQL Studio.
---

# Databases through Jam SQL Studio

This plugin's `jam-sql` MCP server talks to the Jam SQL Studio app running on this computer. The app holds the
saved connections and their credentials. You get tools; you never get passwords or connection strings.

## Before the first call

- Jam SQL Studio must be running, with **Settings → AI Integrations → Enable MCP server** on.
- The server needs a pairing token. When a call fails with "Not paired", run `jam-sql pair` in a terminal (the
  `jam-sql` CLI ships with the app) and ask the user to approve the dialog in Jam SQL Studio.
- Server errors say what to fix (app not running, MCP server off, token rejected). Pass them on to the user instead
  of retrying.

## Working with data

1. `connections_list` returns the saved connections without credentials. Use a connection's id in later calls.
2. If a connection is not open yet, `connections_connect` opens it. By default the user approves this in the app;
   if they decline, do not ask again for that connection.
3. Read the schema before writing SQL: `schema_list_tables`, `schema_list_views`, `schema_get_columns`,
   `schema_get_indexes`, `schema_get_constraints`, `schema_get_dependencies`.
4. `query_execute` runs SQL and returns the rows to you. Use `ui_execute_query` instead when the user wants to see
   the results in the app. Kusto (Azure Data Explorer) connections take KQL, not SQL.
5. For how-to questions about the app itself, read the server's knowledge resources, starting with
   `sql-studio://knowledge/app_user_guide`.

## Permissions and approvals

The user sets an AI permission level per connection in Jam SQL Studio:

- **Block** (the default): no query runs. You can still read the schema and put SQL into a query tab.
- **Read-only**: reads run (`SELECT`, `EXPLAIN`, `SHOW`, `PRAGMA`, SQL Server's read-only system procedures).
- **Confirm**: each write waits for the user to approve it in Jam SQL Studio's window. The approval shows the whole
  SQL and, for most `UPDATE` and `DELETE` statements, how many rows they affect.

Rules:

- When a call is refused because of the permission level, tell the user which level it needs. Do not rewrite the
  SQL to get past the check.
- When the user rejects a write, that answer stands. Ask before proposing a different write.
- Never ask the user for database passwords or connection strings. Adding a connection from an AI tool is off
  unless the user turned on **Settings → AI Integrations → Allow AI to add new connections**.

Documentation: <https://jamsql.com/docs/ai-integrations-mcp/>
