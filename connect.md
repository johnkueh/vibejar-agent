# Connect a coding agent to Vibejar

Vibejar (https://vibejar.com) is the screenshot tool that fixes bugs: capture a
bug on your phone, circle it, and your coding agent picks it up, ships the fix,
and reports back with proof.

This page is written for coding agents and the people setting them up.

## First: check this surface

Vibejar needs an agent that can access the project files, run shell commands,
edit code, and open a pull request.

- **Continue here:** Claude Cowork, Claude Code, Codex desktop/CLI, Grok Build,
  Cursor, or another coding agent with repository and shell access.
- **Switch surfaces:** a normal Claude or ChatGPT chat cannot inspect the
  repository or ship a fix. Open the same prompt in Claude Cowork, ChatGPT
  Codex, or Codex desktop instead.

If you cannot access files and a shell, tell the user that plainly. Do not try
to pair Vibejar from a chat-only surface.

## Recommended: install the plugin

The plugin keeps the Vibejar skill available in future sessions. It contains no
MCP server and adds no second authentication system.

### Claude Cowork

1. Open **Customize → Plugins**.
2. Choose **Add → Add marketplace → Add from a repository**.
3. Select or paste `johnkueh/vibejar-agent`, then choose **Sync**.
4. Install **Vibejar** from that marketplace.
5. Start a new Cowork session and paste the pairing prompt again.

### Codex desktop

Run:

```sh
codex plugin marketplace add johnkueh/vibejar-agent
codex plugin add vibejar-agent@vibejar
```

Then start a new task.

## One-time setup (~30 seconds)

If the Vibejar Claude plugin is active and the CLI is missing, install from the
plugin files the user already approved:

```sh
VIBEJAR_SOURCE_DIR="${CLAUDE_PLUGIN_ROOT}" \
  bash "${CLAUDE_PLUGIN_ROOT}/install.sh"
```

Otherwise, download the installer, read it, then run the reviewed local file:

```sh
installer="$(mktemp)"
curl -fsSL https://vibejar.com/install.sh -o "$installer"
cat "$installer"
```

Read the complete file. It should install only the Vibejar CLI, its two pinned
dependencies, the Vibejar skill, and skill-directory links. Then run:

```sh
bash "$installer"
rm "$installer"
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

### Pair with the phone app

The app shows a pairing token. Pass **this agent’s name** so the phone lists
who is connected:

```sh
bun ~/.vibejar/cli.ts pair <token> --name "Claude Cowork"
# Use the actual surface name: "Claude Code", "Codex", "Grok Build", etc.
```

### Jar link only

If you received `https://vibejar.com/j/<slug>`: no pair needed.
`fork` mints an identity automatically.

## Updates

Do not update on every session. The plugin host updates the skill. The CLI
reports when a newer version is available; update then:

```sh
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

1. **`whoami`** — install or pair only when needed.
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
| **Claude Cowork** | Vibejar marketplace plugin from `johnkueh/vibejar-agent` |
| **Claude Code** | `~/.claude/skills/vibejar` (symlink) + description auto-trigger |
| **Grok Build** | `~/.grok/skills/vibejar` (symlink) |
| **Codex desktop / CLI** | Vibejar marketplace plugin, `~/.agents/skills/vibejar`, or `~/.codex/skills/vibejar` |
| **Cursor** | `~/.cursor/skills/vibejar` when present; also `.agents/skills` |
| **Any Agent Skills client** | Canonical path `~/.agents/skills/vibejar/SKILL.md` |
| **Claude Chat / ChatGPT Chat** | Chat only; switch to Cowork or Codex to edit and ship code |

Skill format follows the open **Agent Skills** spec (`name` + `description`
frontmatter, progressive load). Trigger phrases live in the skill description
so agents auto-invoke on “vibejar bugs / fix the captures / list the jar”.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Cowork doesn’t know Vibejar | Sync `johnkueh/vibejar-agent`, install Vibejar, then start a new Cowork session |
| Agent doesn’t know Vibejar | Re-run install; **restart the agent session** so skill lists reload |
| Stale commands | `bun ~/.vibejar/cli.ts self-update` |
| Empty jars after pair | Confirm token; pass `--name` for this agent |
| No bun | install.sh installs bun; or https://bun.sh |
| `drain is removed` | Use `list` then `claim <id>` |

## Humans: short version

Install the plugin for Cowork or Codex, start a new coding session, then paste
the prompt copied by the Vibejar app. The agent handles the local CLI and
pairing.
