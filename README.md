# Vibejar agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Homepage](https://img.shields.io/badge/app-vibejar.com-111)](https://vibejar.com)

Screenshot a bug on your phone. Your coding agent picks it up, ships the fix, and sends back proof.

**Vibejar is a paid app — $88, once, yours forever.** The agent side is open source: the CLI, the skill, and the protocol your agent uses to claim and fix bugs are MIT, in this repo. Same deal as Sublime Text and Alfred — you buy the tool, the ecosystem around it stays open. No subscription, no seats, no open-core upsell. The app captures the bug; everything your agent touches is code you can read.

- **App (paid):** [vibejar.com](https://vibejar.com) — iPhone capture + annotate + jar queue  
- **Agent (this repo, free MIT):** CLI + [Agent Skill](https://agentskills.io) + protocol  

Works with Claude Code, Codex, Cursor, Grok Build, and any tool that loads Agent Skills.

## Install (agents + humans)

One shot (recommended — always pulls the live bits from vibejar.com):

```sh
curl -fsSL https://vibejar.com/install.sh | bash
```

That installs:

| What | Path |
|------|------|
| CLI | `~/.vibejar/cli.ts` |
| Skill (canonical) | `~/.agents/skills/vibejar/SKILL.md` |
| Symlinks | Claude / Grok / Codex / Cursor skill dirs when present |

Requires [bun](https://bun.sh) (installer adds it if missing).

Verify:

```sh
bun ~/.vibejar/cli.ts whoami
```

Update any time:

```sh
bun ~/.vibejar/cli.ts self-update
# or
curl -fsSL https://vibejar.com/install.sh | bash -s -- --update
```

### From this repo (optional)

```sh
git clone https://github.com/johnkueh/vibejar-agent.git
cd vibejar-agent
# install script still prefers production CDN; override for local testing:
VIBEJAR_BASE_URL=https://vibejar.com ./install.sh
```

Production install always uses `https://vibejar.com` so self-update stays simple. This GitHub repo is the **open, reviewable source** of the agent surface.

## Pair with the phone app

In the app, open pair mode and run:

```sh
bun ~/.vibejar/cli.ts pair <token> --name "Claude Code"
```

Or use a shared jar link (`https://vibejar.com/j/<slug>`) — `fork` mints an identity.

## How agents work a jar

```sh
bun ~/.vibejar/cli.ts self-update   # once per session
bun ~/.vibejar/cli.ts jars
bun ~/.vibejar/cli.ts list [jar]
bun ~/.vibejar/cli.ts claim <id>    # one capture → note + local screenshot path
# fix in the right repo, open one PR
bun ~/.vibejar/cli.ts status <id> review --pr <url>
```

Stable contract: [`contract.md`](./contract.md) · Human connect page: [vibejar.com/connect.md](https://vibejar.com/connect.md)

## What's open vs closed

| Open (MIT, this repo) | Closed |
|----------------------|--------|
| CLI (`cli.ts`) | iOS/Android capture app |
| Agent skill (`skill/SKILL.md`) | Landing site (`web/`) |
| Protocol (`contract.md`) | Jar backend / cloud |
| Installer (`install.sh`) | App Store / RevenueCat billing |

## Repo layout

```
cli.ts          # agent CLI (also served at vibejar.com/cli.ts)
install.sh      # one-shot installer
skill/SKILL.md  # Agent Skills package
contract.md     # stable CLI + jar contract
connect.md      # human/agent setup doc
examples/       # sample workflows
```

## Pricing

**$88 one-time** for the capture app. Forever unlock. No subscription.

The agent integration stays free so every coding agent can work jars without friction.

## Contributing

PRs welcome on the **agent surface** only (CLI, skill, protocol docs, examples). Keep the contract stable — see `contract.md`. App and backend live in a private monorepo.

## Links

- App & marketing: https://vibejar.com  
- Connect (for agents): https://vibejar.com/connect.md  
- Best Claude Code plugins (roundup): https://vibejar.com/best/claude-code-plugins  
- Vibe debugging guide: https://vibejar.com/guides/vibe-debugging  

## License

[MIT](./LICENSE) © 2026 John Kueh / Vibejar
