# Contributing

This repository is the **open agent surface** for Vibejar (CLI, skill, protocol).

## Do

- Fix CLI bugs, improve skill clarity, document the contract
- Add examples that follow `contract.md`
- Keep `list` then `claim <id>` as the only agent workflow (no batch-claim helpers that skip listing)

## Don't

- Open PRs that change the App Store app, paywall, or private backend
- Break the stable command shapes in `contract.md` without a versioned migration note
- Commit tokens, pairing secrets, or local `~/.config/vibejar` state

## Local check

```sh
bun cli.ts --help 2>/dev/null || bun cli.ts
# or after install:
bun ~/.vibejar/cli.ts whoami
```

Install still defaults to https://vibejar.com so production self-update stays the source of truth for end users.
