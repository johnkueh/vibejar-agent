# Vibejar CLI contract

The stable interface is exactly this — commands, their JSON output shapes, and
the jar page formats. Everything else (the backend vendor, wire protocol,
storage) is an implementation detail and may change between CLI versions.

## Commands

- `pair <token> [--name <agent>]` → `paired as <identity>`
- `whoami` → `{ "id", "email" }`
- `jars` → one line per jar: `<slug>  <open> open / <total> total`
- `fork <slug-or-url>` → copies a shared jar into your account; prints the new
  slug. Forking with no identity mints one (the fork is the signup).
- `list [jar-slug] [--state todo|claimed|fixing|review|done|failed] [--all]`
  → **read-only** JSON array of captures (default state: `todo`). Does **not**
  claim. Fields: `{ "id", "note", "state", "jar", "createdAt" }`. Aliases:
  `ls`, `todo`.
- `claim <capture-id>` → claims that one open capture; prints
  `{ "id", "note", "shot": "<local png path>", "jar" }`. Fails if not `todo`.
- `status <id> <state> [--pr <url>]` — states:
  `todo | claimed | fixing | review | done | failed`
  (set `todo` to release a mistaken claim)
- `watch [jar-slug]` → streams `new capture: <id>  <note>` lines
- `self-update` → re-downloads CLI + agent skill from vibejar.com (idempotent)

`drain` is **removed**. Agents must `list` then `claim <id>`. Calling `drain`
exits non-zero with a pointer to that flow.

## Jar surfaces

- Human page: `https://vibejar.com/j/<slug>`
- Agent face: `https://vibejar.com/j/<slug>/md` — markdown with a protocol
  header and per-entry `note / state / screenshot` fields.

## Backend discovery

Clients resolve the live backend from
`https://vibejar.com/.well-known/vibejar.json` (24h cache, env override
`VIBEJAR_APP_ID`, baked fallback). Do not hardcode backend details beyond that
file's contract: `{ schema, backend, appId }`.
