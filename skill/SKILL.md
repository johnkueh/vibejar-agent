---
name: vibejar
description: >
  List and fix bugs queued in Vibejar (screenshot bug queue from phone/web).
  Use when the user says "vibejar", "check the jar", "list the inbox", "fix
  the captures", "vibejar bugs", "work the jar", pastes a vibejar.com/j/…
  link, or wants the agent to pick open captures and ship a PR with proof.
  Invokes the Vibejar CLI (`bun ~/.vibejar/cli.ts`).
license: MIT
compatibility: >
  Requires bun and network access. CLI at ~/.vibejar/cli.ts (install via
  https://vibejar.com/install.sh). Works with Claude Code, Grok Build, Codex,
  Cursor, and any agent that loads Agent Skills (agentskills.io).
metadata:
  author: vibejar
  homepage: https://vibejar.com
  version: "1.3.0"
  source: https://github.com/johnkueh/vibejar-agent
  install: https://vibejar.com/install.sh
---

# Vibejar — agent bug queue

Vibejar is the screenshot tool that queues bugs for coding agents. Testers
capture on phone/web, annotate, send to a jar. **You** list open work, claim
one task at a time, fix from the shot + note, open a PR, mark status.

**Do not invent the protocol.** The stable contract is
https://vibejar.com/contract.md. The CLI is the only transport.

## Before first use in a session (auto-update)

Run once per session (or when the CLI is missing / outdated):

```sh
bun ~/.vibejar/cli.ts self-update 2>/dev/null \
  || curl -fsSL https://vibejar.com/install.sh | bash
```

`self-update` refreshes both the CLI and this skill from vibejar.com. Safe to
re-run; idempotent.

If `whoami` fails after update, the machine is not paired — see Setup below.

## CLI entrypoint

Always:

```sh
bun ~/.vibejar/cli.ts <command>
```

Never assume a global `vibejar` binary unless the user installed one.

## Setup (only if self-update / whoami fails)

```sh
curl -fsSL https://vibejar.com/install.sh | bash
bun ~/.vibejar/cli.ts whoami
```

**Pair with the phone app** (shares the phone's jars):

```sh
bun ~/.vibejar/cli.ts pair <token> --name "Grok Build"   # or "Claude Code" / "Codex"
```

**Jar link only** (`vibejar.com/j/...`): no pair needed — `fork` mints identity.

## Commands (contract)

| Command | Output |
|---|---|
| `whoami` | `{ "id", "email" }` |
| `jars` | lines: `<slug>  <open> open / <total> total` |
| `fork <slug-or-url>` | new slug in this account (never mutates the sender) |
| `list [jar-slug] [--state …\|--all]` | **read-only** JSON array of captures (default: `todo`). Aliases: `ls`, `todo` |
| `claim <id>` | claim **one** capture by id → `{ id, note, shot, jar }` |
| `status <id> <state> [--pr <url>]` | states below (`todo` releases a claim) |
| `watch [jar-slug]` | streams `new capture: <id>  <note>` |
| `self-update` | refresh CLI + skill from vibejar.com |

There is **no `drain`**. Always list, then claim the id you are about to fix.

### States

`todo → claimed → fixing → review → done` (or `failed`).

- `list` never changes state
- `claim` moves one capture to `claimed`
- set `fixing` while working if the run is long
- `review --pr <url>` when a PR exists
- `done` only after the human approves the PR
- `failed` when a human must look
- **Wrong claim:** `status <id> todo` immediately

## Default workflow (always this)

1. **`self-update`** (or install) once this session.
2. **`jars`** — see open counts; pick the jar for this repo (or inbox if asked).
3. **`list [jar]`** — read notes; decide which captures you will fix **in this session**.
4. For **one** capture at a time:
   - **`claim <id>`** for the task you are starting now (not a batch of claims up front).
   - **Read the image** at `shot` (annotated screenshot is ground truth). Note is context.
   - Reproduce → fix **in the correct repo** → open **one PR**.
   - **`status <id> review --pr <pr-url>`** with before/after proof when visual.
5. Tell the user the PR URL; they mark `done` (or you do after explicit approval).
6. Repeat `claim` for the next chosen id from the same list, or re-`list` if the queue may have changed.
7. Captures you do not want: leave them `todo`. Never claim them "for later."

### Filtering by project

Inbox jars mix products. From `list` output, keep only rows that match the
current repo / user target (note text, jar slug, screenshot context). Claim
those only.

## Rules

1. **List first. Claim second.** Never claim without having listed (or the user pasting a specific id).
2. **Claim only what you are working on now** — one at a time.
3. **Image first.** Circle/arrow marks what the tester meant.
4. Separate **bugs** from praise/suggestions — fix bugs; mention the rest in summary.
5. **One PR per fix.** Do not batch unrelated captures into one PR.
6. **`claim` is atomic** — safe across parallel agent sessions for that id.
7. Never edit the sender's jar; **`fork`** first when given a shared link.
8. Do not claim `done` without human approval of the PR.
9. Mistaken claim → **`status <id> todo`** before ending the session.

## Project ↔ jar mapping

Jars are projects (e.g. `glp3`, `journeys`, `inbox-…`). Prefer the jar that
matches the current repo. If unclear, `jars` + ask, or `list` the inbox and
filter without claiming unrelated rows.

## Nightly / autonomous loops

Vibejar is the **queue**, never the runner. Your scheduler owns the loop:

```sh
# example: list once, then claim+hand-off each matching id
ids=$(bun ~/.vibejar/cli.ts list my-app-jar | …)  # parse JSON, filter
for id in $ids; do
  bun ~/.vibejar/cli.ts claim "$id"
  # hand claim JSON to a coding agent session for this repo
done
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `command not found: bun` | Install bun: https://bun.sh |
| CLI missing | `curl -fsSL https://vibejar.com/install.sh \| bash` |
| empty jars after pair | Confirm pair token; pass `--name` of this agent |
| skill not auto-invoking | Ensure install ran (skill lives under `~/.agents/skills/vibejar/`) |
| stale protocol | `bun ~/.vibejar/cli.ts self-update` |
| stuck in claimed | `status <id> todo` to release |
| `drain is removed` | Use `list` then `claim <id>` |
