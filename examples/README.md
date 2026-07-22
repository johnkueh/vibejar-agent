# Examples

## Session loop (manual)

```sh
bun ~/.vibejar/cli.ts self-update
bun ~/.vibejar/cli.ts jars
bun ~/.vibejar/cli.ts list my-app
bun ~/.vibejar/cli.ts claim <capture-id>
# open the `shot` PNG, fix the repo, open a PR
bun ~/.vibejar/cli.ts status <capture-id> review --pr https://github.com/you/repo/pull/1
```

## Point an agent at connect.md

```text
Read https://vibejar.com/connect.md and set up Vibejar, then list open captures in my jar.
```

Or paste this repo's `connect.md` if offline.

## Nightly idea (you own the runner)

Vibejar is the queue, not the runner. Your cron/agent loop:

1. `list` open captures  
2. `claim` one id  
3. hand JSON + screenshot to a coding agent  
4. `status … review --pr …`  

See the skill for the full rules (one claim at a time, image first, no invented protocol).
