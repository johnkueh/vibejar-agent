# Connect your coding agent to Vibejar

Vibejar (https://vibejar.com) is the screenshot tool that fixes bugs: capture a
bug on your phone, circle it, and your coding agent picks it up, ships the fix,
and reports back with proof.

This page is written for **agents** (Claude Code, Grok Build, Codex, Cursor,
and any tool that loads [Agent Skills](https://agentskills.io)). Humans can
paste the one-liner too.

## One-time setup (~30 seconds)

Install **both** the CLI and the agent skill (idempotent):

```sh
curl -fsSL https://vibejar.com/install.sh | bash
```

What that does:

| Installs | Path | Why |
|---|---|---|
| CLI | `~/.vibejar/cli.ts` | Stable transport (`list`, `claim`, `status`, …) |
| Skill (canonical) | `~/.agents/skills/vibejar/SKILL.md` | [Agent Skills](https://agentskills.io) standard — Codex, multi-agent |
| Symlinks | `~/.claude/skills/vibejar`, `~/.grok/skills/vibejar`, `~/.codex/skills/vibejar`, `~/.cursor/skills/vibejar` | Claude Code / Grok / Codex / Cursor discover paths |

Requires [bun](https://bun.sh) (the installer installs it if missing).

Verify:

```sh
bun ~/.vibejar/cli.ts whoami
# skill should appear in agent skill lists after a session restart
```

### Pair with the phone app (optional)

The app shows a pairing token. Pass **this agent’s name** so the phone lists
who is connected:

```sh
bun ~/.vibejar/cli.ts pair <token> --name "Claude Code"   # or "Grok Build" / "Codex"
```

### Jar link only

If you received `https://vibejar.com/j/<slug>`: no pair needed.
`fork` mints an identity automatically.

## Auto-update (keep forever)

**Agents:** at the start of any Vibejar task, run:

```sh
bun ~/.vibejar/cli.ts self-update
```

That re-pulls `cli.ts` + `skill/SKILL.md` from vibejar.com and refreshes
symlinks. Safe every session.

**Humans / cron:**

```sh
curl -fsSL https://vibejar.com/install.sh | bash -s -- --update
# or
bun ~/.vibejar/cli.ts self-update
```

There is no separate package manager step. Source of truth is always:

- CLI: `https://vibejar.com/cli.ts`
- Skill: `https://vibejar.com/skill/SKILL.md`
- Contract: `https://vibejar.com/contract.md`

## Working a jar

```sh
bun ~/.vibejar/cli.ts jars                      # queue counts
bun ~/.vibejar/cli.ts list [jar-slug]           # read-only open captures (no claim)
bun ~/.vibejar/cli.ts claim <capture-id>        # claim the one you are fixing now → JSON + shot path
# …read the annotated shot, fix in the repo, open a PR…
bun ~/.vibejar/cli.ts status <id> review --pr <pr-url>
bun ~/.vibejar/cli.ts status <id> done          # after the human approves
bun ~/.vibejar/cli.ts status <id> todo          # release a mistaken claim
bun ~/.vibejar/cli.ts watch [jar-slug]          # stream new captures
```

### Protocol (agents)

1. **Self-update** once per session.
2. **`list`** — triage open captures (notes). Pick what matches this session’s project/repo.
3. **`claim <id>`** for the single task you are starting now. Leave the rest `todo`.
4. The annotated screenshot is ground truth — circle/arrow marks intent; note is context. **Read the image.**
5. Separate real bugs from praise/suggestions; fix bugs; mention the rest.
6. One PR per capture, with before/after proof when visual.
7. Wrong claim → `status <id> todo` immediately.
8. Do not mark `done` until the human approves the PR.

There is no `drain`. One path only: list → claim → fix → status.

### States

`todo → claimed → fixing → review → done` (or `failed` when a human must look).
`review` means a PR exists; `done` is the human’s call after approving.

## Per-project queues and nightly runs

Jars map to projects (glp3, journeys, inbox-…). Prefer a project jar when
possible. For mixed **inbox**, filter `list` by note/project, then `claim`
matching ids only. For overnight loops, **your** scheduler runs; Vibejar is the
queue, never the runner:

```sh
# list, pick ids, claim one-by-one into agent sessions
bun ~/.vibejar/cli.ts list my-app-jar
bun ~/.vibejar/cli.ts claim <id>
```

## Agent matrix (2026)

| Host | How it finds the skill |
|---|---|
| **Claude Code** | `~/.claude/skills/vibejar` (symlink) + description auto-trigger |
| **Grok Build** | `~/.grok/skills/vibejar` (symlink) |
| **OpenAI Codex** | `~/.agents/skills/vibejar` or `~/.codex/skills/vibejar` |
| **Cursor** | `~/.cursor/skills/vibejar` when present; also `.agents/skills` |
| **Any Agent Skills client** | Canonical path `~/.agents/skills/vibejar/SKILL.md` |

Skill format follows the open **Agent Skills** spec (`name` + `description`
frontmatter, progressive load). Trigger phrases live in the skill description
so agents auto-invoke on “vibejar bugs / fix the captures / list the jar”.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Agent doesn’t know vibejar | Re-run install; **restart the agent session** so skill lists reload |
| Stale commands | `bun ~/.vibejar/cli.ts self-update` |
| Empty jars after pair | Confirm token; pass `--name` for this agent |
| No bun | install.sh installs bun; or https://bun.sh |
| `drain is removed` | Use `list` then `claim <id>` |

## Humans: short version

```sh
curl -fsSL https://vibejar.com/install.sh | bash
bun ~/.vibejar/cli.ts pair <token-from-app> --name "My laptop"
# tell your agent: "list the vibejar inbox, claim only the glp3 ones, fix those"
```
