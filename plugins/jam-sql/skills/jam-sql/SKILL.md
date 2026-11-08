---
name: jam-sql
description: Use Jam SQL Studio to query SQL databases, list connections, compare schemas, and explore data via the jam-sql CLI.
globs:
  - "**/*.sql"
---

# Jam SQL Studio

**Jam SQL Studio** (or "Jam SQL" for short) is a desktop application for working with SQL databases. Features include IntelliSense, function signature help (parameter hints for functions/procedures across all engines), execution plans, schema/data compare, the Visual Query Editor (renders SELECT/INSERT/UPDATE/DELETE/MERGE statements as structural cards with round-trip editing of clauses — columns, filters, joins, sorts, CTEs, set operators, and more — plus running the active statement in place; the Query Editor toolbar's SQL | Visual switch, `Cmd+Shift+V` and the command palette's Toggle Visual view show the statement under the cursor as cards in the same tab; More → Visual Query Editor on the main toolbar does the same, or opens a new query tab in the Visual view), and more. The `jam-sql` CLI lets you interact with the running app from the terminal. All database operations go through the app — no credentials are exposed to the CLI.

For desktop UI guidance, the Query Editor runs the narrowest available scope with `F5`: a runnable selection, then the statement under the cursor, then the whole buffer. `Cmd/Ctrl+Enter` and `Shift+Enter` run any non-empty selection or the current statement without a completeness check, never the whole multi-statement buffer; on a blank line it uses the nearest statement above, and an empty editor shows **No statement to execute.** These are app shortcuts, not `jam-sql` CLI commands.

Those are the defaults. Users can change, add or remove shortcuts in **Settings → Keyboard Shortcuts** (and carry them to another machine with Settings → Backup & Transfer), so when a user's keys behave differently, point them to that tab rather than assuming the defaults. The tab's **Scheme** picker can also switch the defaults to the keys of SSMS / Azure Data Studio, JetBrains DataGrip, DBeaver or the VS Code mssql extension (for example `Ctrl+R` for the SSMS results pane, `Alt+X` for the DBeaver whole script, `Cmd/Ctrl+Shift+E` instead of `F5` for VS Code mssql; `Cmd/Ctrl+Enter` and `Shift+Enter` run the current statement in every scheme).

> **IMPORTANT — CLI only.** Always use the `jam-sql` CLI commands below. Do **not** search for, load, or call MCP tools directly (e.g. via `ToolSearch` or `use_mcp_tool`). The CLI already wraps the app's protocol internally — you just run shell commands.

For Table Designer usage, consult the Visual DDL section of the app-generated knowledge pack. New Table accepts an initial column through Add Column; Save creates a new table or applies only pending changes to an existing table. View SQL shows the editable definition, which is compared with the last successful save. Literal whitespace and comment semicolons are preserved.

## Getting Started

### 1. Check if paired

```bash
jam-sql status
```

If not paired, run:

```bash
jam-sql pair
```

This opens a verification dialog in the app. Approve it to complete pairing.

### 2. List connections

```bash
jam-sql connections
```

### 3. Run a query

```bash
jam-sql query "SELECT TOP 10 * FROM customers" -c <connection-id>
```

> **Kusto / Azure Data Explorer connections** (engine `kusto`) run **KQL**, not SQL — use the same `jam-sql query` command but write KQL (e.g. `jam-sql query "StormEvents | take 10" -c <id>`). Kusto is **read-only / append-only**: only queries and `.show` commands run (`.create` / `.drop` / `.ingest` are blocked), and Table Explorer browses but cannot edit these connections.

> **Azure Storage connections** (engine `azurestorage`) run **no SQL** (Table entities are filtered with OData) — `jam-sql query` refuses them with "Azure Storage connections have no query language; use the storage browser or the storage_* tools." Do not retry with different SQL. Browse blobs with `jam-sql storage containers|ls|props|info|download -c <id>` and queues through the in-app Queues folder or the `storage_list_queues` / `storage_peek_messages` MCP tools. Peeking does not consume messages; send / receive / clear are refused at read-only and require user approval at `confirm`. The planned `jam-sql storage queues|peek|send|receive|clear` CLI wrappers arrive in S11, so use `jam-sql call <tool>` until then. Blob properties, metadata, index tags, tiers, container public access and policies are managed in the in-app storage browser (`jam-sql call ui_open_tab type=storage-explorer connectionId=<id> resource='{"kind":"container","container":"images"}'`). The storage browser's Preview pane also shows and edits a selected file for the user (JSON tree, Markdown, text, images, video, audio; Save checks the ETag); agents have no in-memory content tool — read a file with `storage_download` and change it with `storage_upload`. `storage_upload` takes `blobOptions` for blob destinations (`blobType` block / append / page, `vhdAsPageBlob`, `accessTier` for block blobs, `tags`); options the connection cannot honour are refused before approval. Open in local app (a downloaded copy opened in the user's OS app, its changes uploaded back) is a UI action agents cannot run. Reads are refused at permission level `block`; SAS generation is write-gated and requires approval at `confirm`. Query Table entities with `storage_query_entities`, following its opaque `continuationToken` (pass it back as `cursor`) and the 15-comparison OData limit. `storage_write_entities` creates, merges, replaces or conditionally deletes entities; updates/deletes require a concrete ETag and follow the connection's block/read-only/confirm policy. The approval shows the user the table and the operation totals and lists every targeted PartitionKey/RowKey once (deletes and replaces first), never property values. In a `$filter`, infinite Doubles are `INF` / `-INF`; NaN never matches a comparison (`X gt INF` finds stored NaNs). Table create/delete remains UI-only. File shares (SMB and NFS) ride the same tools with share / directory / file refs — see `jam-sql storage` below.

---

## Adding a new connection (optional, opt-in)

If the user has enabled it (Settings → AI Integrations → Allow AI to add new connections),
you can add a connection on their behalf:

```sh
# Typical usage — pass password via stdin to keep it out of shell history.
echo "$DB_PASSWORD" | jam-sql connection add \
  --engine pgsql \
  --alias prod-analytics \
  --server db.example.com --port 5432 \
  --login readonly --password-stdin \
  --database analytics
```

The tool tests the connection before saving. If the test fails, the connection
is **not** saved — verify the credentials and try again.

On success the response contains a `connectionId` you can immediately use with
`query_execute` and the other MCP tools (the connection is left alive by default).

A failure that names a proxy ("Could not reach the proxy server …", "HTTP 407") or an untrusted certificate is the user's
network setup: ask them to check **Settings → Network** in the app (proxy mode, credentials, imported certificates and
its Test). There is no tool to change those settings.

### Kusto / Azure Data Explorer (engine `kusto`)

`--server` takes the **full endpoint URL** — this covers every Kusto-protocol service:

| Endpoint | URL shape |
|---|---|
| ADX cluster | `https://<cluster>.<region>.kusto.windows.net` |
| Free personal cluster ([create](https://dataexplorer.azure.com/freecluster)) | `https://kvc-<name>.<region>.kusto.windows.net` |
| Azure Monitor / Log Analytics ([docs](https://learn.microsoft.com/azure/azure-monitor/logs/azure-data-explorer-query-proxy)) | `https://ade.loganalytics.io/subscriptions/<sub>/resourcegroups/<rg>/providers/microsoft.operationalinsights/workspaces/<workspace>` |
| Application Insights | `https://ade.applicationinsights.io/subscriptions/<sub>/resourcegroups/<rg>/providers/microsoft.insights/components/<app>` |

Auth is Entra-based (`--auth`): `"Azure CLI"` is the easiest when the user has run
`az login` (no credentials needed); `"Service Principal"` is fully headless
(`--login` = app client ID, `--password-stdin` = client secret, `--tenant-id`
required); `"Microsoft Entra ID (Interactive Browser)"` opens a sign-in window on
the user's machine during the test — tell them to complete it.

`--database` may be left out: the connection then works in the first database (by
name) the account can open, and `jam-sql query` without a database runs there.

```sh
# Azure CLI auth — zero credentials, uses the user's az login
jam-sql connection add --engine kusto \
  --server https://mycluster.westeurope.kusto.windows.net \
  --auth "Azure CLI" --database MyDatabase

# Service Principal — headless
echo "$KUSTO_CLIENT_SECRET" | jam-sql connection add --engine kusto \
  --server "https://ade.loganalytics.io/subscriptions/<sub>/resourcegroups/<rg>/providers/microsoft.operationalinsights/workspaces/<workspace>" \
  --auth "Service Principal" --login "<app-client-id>" --password-stdin \
  --tenant-id "<tenant-id>"
```

### Azure Storage (engine `azurestorage`)

An Azure Storage account, the Azurite emulator, or ONE SAS-scoped / public resource. Pick the shape the user has:

| What the user has | Flags |
|---|---|
| Account name (`contoso`) or endpoint URL + account key | `--server contoso --auth "Account Key" --password-stdin` (the key) |
| Account name + account SAS token | `--server contoso --auth "Shared Access Signature" --password-stdin` (the `sv=…&sig=…` token) |
| A connection string (`DefaultEndpointsProtocol=…;AccountName=…;AccountKey=…`, `…;SharedAccessSignature=…`, or `UseDevelopmentStorage=true`) | `--connection-string-stdin` — parsed by the app into server / password / endpoints / scope and **never stored** |
| A container / prefix / blob / share SAS URL, or a public container URL | `--connection-string-stdin` with the URL → a resource-scoped connection that never lists siblings (`--auth Anonymous` for a public URL). A share SAS URL may name the share, a folder (end it with `/`) or a file; when the app cannot tell a file from a folder it answers `validation_failed` with `AmbiguousSharePath` — add the `/` for a folder |
| Azurite (local emulator) | `echo "UseDevelopmentStorage=true" \| jam-sql connection add --engine azurestorage --connection-string-stdin` |
| Entra ID (RBAC data-plane roles) | `--auth "Azure CLI"` (after `az login`), `"Service Principal"` (`--login` = client ID, `--password-stdin` = secret, `--tenant-id`), or `"Microsoft Entra ID (Interactive Browser)"` |
| Managed disks of a subscription or resource group | `--server /subscriptions/<id>` (or `/subscriptions/<id>/resourceGroups/<name>`, or the bare subscription GUID) with an Entra `--auth` only — an "Azure subscription" connection: no storage services, the `storage_*_disk*` tools below |

`--database` and `--port` are not used. There is no SQL on the resulting connection — use `jam-sql storage …`.

Entra identities need a DATA role to read: Reader / Contributor / Owner list containers, tables and queues but a blob listing, entity query or peek is refused until the identity holds Storage Blob / Table / Queue Data Reader (Contributor for writes). Such a refusal comes back as `category: "authorization"` with `fix.kind: "needs-role"`, the role in `fix.role` and a message naming the scope and the remedies — assign the role in the Azure portal, or switch the connection's **Data access** to the account key in the app (the identity then reads the key via Azure Resource Manager `listKeys` at each connect; keys bypass RBAC; UI-only, never a CLI/MCP option). Do not retry it; tell the user which role is missing. A generic `AuthorizationFailure` 403 is different: it keeps Azure's message with `fix.kind: "check-network"` (a firewall / network rule, disabled public network access or a role condition — the data role is only a possible cause). Account-key data access is public-Azure only and refused when the connection's endpoints are not the account's own.

File shares with Entra: file data needs **Storage File Data Privileged Reader** (or Contributor); listing shares needs a role that can read the account (for example Reader). An identity with data roles only cannot list shares — Test Connection reports "share names required" and the user adds share names in the app (connection form, or **Open share by name…**; there is no CLI flag). Creating, resizing, snapshotting and deleting shares needs a management role such as Storage Account Contributor (or the account key); a refusal names it.

```sh
# Account key, kept out of shell history
echo "$STORAGE_ACCOUNT_KEY" | jam-sql connection add --engine azurestorage \
  --alias contoso-storage --server contoso --auth "Account Key" --password-stdin

# One container via its SAS URL (resource-scoped)
echo "https://contoso.blob.core.windows.net/images?sv=…&sig=…" | jam-sql connection add \
  --engine azurestorage --alias contoso-images --connection-string-stdin
```

### Azure environments (Azure China, Azure US Government, custom)

SQL Server with Microsoft Entra sign-in, Kusto and Azure Storage connections sign in to an **Azure environment**:
`AzureCloud` (public), `AzureChinaCloud`, `AzureUSGovernment`, or a custom environment by id (`custom:<uuid>`, added by
the user in Settings → Azure environments) or by its name when exactly one environment has it. `connections_list`
shows each such connection's `azureEnvironment` (`{ "id", "name" }`) — reuse it to add another connection in the same
environment. Without one, the environment is the one the address names (a connection
string's `EndpointSuffix`, a `*.database.usgovcloudapi.net` / `*.kusto.chinacloudapi.cn` / `*.core.chinacloudapi.cn`
host), else the user's default for new connections; the result echoes `azureEnvironment`. To name one explicitly,
pass the `connections_add` arguments as JSON (`--from-json payload.json` with `"azureEnvironment": "AzureChinaCloud"`).
With `--auth "Azure CLI"`, `az` must be set to the same cloud (`az cloud set --name AzureChinaCloud`, then `az login`) —
otherwise the test fails with that command in the message. An Azure Stack Hub environment (a custom environment the user
saved with the Azure Stack Hub API profile) accepts no Microsoft Entra token for storage data: add Azure Storage
connections on it with the account key or a SAS (reading the key through Resource Manager is a choice in the app's
connection dialog); it has no Azure Files, Data Lake, access tiers, index tags, versions, soft delete or user
delegation SAS.

Error codes:
- `not_allowed` — the setting is off. Ask the user to enable it.
- `validation_failed` — a required field is missing, or `azureEnvironment` names an unknown or not yet reviewed environment.
- `environment_changed` — the user edited the Azure environment while the approval was open. Ask again.
- `alias_conflict` — alias already taken. Pass `--overwrite` to replace.
- `test_connect_failed` — credentials rejected; connection NOT saved.
- `user_denied` — user declined the in-app confirm modal.

---

## CLI Commands

### `jam-sql status`

Show pairing status, whether the app is running, server state, and installed skill versions.

### `jam-sql connections`

List all saved database connections (no credentials exposed).

```bash
jam-sql connections              # Table format
jam-sql connections -o json      # JSON format
```

### `jam-sql query <sql>`

Execute a SQL query against a connected database. The text may hold several statements (separated by `;`, or `GO` lines on SQL Server); every result set is printed.

```bash
jam-sql query "SELECT * FROM users LIMIT 10" -c <connection-id>
jam-sql query "SELECT * FROM orders" -c <connection-id> -d <database> -o json
jam-sql query "SELECT COUNT(*) FROM products" -c <connection-id> --max-rows 5000
jam-sql query "SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM customers" -c <connection-id>
```

**Flags:**
- `-c, --connection` — Connection ID or alias
- `-d, --database` — Database name
- `-o, --output` — Format: `table` (default), `json`, `csv`
- `--max-rows` — Max rows to return (default: 1000)
- `--timeout` — Ask for a shorter query timeout, in seconds (default: none — the app's agent query timeout applies, 30 s unless the user changed it)

`--max-rows` and `--timeout` can only ask for **less** than the user's Settings → AI Integrations values, never more; a result set cut short says so under the row count. A query that runs past the limit fails with `Query timed out after N seconds`, says whether the query stopped after Jam's cancel, and for a read suggests a cheaper query (a row limit, filters on indexed columns, the estimated plan) — running it again unchanged takes as long. To run it without the agent limit, open it in a query tab for the user (`jam-sql call ui_open_tab type=query initialSql="…"`); query tabs use the app's own query timeout.

`--timeout` also bounds how long the CLI waits for the answer: that many seconds plus two minutes, for a write's approval prompt. After that the CLI stops waiting and asks the app to cancel the query, but the query may still finish, so check whether a write took effect before running it again. Without `--timeout` the CLI waits until the app answers; the app ends the query at the agent query timeout from Settings.

When the SQL names a table or column that does not exist, the error ends with the database the query ran in (the connection's default unless you passed `-d`; on Oracle, the schema) and up to three existing names close to the one you wrote. After a `USE` in the same SQL (Oracle: `ALTER SESSION SET CURRENT_SCHEMA`), also one inside dynamic SQL (`EXEC('USE …')`, `sp_executesql`, `EXECUTE IMMEDIATE`, or a body that is not a literal), it names no database, and suggests names only for a table whose name says which database it is in. Read that before listing the schema. To search, pass `nameFilter` to `schema_list_tables`, `schema_list_views`, `schema_list_procedures` or `schema_list_functions` (`jam-sql call schema_list_tables connectionId=<id> database=MyDB nameFilter=order`): only the objects whose name or `schema.name` contains the text are returned, with `matchCount` and `totalCount`.

A query whose connection dropped is never run again. The error says Jam cannot tell whether it completed and that the next call reconnects. Run it again only if repeating it is safe; for a write, or a function that might change data, check first whether it took effect. A connection that failed to connect moments ago answers at once for about a minute with `Connection '<name>' is unreachable: …` or `… cannot connect: …`, naming what failed: do not retry, tell the user what to check. Redirect `-o csv` to a file for a quick dump — but when the user wants a real export file, use `ui_export_results` instead (below): it writes Excel, dialect-aware INSERTs and WKT-decoded spatial columns, and is not capped by `--max-rows`.

### Exporting results to a file

`jam-sql call ui_export_results tabId=<tab> format=xlsx` exports a results grid the way the app's own export menu does. **You do not choose the path** — the app opens its save dialog and the user picks the destination, so the call blocks until they answer and returns `cancelled: true` if they dismiss it. Tell them to expect the dialog.

```bash
jam-sql call ui_export_results tabId=tab-1 format=xlsx
jam-sql call ui_export_results tabId=tab-1 format=csv scope=all-rows   # stream every row
```

- `format` — `csv`, `json`, `xlsx`, `markdown`, `sql` (INSERT statements)
- `scope` — `loaded` (default; the rows the grid holds) or `all-rows` (streams everything; CSV-only, windowed query-editor result sets only)
- `allResultSets` — every result set in a query tab rather than the active one; Excel and JSON only

Exports the **active** result set — call `query_switch_tab` first if the user means a different one. Refused when the connection is at permission level `block`.

`format=sql` writes binary columns as the stored bytes: the app re-reads values the grid shows only as `[binary N bytes]` or a hex preview by the row's primary key. A value it cannot read (no primary key in the result, a self-join, a table in another database, a table read through a SQL Server linked server or a temporary table, SQL Server over SQL Tools Service, a binary key, a value that is no longer the one shown, an Oracle RAW / LONG RAW value over 32,767 bytes, an Oracle BLOB shown as NULL without the key — it may be empty, over 64 MB in one script) becomes `NULL` with a SQL comment, and the app shows the user a warning — tell them which column was left out rather than calling the script complete. On a large result whose grid loads rows as it scrolls, `format=sql` writes the loaded rows with long text read again whole; when those values add up to more than 64 MB it fails with a message saying so, and a narrower query is the way out; when the user runs the query again or sorts or filters the grid while the rows are read, it fails with "The results changed while they were being read. Try again." and a retry is the way out; when the rows cannot be read again (the connection was lost) it fails with "The rows the grid loaded could not be read again. Try again, or run the query again.". Saving one binary cell to a file ("Save value to file…") and the Export menu's Copy SQL (INSERT) / Open SQL (INSERT) are UI actions with no tool.

### `jam-sql storage <containers|ls|props|info|download>`

Browse the blob side of an Azure Storage connection (engine `azurestorage`; blob containers). File shares have no `jam-sql storage` wrapper yet (S11) — call the tools below through `jam-sql call`. Each subcommand forwards to the app's `storage_*` tool, so scope containment, paging and secret redaction happen in the app. For Tables, call `storage_query_entities` or `storage_write_entities` through `jam-sql call`; preserve tagged EDM values and pass the returned continuation token unchanged. `storage_count_entities` counts all entities of a table, or those matching `filter`, by reading every page (read-only; `maxSeconds` bounds it and an unfinished count says `complete: false`); importing a CSV / JSON / XLSX file into a table is a UI action in the app, not a tool. `storage_copy_table` copies a table into an EXISTING table on the same or another connection as a Transfers job the user approves (`ifExists`: skip / merge / replace / fail; `filter`; `copyMetaInfo`, which needs Settings → AI Integrations → Allow AI to declare MetaInfo); `createTarget: true` is refused — the user creates the table in the app.

```bash
jam-sql storage containers -c <connection-id>                       # one page of containers
jam-sql storage ls -c <connection-id> images                        # blobs + virtual folders at the container root
jam-sql storage ls -c <connection-id> images/2026/09/ --recursive --max-results 500
jam-sql storage ls -c <connection-id> images --continuation <token> # next page (continuationToken from the previous answer)
jam-sql storage props -c <connection-id> images/2026/09/photo-00001.png
jam-sql storage info -c <connection-id>                             # account name, kind, HNS, scope, per-service availability
jam-sql storage download -c <connection-id> images/2026/09/photo-00001.png
```

Queues are available in the app and through `storage_list_queues`, `storage_peek_messages`, `storage_send_message`, `storage_receive_messages`, and `storage_clear_queue`. The queue-specific `jam-sql storage queues|peek|send|receive|clear` wrappers are deferred to S11; call those MCP tools through `jam-sql call` for now. Never treat Receive as Peek: Receive changes visibility and requires user approval.

File shares (Azure Files, SMB and NFS) go through `jam-sql call`: `storage_list_containers` with `service=file` lists shares; `storage_list`, `storage_get_properties` and `storage_download` take `{"kind":"share","share":"docs"}`, `{"kind":"directory","share":"docs","path":"reports"}` or `{"kind":"file","share":"docs","path":"reports/q3.csv"}` (optional `"snapshot"`: a read-only share snapshot); a share lists one folder per call (`recursive` is refused). `storage_upload` takes a share / directory destination (missing folders are created; on an NFS share `collision=overwrite` is refused — use skip or rename). `storage_delete` takes files and folders of ONE share (folders recursively) or one whole share with its snapshots; blob and file refs never mix in one call. `storage_create_share`, `storage_set_share_quota` and `storage_share_snapshots action=create|delete` need write approval (`action=list` is a read); `storage_mount_command` returns mount commands as text with a `<storage-account-key>` placeholder, never the key. Every write approval lists every target; a call names at most 1,000 refs.

**Flags:** `-c, --connection` (required) · `--prefix` (name filter, relative to the location for `ls`) · `--continuation` · `--max-results` (1–5000, app default 1000) · `--recursive` (`ls` only) · `-o json|raw`.

`download` never takes a path: the app opens its save dialog and the **user** picks the destination (tell them to expect it); the command blocks until the transfer settles and prints `{"cancelled": true}` if they dismiss it — do not ask again. Every subcommand is refused at permission level `block`; SAS tokens and keys never appear in any answer.

To generate a SAS, discover `storage_generate_sas` with `jam-sql tools -o json`, then call it through `jam-sql call`. It is denied at `block` and `read-only`; at `confirm` the user must approve in Jam SQL Studio. The token stays in the app's result panel—the CLI receives only non-secret facts: `enforced` (permissions, start, expiry, protocol, IP range) and `resourceUrl`, the resource URL without any query string. Permission letters may be given in any order; the app normalizes them to the canonical order per resource (account `rwdxftlacupiy`, container `racwdxltmeiyf`, blob `racwdxtmeiy`, table `raud`, queue `raup`, share `rcwdl`, file `rcwd`). The approval shows the resource, SAS kind, permissions in words, validity window and a warning for risky grants; an invalid request is refused before approval. For a stored-policy SAS the app reads the policy first and the approval shows the permissions, start and expiry the token will actually have; an unreadable, missing or incomplete policy is refused before approval, and `AccessPolicyChanged` means the app's read just before signing found the policy changed after approval and nothing was signed — call again so the user approves the current terms (a change after that read is not detected and applies to the issued token). The tool is refused on a read-only storage connection (in the app's own dialog such a connection can mint only `rl` for an account or container and `r` for a blob, table or queue). Policy-backed SAS works for blob containers, blobs, tables, queues and file shares / files (a share or file SAS needs the account key; a file signs under its share's policy; a blob signs under its container's policy, so a read/list container policy can back a blob SAS on a read-only connection; a table or queue policy is checked with its own letters `raud` / `raup`); snapshots and versions cannot be signed yet; user delegation needs the Storage Blob Delegator role and an expiry within seven days from now.

**ADLS Gen2 (hierarchical namespace).** When `jam-sql storage info -c <id>` answers `hns: "yes"`, containers are Data Lake file systems: the app opens them in a Data Lake view (Owner / Group / Permissions, real directories) with a switch to the Blob view. A Data Lake path is also a blob — `lake/raw/a.csv` is `{"kind":"blob","container":"lake","name":"raw/a.csv"}` — so download / upload / delete keep using the blob refs. The Data Lake tools take a locator `{"fileSystem":"lake","path":"raw"}` (`""` = the file-system root); the `jam-sql storage` Data Lake wrappers arrive in S11, so call the tools through `jam-sql call` meanwhile:

```bash
jam-sql call storage_get_acl connectionId=<id> target='{"fileSystem":"lake","path":"raw"}'
jam-sql call storage_list connectionId=<id> resource='{"kind":"hnsPath","fileSystem":"lake","path":"raw"}'
jam-sql call storage_set_acl connectionId=<id> target='{"fileSystem":"lake","path":"raw"}' \
  change='{"mode":"modify","entries":[{"scope":"access","type":"user","id":"<object-id>","permissions":{"read":true,"write":false,"execute":true}},{"scope":"access","type":"mask","permissions":{"read":true,"write":false,"execute":true}}]}'
jam-sql call storage_create_directory connectionId=<id> target='{"fileSystem":"lake","path":"curated/2026"}'
jam-sql call storage_move_path connectionId=<id> source='{"fileSystem":"lake","path":"raw"}' destination='{"path":"landing"}'
```

`storage_get_acl` is a read (denied at `block`); `storage_set_acl`, `storage_create_directory` and `storage_move_path` need `confirm` plus the user's approval and are refused on read-only connections. Masks are never recalculated for you: a `modify` that adds or changes a named user / group must carry that scope's `mask` entry (else `MaskRequired`). A single-path change is refused without changing anything when the path was replaced (`PathChanged`) or its ACL, read again just before the write, differs from the tool's read (`AclChanged`) — read again and retry. Azure has no condition for ACL writes, so a change made in the moment between that check and the write can still be overwritten. `recursive: true` changes a directory and everything under it as a Transfers job the call waits for; it cannot be conditional, and the approval says exactly what is checked. Its answer lists up to 100 failed paths (the rest counted in `failuresOmitted`); a cancelled or interrupted job reports its confirmed counts and "Remainder: unknown" — never assume the rest is untouched. Changing entries needs Storage Blob Data Owner (or being the path's owning user); changing the owner always needs Storage Blob Data Owner. A move never overwrites and is refused when the source changed after the check; a `partial` / `uncertain` answer carries a `pendingMoveId` — call `storage_move_path continuePendingMoveId=<id>` (an uncertain move is re-checked, never re-sent: `moved` only when the check proves it, `MoveNotApplied` when it proves nothing moved — no sooner than a minute after the lost answer, since Azure may still complete the request until then — else `MoveOutcomeUnknown`). A recursive `modify` without a scope's `mask` makes Azure recalculate that mask on every path, and one WITH a mask writes that mask onto every path, replacing narrower ones (the approval says both). `storage_generate_sas` accepts `{"kind":"hnsPath","fileSystem":"lake","path":"raw","isDirectory":true}` for a directory SAS (`sr=d`; letters `racwdlmeop`; path `""` signs a container SAS).

**Leases.** `storage_lease` acquires, renews, releases or breaks the leases of 1–100 blobs, containers and Data Lake folders. A blob / Data Lake file lease refuses writes and deletes without the lease ID; a container lease only refuses deleting the container; a folder lease refuses its rename, delete and ACL changes (paths inside stay writable).

```bash
jam-sql call storage_lease connectionId=<id> action=acquire targets='[{"kind":"blob","container":"images","name":"a.png"}]'            # infinite (stays after the app quits)
jam-sql call storage_lease connectionId=<id> action=acquire durationSeconds=30 targets='[{"kind":"container","container":"images"}]'
jam-sql call storage_lease connectionId=<id> action=break breakPeriodSeconds=0 targets='[{"kind":"hnsPath","fileSystem":"lake","path":"raw","isDirectory":true}]'
```

It needs `confirm` plus the user's approval (the dialog says what the action does and lists every target) and is refused on read-only connections. A lease it acquires is held by Jam SQL Studio, which sends it with the app's own writes; `renew` / `release` act only on leases the app holds (`LeaseNotHeldByApp` otherwise). The answer is one line per target — `acquired`, `renewed`, `released`, `broken`, `breaking`, `not leased`, `uncertain` or `refused` with the reason — plus `heldByApp`; it never contains a lease id, and there is no way to obtain one. `uncertain` means the answer was lost: the user resolves it in the app (Lease → Check). A write refused because another client holds a lease comes back as `category: "conflict"` with `fix.kind: "break-lease"` — ask the user before breaking someone else's lease.
Snapshots, versions and soft delete: `storage_list` takes `include='{"deleted":true,"versions":true,"snapshots":true,"deletedWithVersions":true}'` on a container or folder (on a Data Lake directory only `deleted`, and each deleted path carries a `deletionId`); a `continuationToken` belongs to the include set it came with. `storage_list_containers includeDeleted=true` adds soft-deleted containers (`deletedVersion`), or with `service=file` lists the soft-deleted shares. `storage_list_history` lists one blob's current version, earlier versions and snapshots (read them with `versionId` / `snapshot` on the blob ref), or a Data Lake path's deleted copies. `storage_snapshot` and `storage_restore` need `confirm` plus approval:

```
jam-sql call storage_restore connectionId=<id> action=undelete entries='[{"container":"lake","name":"raw/a.csv","deletionId":"134354524097447888"}]'
jam-sql call storage_restore connectionId=<id> action=container container=logs deletedVersion=01DD52DB3D7793C8
jam-sql call storage_restore connectionId=<id> action=promote source='{"kind":"blob","container":"docs","name":"a.txt","versionId":"2026-10-01T00:00:00.0000000Z"}'
```

`action=promote` copies a version or snapshot over the current blob as a copy job the call waits for; `snapshotFirst` (default true) keeps the current content as a snapshot first, a blob without a current version gets the entry back as its current blob, and an archived entry is refused (copy it to a new blob with `storage_copy`).

Undelete restores every soft-deleted version and snapshot of a blob together; under `locations` a Data Lake path gets its most recently deleted copy; an item whose name is taken stays deleted. A container or share restore is refused for about 30 seconds after the delete — wait and call again.

**Copy and move blobs.** `storage_copy` and `storage_move` copy server-side between containers, connections and accounts (Data Lake included) as a Copy job the call waits for; the approval lists every source and the destination, and both connections are checked (a move also writes the source):

```bash
jam-sql call storage_copy sourceConnectionId=<src> destinationConnectionId=<dst> \
  sources='[{"kind":"blobPrefix","container":"logs","prefix":"2026/"}]' destination='{"kind":"container","container":"archive"}' collision=skip
jam-sql call storage_move sourceConnectionId=<id> destinationConnectionId=<id> \
  sources='[{"kind":"blob","container":"in","name":"a.csv"}]' destination='{"kind":"blobPrefix","container":"done","prefix":"2026/"}'
```

A move deletes each original only after its copy is verified and only while it is the version that was copied; a changed, snapshotted or leased original is kept and reported (`SourceChangedAfterCopy`, `SourceHasSnapshots`, `Lease…`). Containers copy with `destination='{"kind":"service","service":"blob"}'` (`containerAction` merge / new-name / skip when the name exists) and are never moved. Archived blobs need `archiveTier` (Hot / Cool / Cold), keep their metadata (a paste with archived blobs runs with `keepMetadata: true`) and come back as `rehydrating` — Azure finishes them later. Within ONE Data Lake connection `storage_move` is Azure's rename and answers each path's outcome.

**Managed disks.** On an Azure subscription connection (`server` = `/subscriptions/<id>[/resourceGroups/<name>]`): `storage_list_disks` (one resource group; may be omitted when the connection reaches exactly one) and `storage_get_disk` read; `storage_create_disk_snapshot` (incremental by default), `storage_copy_disk` (same region, or `location` for another — the source gets read access while that copy runs, and a stopped one starts again; SKU / zone chosen, OS / Entra / network settings kept, tags not copied), `storage_upload_disk` (`path` of a local FIXED VHD — dynamic VHD / VHDX / a size Azure cannot use are refused before the approval; region, SKU, zone, optional OS type, generation, architecture, Entra data access), `storage_download_disk` (approval, then the user's save dialog; the call waits for the Transfers job; the app revokes the access it granted when the download ends, never an external grant; a second transfer of a disk another transfer uses is refused) and `storage_delete_disk` need `confirm` plus approval and are refused on read-only connections — granting read access for a download is a write. A disk attached to a VM, a snapshot still copying, a disk that denies network access, or (copy) a customer-managed-key / private-endpoint / Trusted Launch source is refused before any dialog; an agent never revokes access, so a disk whose access is granted cannot be deleted by an agent. Creating anything fails with `MissingSubscriptionRegistration` until a subscription owner registers `Microsoft.Compute`. No tool returns an access URL.

```bash
jam-sql call storage_list_disks connectionId=<id> resourceGroup=rg
jam-sql call storage_create_disk_snapshot connectionId=<id> source='{"kind":"disk","resourceGroup":"rg","name":"data-disk"}' name=data-disk-snap
jam-sql call storage_download_disk connectionId=<id> disk='{"kind":"snapshot","resourceGroup":"rg","name":"data-disk-snap"}'
jam-sql call storage_upload_disk connectionId=<id> path=/images/data.vhd target='{"resourceGroup":"rg","name":"data-disk-2"}' location=westeurope sku=Standard_LRS
```

Table entity filters use the supported OData subset and allow at most 15 comparisons. Page with the opaque `continuationToken`; never infer a total. An entity tab snapshot reports `filterState: { mode, odataFilter?, filters?, loading }` and only the active raw-or-wizard predicate is authoritative. Never replace an Int64 tagged value with a JavaScript number, never invent an ETag, and never route a table write through SQL.

Find objects by name beyond the prefix filter (blob containers, Data Lake directories, file shares and folders) with `storage_find`, a read:

```bash
jam-sql call storage_find connectionId=<id> resource='{"kind":"container","container":"reports"}' pattern='*.csv' maxResults=100
```

`pattern`: text = the name contains it; `*` / `?` = the whole name must match (`*.csv`, `report-202?.json`); a `/` matches the path below `resource` instead. Case-insensitive unless `matchCase=true`; `prefix` narrows the scan at the service. Each call scans at most `maxScanned` items (default 100,000) and returns at most `maxResults` matches (default 100); `stoppedBecause` says which ended it (`"error"`: the matches before a failed read, plus a token that retries it), and `continuationToken` continues the SAME search (repeat the same arguments; sending a token again repeats that answer; expires after 10 minutes idle). File shares cost one request per folder — start from the deepest folder you can. `include='{"deleted":true,"deletedWithVersions":true}'` also searches soft-deleted blobs and blobs without a current version (a Data Lake directory with `include.deleted` is searched in its blob view); restore a match with `storage_restore`.

### `jam-sql tools`

List all tools the app exposes (for use with `jam-sql call`).

```bash
jam-sql tools
jam-sql tools -o json
```

### `jam-sql call <tool> [key=value...]`

Call any app tool by name via the CLI.

```bash
jam-sql call connections_list
jam-sql call query_execute connectionId=abc-123 sql="SELECT 1"
jam-sql call ui_open_tab type=query connectionId=abc-123 database=MyDB initialSql="SELECT * FROM users"
jam-sql call schema_get_columns connectionId=abc-123 database=MyDB schema=dbo table=users
jam-sql call list_json_columns connectionId=abc-123 database=MyDB
```

On SQL Server, PostgreSQL and MySQL, a `database=` the login cannot open (offline, missing, no CONNECT) fails with `Database 'x' is not accessible` plus the reason; it is never answered from the connection's own database. The refusal is remembered for about a minute; reconnecting retries at once.

**Each `query_execute` call gets a clean session.** What the SQL changes on the session — `USE`, `SET`, `ALTER SESSION`, a temporary table, a session variable — is reset when the call finishes and never reaches the next one. Pass `database=` instead of running `USE`, and keep statements that depend on a session setting in the same call. A call cannot keep a transaction open for the next one either: if the SQL leaves one open (`BEGIN` without `COMMIT`), it is rolled back and the call fails with `OPEN_TRANSACTION_ROLLED_BACK` — put `BEGIN` and `COMMIT` in the same call. In a query tab (`ui_execute_query`, or the user's own runs) an open transaction stays with the tab until a later run ends it, and `transaction_commit` / `transaction_rollback` end it too. There a `USE` (on Oracle `ALTER SESSION SET CURRENT_SCHEMA`) also switches the tab's database, so the tab's next run runs in it.

**JSON column discovery:** `schema_get_columns` returns each column with an optional `jsonClassification` field (`native-jsonb` / `native-json` / `check-isjson` / `loose-json-declared` / `loose-json-inferred`) when the column is JSON-typed; the field is omitted on non-JSON columns. Use `list_json_columns` to get every JSON column in a database in one call — it combines engine-native JSON detection (Postgres `jsonb`/`json`, MySQL `JSON`, Oracle 21c+ `JSON`) with user-declared loose-JSON columns and returns the same `jsonClassification` lattice plus optional `pathHints` + `shape` from MetaInfo annotations. When generating SQL against JSON columns, prefer the engine's path-aware operators (`->`, `->>`, `@>` on Postgres/MySQL/SQLite; `JSON_VALUE` / `JSON_QUERY` / `JSON_EXISTS` on MSSQL/Oracle; `json_extract` on SQLite) over generic comparisons. See `sql-studio://knowledge/schema` for the column-metadata contract.

### `jam-sql resources`

List available app resources.

```bash
jam-sql resources
```

### `jam-sql read <uri>`

Read an app resource by URI.

```bash
jam-sql read sql-studio://knowledge/app_capabilities
jam-sql read sql-studio://knowledge/app_user_guide
```

### `jam-sql schema-compare`

Compare schemas between two databases.

```bash
jam-sql schema-compare --source <conn-id> --source-db MyDB --target <conn-id> --target-db OtherDB --wait
jam-sql schema-compare status <operation-id>
jam-sql schema-compare script <operation-id>
```

If `--source-db` or `--target-db` names a database the login cannot open, the comparison fails with `Database 'x' is not accessible` plus the reason instead of comparing the connection's own database; the refusal is remembered for about a minute, and a reconnect retries.

**Reading a comparison the user ran in the app:** comparisons open in the app's own Schema Compare tabs are listed too — `jam-sql read sql-studio://compare/schema` shows every recent comparison, the user's own included (`"initiatedBy": "user"`, operation ids like `ui-tab:<tabId>` matching the tabs in `sql-studio://context/tabs`). Feed that id to `jam-sql schema-compare status <operation-id>` for the full differences, or `jam-sql schema-compare script <operation-id>` for the sync script — don't re-run a comparison the user is already looking at. Each entry tracks what its tab currently shows (re-running or changing options in the app replaces it) and disappears when the tab closes.

### `jam-sql data-compare`

Compare table data between two databases.

```bash
jam-sql data-compare \
  --source <conn-id> --source-db MyDB --source-table users \
  --target <conn-id> --target-db OtherDB --target-table users \
  --key "id:id" --wait
jam-sql data-compare status <operation-id>
jam-sql data-compare diff <operation-id> --type modified
jam-sql data-compare script <operation-id>
```

### `jam-sql blueprint`

A **Database Blueprint** is a folder of `.sql` files materializing a database's DDL, kept in two-way sync (see the [Database Blueprint docs](https://jamsql.com/docs/database-blueprint/)).

```bash
# Read-only (require permission level read-only or confirm; denied at block)
jam-sql blueprint list                          # registered blueprints (label, engine, links, folder)
jam-sql blueprint get --folder /path/to/bp      # metadata + object count + on-disk drift
jam-sql blueprint preview --folder /path/to/bp  # pending-refresh per-file changes (no write)

# Mutating — write-gated: denied at block/read-only; approval prompt at confirm
jam-sql blueprint attach --folder /path/to/cloned-bp        # register an existing blueprint folder
jam-sql blueprint create --connection <id> --database MyDB --folder /path/to/empty --label Dev
jam-sql blueprint refresh --folder /path/to/bp --link Dev   # re-emit DDL + data from the linked DB

# DB-mutating — write-gated + approval shows the generated SQL before it runs
jam-sql blueprint apply-schema --folder /path/to/bp --link Dev   # folder → live DB schema
jam-sql blueprint sync-data    --folder /path/to/bp --link Dev   # folder → live DB rows (two-phase)
```

Use `--link <label>` to target a specific linked DB; it defaults to the blueprint's active link.

**Safety contract for blueprint mutations.** `attach`/`create`/`refresh` modify the registry or disk; `apply-schema`/`sync-data` modify a **live database**. All five are denied at permission level `block` and `read-only`. At `confirm`, each surfaces the in-app approval dialog (the DB-mutating pair shows the exact generated SQL / row-diff) and proceeds only on user approval — deny or 60 s timeout aborts. DB-mutating operations need Jam SQL Studio open and focused under `confirm` (a headless timeout auto-denies).

### `jam-sql launch`

Start Jam SQL Studio if not already running.

### `jam-sql pair` / `jam-sql unpair`

Pair or unpair the CLI with the running app.

---

## Safety Contract

**CRITICAL: Jam SQL Studio is privacy-first and permission-gated.**

Blueprint DB-mutating operations (`blueprint apply-schema`, `blueprint sync-data`) follow the same write-approval flow as `query_execute` write queries — they generate the SQL/row-diff, surface it in the in-app approval dialog, and execute only on approval.

Defaults (unless the user changes Settings → AI Integrations):
- The app's server is disabled by default
- Permission level defaults to `block` (no DB query execution). When a query is denied for this reason, do not report a bare failure and stop — **tell the user you can run it for them once they allow it**: Settings → AI Integrations → Permission Level → "Read-only" for SELECT-class queries, or "Confirm" to also allow writes with per-statement in-app approval (it can also be set per connection). Show them the SQL you would run, and offer to open it in a tab so they can run it themselves in the meantime.
- Connecting to a saved connection (`connections_connect`) asks the user in an approval dialog by default (Allow once / Always allow for this connection / Don't allow); the user can also set Settings → AI Integrations → "Allow AI to connect using saved connections" to Allow or Deny; a connection already open in Jam and able to run queries answers `alreadyConnected: true` at once, with no dialog
- Screenshots are enabled by default but must only be used after explicit user request

### DO:
- Execute `SELECT` queries to retrieve data
- Execute `WITH ... SELECT` (CTEs) for complex read operations
- Execute FROM-first queries (`FROM t SELECT ...`) on a Fabric Data Warehouse / SQL analytics endpoint connection — they count as `SELECT` (the `INTO` form does not); SQL Server and Azure SQL reject the syntax
- Execute `EXPLAIN`, `SHOW`, `DESCRIBE`, `SHOW CREATE`, `PRAGMA` for metadata; on Oracle, not `EXPLAIN PLAN` (refused at `read-only`: it writes PLAN_TABLE) — run the query, then `SELECT * FROM TABLE(SYS.DBMS_XPLAN.DISPLAY_CURSOR('<sql_id>'))` with the `sql_id` from `v$sql`
- Run SQL Server system procedures that only read at `read-only`: `EXEC sp_help 'dbo.Orders'`, `sp_helptext`, `sp_helpindex`, `sp_helpconstraint`, `sp_columns`, `sp_tables`, `sp_fkeys`, `sp_pkeys`, `sp_spaceused`, `sys.sp_who2`, `sys.sp_describe_first_result_set` and the like — the name in lower case and `sys.`-qualified (`EXEC sys.sp_who2`; never `dbo.`); `sp_help`, `sp_helptext`, `sp_helpindex`, `sp_columns`, `sp_spaceused` and the other procedures every SQL Server has may be bare; literal arguments, nothing after them before the next `;` or `GO`. `DECLARE` of scalar variables, `SET @var = …`, `SET NOCOUNT` and `SET STATISTICS IO` / `TIME` are reads too, and so are Oracle `SYS.DBMS_METADATA.GET_DDL` and `SYS.DBMS_XPLAN.DISPLAY` / `DISPLAY_CURSOR` / `DISPLAY_AWR` — write the `SYS.`; the DBMS_XPLAN readers take literal arguments only (a string, a whole number or `NULL`), `DISPLAY` at most three, never `filter_preds`. A SQL Server `USE` is a query hint only inside `OPTION (USE HINT (…))`; `SELECT 1 USE x` is a `USE` everywhere
- List connections to discover available databases
- Open query tabs and write SQL text without executing it (via `jam-sql call ui_open_tab`)
- Ask the user before connecting via `connections_connect`. Jam also shows the user its own approval dialog by default; after `The user declined connecting to …`, do not call it again for that connection — ask the user to connect in Jam

### DO NOT:
- Attempt queries when permission level is `block` (they will be denied) — instead, open the query in a new tab for the user to run manually: `jam-sql call ui_open_tab '{"type":"query","initialSql":"SELECT ..."}'`. **Always tell the user** that you opened the query in a tab because AI query execution is disabled, and that they can change this in Settings → AI Integrations → Permission Level.
- Attempt write queries (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, etc.) unless the user explicitly requests it and permission level is set to `confirm` — if permission is `read-only`, open the write query in a new tab instead and **tell the user** it was opened because write queries require the "Read + Write with approval" permission level, adjustable in Settings → AI Integrations.
- Attempt `EXEC`/`EXECUTE` or stored procedure calls, other than the read-only system procedures above, unless explicitly requested
- Put a statement that is not a read into a batch at `read-only` — `jam-sql query` runs several statements in one text and returns each result set, but only when EVERY statement is a read; one that is not (a write, `DO`, `VACUUM`, `ATTACH`, a PL/SQL block, a `SET` or `DECLARE` other than the ones above, …) refuses the whole text and the refusal names it (`Statement 2 of 3 (…)`). `jam-sql query` also takes session settings at `read-only` — `USE`, the other SQL Server `SET` options (not `ANSI_DEFAULTS` or `IMPLICIT_TRANSACTIONS`), `SELECT … INTO #temp` (a bare `#name`), PostgreSQL `SET search_path`, Oracle `ALTER SESSION SET NLS_*` — because its connection is reset after the call (not on SQLite, which runs every call on one shared connection); `ui_execute_query` and the notebook tools refuse them, and `SET ROWCOUNT` / `SET TRANSACTION ISOLATION LEVEL` are refused everywhere. A refusal ends with an `Instead:` line naming the rewrite (three-part names on SQL Server, database.table on MySQL, instead of `USE`, `TOP` instead of `SET ROWCOUNT`, `sp_helptext` to read a procedure instead of running it): apply it rather than guessing. The whole text is also checked, not just each statement's first word: SQL Server runs a statement that follows a `SELECT` without a `;`, so a write, `EXEC`, `INTO`, lock or sequence keyword (`NEXT VALUE FOR`, `nextval()`) anywhere outside strings and comments refuses the query. If the refusal names a word that is only a column or table name, quote it (`[update]`, `"update"`, or backticks on MySQL) and retry. At `confirm` a script with writes goes to the user's approval dialog as one request. `jam-sql call ui_execute_query` (the whole tab) and the notebook tools (each cell) are checked the same way; `query_execute_with_plan` takes one statement
- Run SQL against an Azure Storage connection (engine `azurestorage`) — there is none; use `jam-sql storage …`
- Ask for or expect database passwords/credentials (never exposed)

If the user needs write operations, instruct them to:
1. Open Jam SQL Studio → Settings → AI Integrations
2. Change "Permission Level" to "Read + Write with approval"
3. All write operations will require in-app confirmation

## Write Approval Flow (Confirm Mode)

When permission level is **Confirm**, write queries trigger an in-app approval dialog:

1. You submit a write query via `jam-sql query`
2. The user sees an approval dialog in the app with the SQL preview
3. User clicks **Approve** or **Deny** (60-second timeout, auto-denied)
4. The CLI returns the result

### Best Practice for Write Queries

```
# 1. Confirm user intent
User: "Delete all inactive users"

# 2. Preview the query
Agent: "I'll run: DELETE FROM users WHERE inactive = 1
This will trigger an approval dialog in Jam SQL Studio. Proceed?"

# 3. User confirms, then execute
jam-sql query "DELETE FROM users WHERE inactive = 1" -c <connection-id>

# 4. Report result
```

---

## Filtered Loose Foreign Keys

Loose FK declarations support optional **source** and **target** filters. A source filter gates when the FK activates — for example, `comments.commentable_id` resolves to `posts.id` only when `commentable_type = 'Post'`, and a separate declaration on the same column resolves to `photos.id` when `commentable_type = 'Photo'`. A target filter narrows valid rows in FK previews and row pickers — for example, adding `deleted_at IS NULL` makes the FK skip soft-deleted records. Multiple filtered loose FKs on the same source column appear as tabs in the FK popover. A peek pane in the editor shows a live row count and a 5-row sample from the target table so users can validate their filters before saving.

## Enum Columns

Any column can be declared as an enum so the Table Explorer filter chip swaps its free-text input for a values dropdown. Values are sourced in priority order from native enum types (MySQL `ENUM`/`SET`, Postgres `pg_enum`), then column-level `CHECK (col IN (...))` constraints, then a sampled `SELECT DISTINCT` capped at 200 distinct values and 100,000 scanned rows with a 5-second hard timeout (no UI hangs on huge tables). A column that is also a real or loose FK to a small reference table can instead use the `lookup` source: values still come from the source column, but each key is paired with a human-readable label fetched from the referenced table (bounded at 200 rows), using the table's shared display column — grids, filters, and cell editing show `key · label` while SQL, copy, and export keep using the raw key. A table can also be marked a **reference table** once (a per-table MetaInfo flag, not a per-column declaration): every column across the database that FKs to it then becomes an implicit lookup enum automatically, and an explicit per-column declaration always wins over the implicit behavior. A reference table can also be flagged **on demand** (the FK-cell popover's "Show names from …" button — it applies no row-count gate, though it's typically used once a table is past the cached path's 200-row cap): labels resolve per visible grid window and are never cached in MetaInfo, so those columns show names only — no values dropdown, no declaration. Three-state header glyphs: blue ▾ for declared columns (opens the values inspector), gray ▾ for native enum columns not yet declared, gray ▾? for short string or hinted int columns eligible for declaration. Declarations persist alongside loose FKs and JSON declarations in the per-database MetaInfo file, and round-trip via export / import (merge / replace).

## Spatial / Geometry Columns

Geometry & geography columns are decoded and mapped on PostgreSQL/PostGIS, MySQL, MSSQL, Oracle (`SDO_GEOMETRY`), and SQLite (SpatiaLite / GeoPackage); Kusto/ADX has no spatial types. Spatial cells show a `TYPE · N pts · SRID` summary plus a peek map; the Query Editor has a **Map** results tab and Table Explorer a **map pane** with two-way row↔feature selection and engine-correct bbox / distance / draw-an-area filter chips — the draw-an-area chip traces a polygon on the map to keep rows inside it (SQLite is bbox-only; distance and draw-an-area chips need a known SRID, MySQL/Oracle require 4326 or Web Mercator 3857, distance is not offered on 3857; spatial columns are detected in Table Explorer, not a bare Query Editor `SELECT`). A **Spatial Explorer** workspace stacks multiple query/table layers (per-layer colour, label column, feature cap). The OpenFreeMap basemap is **on by default** (opt-out in Settings → Spatial, first-use privacy notice; planar-graticule fallback with no network; SRID 3857 Web Mercator geometry is converted and drawn on the basemap). Curved geometry (CircularString / CompoundCurve / CurvePolygon) renders via client-side arc linearization while **Copy WKT stays curved** — a CircularString stays a CircularString, not the flattened display shape (MySQL has no curve types; SQL Server / Oracle support root-level curves, not curves nested in a collection). Copy WKT from any grid and CSV/XLSX export; Copy WKT / GeoJSON from the peek and expanded-cell popovers. A column with no native geometry type can be declared as a coordinate column (WKT / GeoJSON / lat-lng text / a lat+lng pair) via per-database MetaInfo so it maps too.

## MetaInfo — User-Declared Metadata

Successful MetaInfo edits, Blueprint imports, and MCP declarations automatically refresh the affected database's autocomplete hints and MetaInfo views after persistence. There is no need to reopen the editor or wait for a cache timeout.

`schema_list_tables` and `schema_get_columns` include a compact `metaInfo` counts object on tables that have user-declared MetaInfo (`{ looseFks, jsonCols, enumCols, displayCol, refTable? }`); `refTable` is `'cached' | 'on-demand'` when the table itself is marked a reference table, and counts into the object even when every other count is zero; `enumCols` counts exactly what `schema_get_metainfo` will return under `enumCols` — implicit lookup columns included — so a table that declares nothing but has decodable pairs is still worth a call. The key is omitted entirely when a table has none, so agents can cheaply scan a large schema. `schema_get_metainfo` (args: `connectionId`, `database` [optional — uses the connection's default; errors if neither resolves], `schema`, `table`, optional `kinds` ∈ `loose_fk|json|enum|display_column`, optional `fullValues` default `false` — enum values / JSON paths capped at 50; `true` → up to 200 / all paths) returns the full per-table detail; a `lookup`-source enum column also carries aligned `labels` alongside its `values`, plus the referenced table (`toSchema`/`toTable`/`toColumn`, with a `labelColumn` when the target has a declared display column), both capped/lifted together with `values`. It also reports `referenceTable: { mode: 'cached' | 'on-demand' }` when the queried table itself is marked a reference table — every column elsewhere in the schema that FKs to it is an implicit lookup enum. Once the app has actually fetched such a column's pairs they show up back on the REFERENCING table's own `enumCols`, flagged `implicit: true` and with no declaration behind them — this is opportunistic, so absence never proves the column isn't a lookup, only that nobody's queried it in the UI yet. Those implicit entries only appear while the target is still flagged `'cached'` and the cached row carries both values and labels: a flag that was removed or flipped to on-demand leaves a snapshot nothing will refresh, so it stops being reported. `mode: 'on-demand'` means those pairs are NEVER cached anywhere, so `schema_get_metainfo` never returns them for that target no matter how many times the UI has shown names — it is the always-safe default, chosen by entry point, and implies nothing about the target's size. Call `schema_get_metainfo` for any table whose `metaInfo` counts are non-zero before generating SQL that depends on its declared relationships, JSON paths, or enum values.

```bash
jam-sql call schema_get_metainfo connectionId=abc-123 database=MyDB schema=dbo table=Orders
```

## Find References / Rename (identifier index)

Find References and Rename read an identifier index the app builds from the stored definitions of views, functions, procedures, triggers and constraints. On SQL Server and PostgreSQL it is built per connection **and** database: the configured database is indexed after connect, and any other database is indexed on demand the first time it is searched (the References tab shows a searching state meanwhile). On MySQL, Oracle and SQLite one index covers the whole connection, because their catalog listings already span every schema the login can see (and a SQLite connection is one file). Two surfaces: **Peek References** (Shift+F12 / right-click in the Query Editor) lists the stored objects that reference the identifier **plus** the occurrences in the active query tab; the **References tab** (Find All References in Tab, the Object Explorer's **Find references…**) lists stored objects only. Scope: on SQL Server and PostgreSQL the database that was searched, never other databases; on MySQL and Oracle the index spans every schema the login can see, so hits from other schemas are listed too. The current statement of what the index covers lives in the `app_capabilities` knowledge resource.

## Beta Features (a feature may be switched off)

**Settings → Beta Features** is a checkbox per still-moving feature, and a feature that is off has no toolbar button, menu item, shortcut, command-palette entry, or Object Explorer node. One ships **off**: **Dashboards**. Seven ship **on** and can be unticked: the **Visual Query Editor** (on by default since 1.5.3, still Beta), **Database Blueprint**, **Cross-Engine Migration**, **Data Import**, the **PL/SQL Debugger**, **Agent Jobs**, and **Package Explorer**. When a UI-driving call can't find a surface one of these owns, name the checkbox the user has to tick rather than reporting a bare failure. Nothing is deleted when a feature is off — saved dashboards and blueprint folders stay on disk and open tabs keep working.

## Dashboards

Dashboard previews and untrusted refreshes check known writes and side-effecting calls under MySQL's default, `NO_BACKSLASH_ESCAPES`, and `ANSI_QUOTES` interpretations without changing the session. Cancelling a tile while its saved settings are loading prevents database dispatch. This policy cannot infer arbitrary user-defined function side effects.

Multi-tile dashboards (chart / stat / table / pivot / map / note tiles) over saved connections. Map tiles plot a query's geometry/geography column on the shared spatial map (auto-detected; optional `geometryColumn`/`colorByColumn`). Five app tools manage them; every mutation live-updates any open app window.

- `dashboard_list` — dashboards with tiles (ids, titles, tile types), revision, updatedAt.
- `dashboard_create name=<name>` — new empty dashboard; the free plan cap (2) returns a structured `free-limit` error.
- `dashboard_add_tile dashboardId=<id> tile=<json>` — full tile JSON (`sql` is shorthand for `source:{"kind":"sql","sql":...}`; id/layout/refresh generated when omitted), or `templateId=<catalog id> connectionId=<id>` to add from the built-in per-engine DBA template catalog (optional `overrides=<json>` shallow-merges onto the materialized tile). Templates defaulting to chart/pivot are added as table tiles unless overrides supply the chart/pivot config.
- `dashboard_update_tile dashboardId=<id> tileId=<id> patch=<json>` — shallow-merge a patch onto one tile.
- `dashboard_refresh dashboardId=<id>` — re-runs every query tile in the app UI under the unattended (interval) execution policy: read-classified tiles refresh; a write-classified tile is skipped unless the user granted it scheduled-refresh trust (no destructive query is ever auto-confirmed). Reports per-tile `{tileId, ok, error?}`. The dashboard must be open in the app; tiles not loaded report `ok:false`.

```bash
jam-sql call dashboard_list
jam-sql call dashboard_create name="Ops Overview"
jam-sql call dashboard_add_tile dashboardId=abc tile='{"tileType":"table","title":"Slow queries","connectionId":"conn-1","sql":"SELECT * FROM slow_queries"}'
jam-sql call dashboard_add_tile dashboardId=abc templateId=mssql.sessions.longest_running connectionId=conn-1
jam-sql call dashboard_refresh dashboardId=abc
```
**Decorating FK-encoded values with names.** Two strategies: *decorate* — read `values`/`labels` straight off a cached `enumCols` entry (cheap, but only there once the app has fetched it, and capped at 50 unless `fullValues: true`); *join* — write the SQL yourself against the referenced table (always accurate, never capped, and the only option when the target is `on-demand`, since nothing is ever cached for it). If no `labelColumn` is given for a join, look at the target's own columns in this order: `name`, `display_name`, `full_name`, `title`, `label`, `description`, `code`, `slug`, `email`, `username`.

**Filtering by a name the user typed.** Match their words against `labels` (case-insensitive), then filter on the paired `values[i]` — SQL runs against the raw key, never the label. Emit a numeric key unquoted (check the column's `dataType` from `schema_get_columns` first); quote everything else. If `truncated: true`, the label you want may be past the cap — re-fetch with `fullValues: true` before concluding it doesn't exist.

**Finding an implicit lookup enum on a column with no declaration.** Resolve the column's FK target via `schema_get_constraints` or the table's own `looseFks`, call `schema_get_metainfo` on the TARGET table, and check `referenceTable`. `'cached'` — look for the column back on the referencing table's `enumCols` (flagged `implicit: true` once fetched). `'on-demand'` — nothing is ever stored; a join is the only way to get names.

**Never invent metadata.** Only report a display column, a lookup target, or a decoded label that a tool call actually returned — never guess one from a column's name or a `key = 1` pattern you recognize.

**Declaring one yourself.** When something turns out to be worth persisting — a small FK target you keep resolving by hand, a categorical column the user keeps filtering by name, a text column you keep parsing as JSON — `metainfo_declare` saves it: `kind` is `enum`, `json`, `loose_fk` or `reference_table`, one declaration per call, and at most one suggestion per answer. Say what it will do and let the user decide. At the default *Confirm each* setting they see an approval dialog naming exactly what you proposed; at *Allow* the declaration saves with no prompt at all, so say what you are about to do either way. The saved entry is badged *AI-created* in the MetaInfo manager (or *AI-updated* when it lands on an entry that already existed) — editing or re-saving it themselves clears the badge, removing it withdraws the declaration. Nothing in the database changes. `kind: "json"` marks a column as JSON so the JSON filter operator, the path picker, the cell peek popover and JSON-path loose-FK targets all work on it; it saves the declaration ONLY, not the column's observed path structure — that accrues as the user browses rows, or when they scan the column in the MetaInfo manager — so propose it only for a column you have actually SEEN JSON in, never from its name. Names are checked against live metadata before anyone is asked; anything that reads DATA (an enum's sampled values, a cached reference table's key/label pairs) runs only after approval, so a denied proposal costs zero queries — and a refusal at that later stage means the approval was spent and nothing was saved, which is worth saying rather than re-proposing. Refusals come back as a `{code, message}` worth relaying verbatim: a column past 200 distinct values isn't categorical; a source column that already carries a loose FK has to be changed in the app; a reference table too big to cache should be proposed as `mode: "on-demand"` instead; a column whose type can't hold JSON can't be declared as one, nor can a column already declared as JSON (a JSON declaration has nothing else to set), nor a TEXT column on PostgreSQL below 16, whose filters need the `IS JSON` predicate. If it comes back `not_allowed`, the setting is Settings → AI Integrations → Allow AI to declare MetaInfo; `connection_blocked` is the connection's own AI permission level, which gates this tool too because it reads from the connection to validate. Naming the click path still works too: the FK-cell popover's *"Show names from `schema.table`"* button, or the enum declare dialog's *"Mark `schema.table` as a reference table — every column referencing it shows names"* checkbox.

**Offering to have the setting turned on.** The tool is Deny by default, so most sessions never get to use it. If you catch yourself doing the same metadata work by hand more than once in a session — re-writing the same join for a relationship the schema doesn't declare, decoding the same status codes, parsing the same text column as JSON — and `metainfo_declare` is unavailable or comes back `not_allowed`, tell the user ONCE: name the setting (Settings → AI Integrations → Allow AI to declare MetaInfo), name the exact declaration you would have saved, and say what it would save them next time. Once per session, not once per answer, and drop it if they say no.

## Documentation

For detailed guides on how to use Jam SQL Studio features (query editor, table explorer, schema compare, data compare, charts, sessions, keyboard shortcuts, etc.), visit **https://jamsql.com/docs/**. When the user asks how to do something in the app, look up the relevant docs page to provide accurate instructions.

---

## Knowledge Pack

Jam SQL Studio exposes knowledge resources describing its current state and capabilities. Read these for product-usage questions:

```bash
jam-sql read sql-studio://knowledge/app_capabilities   # Workflows, limitations, tools
jam-sql read sql-studio://knowledge/app_user_guide      # "How to..." guide
jam-sql read sql-studio://knowledge/app_manifest        # App version, platform, settings
```

If working in an AI Workspace directory, the same knowledge is in `.knowledge/` files.

Database pickers are a desktop UI workflow too. They all read one shared per-connection database list, and when that listing fails they offer the connection's configured / previously-opened databases marked as unverified rather than the engine's system-database names — so never report an unverified entry as a database that exists. The knowledge-pack user guide has the details, including why Data Import's Target step differs.

Query Store is a desktop UI workflow (no Query Store MCP tool). Its A/B plan pickers include all plans used in each period, even when the displayed plan list is limited to 50; use the knowledge-pack user guide for instructions.

---

## Troubleshooting

### "Connection refused" or CLI can't reach the app
- Ensure Jam SQL Studio is running (`jam-sql launch` to start it)
- Check `jam-sql status` — the app's server may be disabled
- Enable it: Settings → AI Integrations → "Enable MCP server"

### "Not paired" or "Unauthorized"
- Run `jam-sql pair` to re-pair with the app

### `jam-sql status` says "App running: No" but the app is running
- The pairing / discovery state is out of sync with reality (possible after
  an app upgrade, crash, or force-quit).
- Refresh it with: `jam-sql unpair && jam-sql pair`
- The same command also fixes a stale `Paired: (vX.Y.Z)` line after an
  app upgrade — re-pairing rewrites the credentials file with the current
  app version.

### "Query blocked"
- Permission level is set to `block` — no query execution allowed
- **Alternative:** Open the query in a new tab for the user to review and run manually: `jam-sql call ui_open_tab '{"type":"query","title":"Suggested Query","initialSql":"YOUR SQL HERE"}'`
- **Always inform the user** that you opened the query in a tab because AI execution is currently disabled, and that they can enable it in Settings → AI Integrations → Permission Level

### "Connection not found"
- Use `jam-sql connections` to get valid connection IDs first

### "Query timed out after N seconds"
- The query ran past the user's limit for agent queries; `--timeout` can only lower it
- Make it cheaper (a row limit in the engine's syntax, filters on indexed columns) instead of running it again unchanged
- Or open it in a query tab for the user: `jam-sql call ui_open_tab type=query initialSql="…"` — query tabs are not bound by the agent limit
- If the error says Jam has no confirmation that the query stopped, it may still be running; check a write's effect before running it again

### "Connection '<name>' is unreachable" / "Connection '<name>' cannot connect"
- The connection failed to connect moments ago, so Jam answers at once for about a minute without dialling it
- Do not retry. Tell the user what the error names (server not running, VPN, host name, firewall, login or Microsoft Entra sign-in, encryption settings); once they fixed it, they reconnect in Jam or you call `connections_connect`

### "The user declined connecting to …"
- The user answered "Don't allow" in Jam's connect dialog. Do not call `connections_connect` for that connection again; ask the user to connect in Jam if you need it

### "… reconnecting it now would end work that is open on it"
- Jam cannot use the connection until it is reconnected, and the user has an open transaction, a notebook session or a running query on it (a dashboard tile that is refreshing counts as a running query), so Jam did not reconnect it. Ask the user to finish what the error names and reconnect; call `connections_connect` again only once they have

### "Could not request approval: the prompt was not shown"
- The PL/SQL debugger and compile tools ask in a card in the AI Chat panel of the tab the user has on screen; when you pass tabId, only in that tab. A tabId containing "::pkg::" is a package open in Package Explorer: its card appears in the AI Chat of that Package Explorer tab, and only while that package is the one selected. AI Chat was closed in that tab, the user was on another tab, or Package Explorer was showing another package. This is not the user saying no: ask them to open AI Chat in that tab and stay on it, then try again. "Nobody answered the approval prompt … within 60 seconds" means the card was shown and left unanswered, which counts as declined

### "AI connection control is disabled"
- Settings → AI Integrations → "Allow AI to connect using saved connections" is set to Deny. The user can set it to Confirm each or Allow, or connect in Jam themselves

### "… was set to "Deny" while Jam waited for the user's answer"
- The user set "Allow AI to connect using saved connections" to Deny while Jam's connect dialog was open, so Jam did not connect. Tell the user the setting changed; do not retry

---

## Installation

### Via the CLI (Recommended)

```bash
jam-sql add-skill
```

Auto-detects installed AI agents and installs the skill for each.

### Via Package Managers

```bash
npx add-skill jamsql/jam-sql-studio
npx ai-agent-skills install jamsql/jam-sql-studio
```

### Manual

Copy this file to your agent's skills directory:

```bash
# Claude Code
mkdir -p .claude/skills/jam-sql && cp SKILL.md .claude/skills/jam-sql/SKILL.md

# Cursor / Codex / Copilot / Cline / Warp
mkdir -p .agents/skills/jam-sql && cp SKILL.md .agents/skills/jam-sql/SKILL.md
```

### Claude Desktop and other stdio MCP clients

Clients that only start local stdio MCP servers (Claude Desktop, or any client configured with a command) connect to the app's MCP server through the `@jamsql/mcp` npm package (Node.js 18+). After `jam-sql pair`, add this to `claude_desktop_config.json` and restart the client:

```json
{ "mcpServers": { "jam-sql": { "command": "npx", "args": ["-y", "@jamsql/mcp"] } } }
```

It finds the running app and the paired token on its own (`JAMSQL_MCP_URL` / `JAMSQL_MCP_TOKEN` override them) and reconnects when the app restarts. Its errors say what is missing: the app, the MCP server setting, or pairing. Setup and troubleshooting: https://jamsql.com/docs/ai-integrations-mcp/#stdio-bridge
