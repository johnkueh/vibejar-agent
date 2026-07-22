#!/usr/bin/env bun
/** biome-ignore-all lint/suspicious/noConsole: CLI output is the product. */
// vibejar — the agent-side CLI, one self-contained file (bun).
// Served at https://vibejar.com/cli.ts; connect.md tells agents how to run it.
//
//   bun vibejar.ts pair <token>         pair this machine with your phone's identity
//   bun vibejar.ts whoami               show the paired identity
//   bun vibejar.ts jars                 list your jars
//   bun vibejar.ts fork <slug-or-url>   fork a shared jar into your account
//   bun vibejar.ts list [jar-slug]      read-only open captures (no claim)
//   bun vibejar.ts claim <capture-id>   claim one capture by id: shot path + note
//   bun vibejar.ts status <capture-id> <state> [--pr <url>]
//   bun vibejar.ts watch [jar-slug]     live-print new captures as they land
//   bun vibejar.ts self-update          refresh CLI + agent skill from vibejar.com
//
// SECURITY POSTURE (for agent pre-run review): network access = the Vibejar
// backend (resolved via https://vibejar.com/.well-known/vibejar.json),
// screenshot downloads during claim, and self-update pulls of cli.ts +
// SKILL.md from vibejar.com. Credential = one refresh token at
// ~/.config/vibejar/token (mode 0600). self-update may run `bun install` in
// ~/.vibejar for CLI deps. The stable interface is https://vibejar.com/contract.md.
//
// Identity: a Vibejar guest/account refresh token in ~/.config/vibejar/token
// (pair once from the app's QR/deeplink; forking a jar with no identity mints
// a fresh guest automatically — the fork IS the signup).

// ── bun browser shims for @instantdb/core ──────────────────────────────────
import "fake-indexeddb/auto";
const g = globalThis as Record<string, unknown>;
if (!g.window) {
  g.window = g;
}
if (!g.addEventListener) {
  g.addEventListener = () => undefined;
  g.removeEventListener = () => undefined;
}
if (!g.navigator || !(g.navigator as { onLine?: boolean }).onLine) {
  g.navigator = { onLine: true, userAgent: "vibejar-cli" };
}
if (!g.document) {
  g.document = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    visibilityState: "visible",
    hasFocus: () => true,
  };
}

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { i, id, init } from "@instantdb/core";

const schema = i.schema({
  entities: {
    $files: i.entity({ path: i.string().unique().indexed(), url: i.string() }),
    $users: i.entity({ email: i.string().unique().indexed().optional() }),
    jars: i.entity({
      name: i.string(),
      slug: i.string().unique().indexed(),
      shared: i.boolean().indexed(),
      ownerId: i.string().indexed(),
      forkedFrom: i.string().optional(),
      createdAt: i.number().indexed(),
    }),
    agents: i.entity({
      ownerId: i.string().indexed(),
      name: i.string(),
      pairedAt: i.number().optional(),
      lastSeenAt: i.number().indexed(),
    }),
    captures: i.entity({
      ownerId: i.string().indexed(),
      note: i.string(),
      state: i.string().indexed(),
      createdAt: i.number().indexed(),
      device: i.string().optional(),
      pr: i.string().optional(),
      agent: i.string().optional(),
      proofNote: i.string().optional(),
    }),
  },
  links: {
    jarEntries: {
      forward: { on: "captures", has: "one", label: "jar" },
      reverse: { on: "jars", has: "many", label: "entries" },
    },
    captureShot: {
      forward: { on: "captures", has: "one", label: "shot" },
      reverse: { on: "$files", has: "many", label: "captures" },
    },
  },
});

const CONF_DIR = join(homedir(), ".config", "vibejar");
const TOKEN_PATH = join(CONF_DIR, "token");
const CONFIG_CACHE = join(CONF_DIR, "backend.json");
const DEFAULT_APP_ID = "0d627492-b8a3-4cce-8ddb-40c56034139e";
const CLI_VERSION = 3;

// Backend config is discovered at runtime so deployed CLIs follow backend
// moves (app-id swaps, future transports) without re-fetching the CLI.
async function resolveAppId(): Promise<string> {
  if (process.env.VIBEJAR_APP_ID) {
    return process.env.VIBEJAR_APP_ID;
  }
  try {
    const cached = JSON.parse(readFileSync(CONFIG_CACHE, "utf-8"));
    if (cached.appId && Date.now() - cached.fetchedAt < 86_400_000) {
      return cached.appId;
    }
  } catch {
    // no cache — fall through to fetch
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch("https://vibejar.com/.well-known/vibejar.json", {
      signal: ctl.signal,
    }).then((r) => r.json());
    clearTimeout(t);
    if (typeof res.cliVersion === "number" && res.cliVersion > CLI_VERSION) {
      console.error(
        "note: a newer Vibejar CLI is available — re-fetch: curl -fsSL https://vibejar.com/cli.ts -o ~/.vibejar/cli.ts"
      );
    }
    if (res.backend === "instant" && typeof res.appId === "string") {
      mkdirSync(CONF_DIR, { recursive: true });
      writeFileSync(
        CONFIG_CACHE,
        JSON.stringify({ appId: res.appId, fetchedAt: Date.now() })
      );
      return res.appId;
    }
  } catch {
    // offline or site not live yet — the baked default still works
  }
  return DEFAULT_APP_ID;
}

const db = init({ appId: await resolveAppId(), schema });

// Core doesn't type these, but the CLI needs them: current socket status to
// avoid racing the auth re-handshake, and _startSocket to recover a wedged
// transport (bun's WebSocket never fires open/close after close() is called
// mid-CONNECTING, so the reactor's own reconnect logic never triggers).
type ReactorInternals = {
  status: string;
  _startSocket: () => void;
  subscribeConnectionStatus: (cb: (status: string) => void) => () => void;
};
const reactor = () => (db as unknown as { _reactor: ReactorInternals })._reactor;

function waitStatus(want: string, timeoutMs: number): Promise<boolean> {
  if (reactor().status === want) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (!done) {
        done = true;
        unsub();
        resolve(ok);
      }
    };
    const unsub = reactor().subscribeConnectionStatus((st) => {
      if (st === want) {
        finish(true);
      }
    });
    setTimeout(() => finish(false), timeoutMs);
  });
}

// Must run BEFORE any db.auth.* call as well as after: signing in swaps the
// user, which closes the socket — and closing it while still CONNECTING
// leaves it as a zombie under bun (see ReactorInternals note).
async function ensureAuthenticated() {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await waitStatus("authenticated", 5000)) {
      return;
    }
    reactor()._startSocket();
  }
  console.error("could not reach the Vibejar backend (socket never authenticated)");
  process.exit(1);
}

function query<T extends Record<string, unknown>>(q: T): Promise<{ data: never }> {
  // One-shot over subscribeQuery instead of queryOnce: subscriptions are
  // re-sent on every reconnect, while queryOnce's add-query is silently
  // dropped if it races a re-handshake and then times out.
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    let settled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const settle = (err: Error | null, data?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      for (const t of timers) {
        clearTimeout(t);
      }
      queueMicrotask(() => unsub?.());
      if (err) {
        reject(err);
      } else {
        resolve({ data } as { data: never });
      }
    };
    timers.push(setTimeout(() => reactor()._startSocket(), 10_000));
    timers.push(setTimeout(() => settle(new Error("query timed out")), 30_000));
    unsub = db.subscribeQuery(q as never, (resp) => {
      if (resp.error) {
        settle(new Error(resp.error.message));
        return;
      }
      settle(null, resp.data);
    });
  });
}

// One stable id PER AGENT LABEL per machine — Codex, Claude Code, and Grok
// pairing on the same Mac must be three rows, not one overwriting row.
function agentId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const p = join(CONF_DIR, `agent-id-${slug}`);
  try {
    return readFileSync(p, "utf-8").trim();
  } catch {
    const aid = id();
    mkdirSync(CONF_DIR, { recursive: true });
    writeFileSync(p, aid);
    return aid;
  }
}

// The pairing heartbeat: a durable row the phone app watches live — pairing
// flips its connect card to "agent connected" the moment this lands.
function agentLabel(): string {
  const explicit = process.env.VIBEJAR_AGENT;
  if (explicit) {
    return explicit;
  }
  if (process.env.CLAUDECODE) {
    return "Claude Code";
  }
  if (process.env.CURSOR_TRACE_ID) {
    return "Cursor";
  }
  if (process.env.CODEX_SANDBOX ?? process.env.CODEX_HOME) {
    return "Codex";
  }
  return process.env.USER ?? "agent";
}

function shortHost(): string {
  return hostname().replace(/\.local$/, "");
}

async function beat(userId: string, first = false, label?: string) {
  try {
    const finalLabel = label ?? agentLabel();
    await db.transact(
      db.tx.agents[agentId(finalLabel)].update({
        ownerId: userId,
        name: `${finalLabel} · ${shortHost()}`,
        ...(first ? { pairedAt: Date.now() } : {}),
        lastSeenAt: Date.now(),
      })
    );
    // transact acks optimistically; a query roundtrip on the same socket
    // guarantees the mutation was received before the process exits.
    await query({ agents: { $: { where: { ownerId: userId } } } });
  } catch (e) {
    if (process.env.VIBEJAR_DEBUG) {
      console.error("beat failed:", (e as Error).message);
    }
    // heartbeat is best-effort — never block a verb on it
  }
}

function saveToken(token: string) {
  mkdirSync(CONF_DIR, { recursive: true });
  writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
}

async function signIn(requireExisting: boolean) {
  await ensureAuthenticated();
  if (existsSync(TOKEN_PATH)) {
    const token = readFileSync(TOKEN_PATH, "utf-8").trim();
    const res = await db.auth.signInWithToken(token);
    await ensureAuthenticated();
    await beat(res.user.id);
    return res.user;
  }
  if (requireExisting) {
    console.error(
      "no identity — run `vibejar pair <token>` (from the app's QR) first, or `fork` a jar to mint one"
    );
    process.exit(2);
  }
  const res = await db.auth.signInAsGuest();
  saveToken(res.user.refresh_token);
  await ensureAuthenticated();
  await beat(res.user.id, true);
  console.log(`minted guest identity ${res.user.id}`);
  return res.user;
}

function slugFrom(input: string): string {
  const m = input.match(/\/j\/([a-z0-9-]+)/i);
  return m ? m[1] : input;
}

const QUERY_JAR = (slug: string) => ({
  jars: { $: { where: { slug } }, entries: { shot: {} } },
});

async function cmdPair(token: string) {
  await ensureAuthenticated();
  const res = await db.auth.signInWithToken(token);
  await ensureAuthenticated();
  saveToken(token);
  await beat(res.user.id, true);
  console.log(`paired as ${res.user.email ?? res.user.id}`);
}

async function cmdWhoami() {
  const u = await signIn(true);
  console.log(JSON.stringify({ id: u.id, email: u.email ?? null }, null, 2));
}

async function cmdJars() {
  const u = await signIn(true);
  const res = await query({
    jars: { $: { where: { ownerId: u.id } }, entries: {} },
  });
  for (const j of res.data.jars) {
    const open = (j.entries ?? []).filter((e) => e.state === "todo").length;
    console.log(`${j.slug.padEnd(32)} ${open} open / ${j.entries?.length ?? 0} total`);
  }
}

async function cmdFork(input: string) {
  const slug = slugFrom(input);
  const u = await signIn(false);
  const src = (await query(QUERY_JAR(slug))).data.jars[0];
  if (!src) {
    console.error(`jar '${slug}' not found or not shared`);
    process.exit(1);
  }
  const forkId = id();
  const forkSlug = `${src.slug}-fork-${u.id.slice(0, 6)}`;
  await db.transact(
    db.tx.jars[forkId].create({
      name: src.name,
      slug: forkSlug,
      shared: false,
      ownerId: u.id,
      forkedFrom: src.slug,
      createdAt: Date.now(),
    })
  );
  for (const e of src.entries ?? []) {
    const nid = id();
    let fileId: string | null = null;
    if (e.shot?.url) {
      const bytes = await fetch(e.shot.url).then((r) => r.arrayBuffer());
      const up = await db.storage.uploadFile(
        `captures/${nid}/shot.png`,
        new File([bytes], "shot.png", { type: "image/png" })
      );
      fileId = up.data.id;
    }
    const tx = db.tx.captures[nid].create({
      ownerId: u.id,
      note: e.note,
      state: "todo",
      createdAt: e.createdAt,
    });
    await db.transact(fileId ? tx.link({ shot: fileId, jar: forkId }) : tx.link({ jar: forkId }));
  }
  console.log(`forked '${slug}' → '${forkSlug}' (${src.entries?.length ?? 0} captures)`);
  console.log(`next: bun vibejar.ts list ${forkSlug}`);
}

type CaptureRow = {
  id: string;
  note: string;
  state: string;
  createdAt: number;
  shot?: { url?: string } | null;
  jar?: { slug?: string } | null;
};

/** Read-only triage. Never mutates state — claim only the capture you will fix next. */
async function cmdList(jarSlug?: string, stateFilter?: string) {
  const u = await signIn(true);
  const wantState = stateFilter ?? "todo";
  const res = await query({
    captures: {
      $: {
        where:
          wantState === "all"
            ? { ownerId: u.id }
            : { ownerId: u.id, state: wantState },
      },
      jar: {},
    },
  });
  const rows = (res.data.captures as CaptureRow[])
    .filter((x) => !jarSlug || x.jar?.slug === jarSlug)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      id: c.id,
      note: c.note,
      state: c.state,
      jar: c.jar?.slug ?? null,
      createdAt: c.createdAt,
    }));
  console.log(JSON.stringify(rows, null, 2));
}

async function materializeClaim(c: CaptureRow) {
  await db.transact(
    db.tx.captures[c.id].update({
      state: "claimed",
      agent: `${process.env.USER ?? "agent"}@${hostname()}`,
    })
  );
  let shotPath = "";
  if (c.shot?.url) {
    const bytes = await fetch(c.shot.url).then((r) => r.arrayBuffer());
    shotPath = join(tmpdir(), `vibejar-${c.id}.png`);
    writeFileSync(shotPath, Buffer.from(bytes));
  }
  console.log(
    JSON.stringify(
      { id: c.id, note: c.note, shot: shotPath, jar: c.jar?.slug ?? null },
      null,
      2
    )
  );
}

/** Claim a specific capture by id after list triage. Fails if not open (todo). */
async function cmdClaim(captureId: string) {
  const u = await signIn(true);
  const res = await query({
    captures: {
      $: { where: { id: captureId, ownerId: u.id } },
      shot: {},
      jar: {},
    },
  });
  const c = (res.data.captures as CaptureRow[])[0];
  if (!c) {
    console.error(`capture '${captureId}' not found`);
    process.exit(1);
  }
  if (c.state !== "todo") {
    console.error(
      `capture '${captureId}' is '${c.state}', not todo — release with: status ${captureId} todo`
    );
    process.exit(1);
  }
  await materializeClaim(c);
}

async function cmdStatus(captureId: string, state: string, pr?: string) {
  await signIn(true);
  await db.transact(
    db.tx.captures[captureId].update({ state, ...(pr ? { pr } : {}) })
  );
  await query({ captures: { $: { where: { id: captureId } } } });
  console.log(`${captureId} → ${state}`);
}

async function cmdWatch(jarSlug?: string) {
  const u = await signIn(true);
  const seen = new Set<string>();
  let primed = false;
  const q = jarSlug
    ? { captures: { $: { where: { "jar.slug": jarSlug, ownerId: u.id } }, jar: {} } }
    : { captures: { $: { where: { ownerId: u.id } }, jar: {} } };
  console.log(`watching${jarSlug ? ` jar '${jarSlug}'` : ""} — ctrl-c to stop`);
  db.subscribeQuery(q, (resp) => {
    if (resp.error) {
      console.error(`watch error: ${resp.error.message}`);
      return;
    }
    for (const c of resp.data?.captures ?? []) {
      if (seen.has(c.id)) {
        continue;
      }
      seen.add(c.id);
      if (primed && c.state === "todo") {
        console.log(`new capture: ${c.id}  ${c.note}`);
      }
    }
    primed = true;
  });
  await new Promise(() => undefined);
}

/**
 * Refresh CLI + Agent Skill from vibejar.com (or VIBEJAR_BASE_URL).
 * Skill lands at ~/.agents/skills/vibejar/ (agentskills.io) and is linked
 * into Claude / Grok / Codex / Cursor skill dirs when those trees exist.
 */
async function cmdSelfUpdate() {
  const base = (process.env.VIBEJAR_BASE_URL ?? "https://vibejar.com").replace(
    /\/$/,
    ""
  );
  const home = homedir();
  const vibeDir = join(home, ".vibejar");
  const cliPath = join(vibeDir, "cli.ts");
  const skillDir = join(home, ".agents", "skills", "vibejar");
  const skillPath = join(skillDir, "SKILL.md");
  mkdirSync(vibeDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });

  async function pull(url: string, dest: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(dest, await res.text());
    console.log(`updated ${dest}`);
  }

  await pull(`${base}/cli.ts`, cliPath);
  await pull(`${base}/skill/SKILL.md`, skillPath);

  // Keep CLI deps installable next to the single-file entrypoint
  const pkgPath = join(vibeDir, "package.json");
  if (!existsSync(pkgPath)) {
    writeFileSync(
      pkgPath,
      `${JSON.stringify(
        {
          name: "vibejar-cli",
          private: true,
          type: "module",
          dependencies: {
            "@instantdb/core": "^1.0.49",
            "fake-indexeddb": "^6.0.0",
          },
        },
        null,
        2
      )}\n`
    );
  }
  try {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("bun", ["install"], {
      cwd: vibeDir,
      stdio: "inherit",
    });
    if (r.status !== 0) {
      console.warn("warn: bun install in ~/.vibejar failed — run it manually");
    }
  } catch {
    console.warn("warn: could not run bun install in ~/.vibejar");
  }

  // Canonical agents path is skillDir itself. Symlink product-specific trees.
  const productRoots = [
    join(home, ".claude"),
    join(home, ".grok"),
    join(home, ".codex"),
    join(home, ".cursor"),
  ];
  for (const root of productRoots) {
    if (!existsSync(root)) continue;
    const parent = join(root, "skills");
    mkdirSync(parent, { recursive: true });
    const linkPath = join(parent, "vibejar");
    try {
      if (existsSync(linkPath)) {
        const st = lstatSync(linkPath);
        if (st.isSymbolicLink()) {
          unlinkSync(linkPath);
          symlinkSync(skillDir, linkPath);
          console.log(`link ${linkPath} → ${skillDir}`);
        } else if (st.isDirectory()) {
          cpSync(skillPath, join(linkPath, "SKILL.md"));
          console.log(`copy ${join(linkPath, "SKILL.md")}`);
        }
      } else {
        symlinkSync(skillDir, linkPath);
        console.log(`link ${linkPath} → ${skillDir}`);
      }
    } catch {
      /* best-effort */
    }
  }

  writeFileSync(
    join(vibeDir, "install.json"),
    `${JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        baseUrl: base,
        cliPath,
        skillPath,
      },
      null,
      2
    )}\n`
  );
  console.log(
    "self-update complete. restart the agent session if the skill was already loaded."
  );
}

const [cmd, ...args] = process.argv.slice(2);
const prFlag = args.includes("--pr") ? args[args.indexOf("--pr") + 1] : undefined;

const nameFlag = args.includes("--name")
  ? args[args.indexOf("--name") + 1]
  : undefined;

function takeFlag(flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) {
    return undefined;
  }
  return args[i + 1];
}

const stateFlag = args.includes("--all")
  ? "all"
  : (takeFlag("--state") ?? undefined);
// positional jar for list/watch: first non-flag token
const positional = args.find((a, i) => {
  if (a.startsWith("--")) {
    return false;
  }
  if (i > 0 && args[i - 1]?.startsWith("--") && args[i - 1] !== "--all") {
    return false;
  }
  return true;
});

if (cmd === "pair" && args[0]) {
  if (nameFlag) {
    process.env.VIBEJAR_AGENT = nameFlag;
  }
  await cmdPair(args[0]);
} else if (cmd === "whoami") {
  await cmdWhoami();
} else if (cmd === "jars") {
  await cmdJars();
} else if (cmd === "fork" && args[0]) {
  await cmdFork(args[0]);
} else if (cmd === "list" || cmd === "ls" || cmd === "todo") {
  await cmdList(positional, stateFlag);
} else if (cmd === "claim" && args[0]) {
  await cmdClaim(args[0]);
} else if (cmd === "drain") {
  // Removed: auto-claiming the oldest item confused agents into grabbing
  // unrelated inbox captures. One path only — list, then claim by id.
  console.error(
    "drain is removed. Use: bun ~/.vibejar/cli.ts list [jar]  then  claim <id>"
  );
  process.exit(1);
} else if (cmd === "status" && args[0] && args[1]) {
  await cmdStatus(args[0], args[1], prFlag);
} else if (cmd === "watch") {
  await cmdWatch(positional);
} else if (cmd === "self-update" || cmd === "update") {
  await cmdSelfUpdate();
} else {
  console.log(
    "vibejar — pair <token> | whoami | jars | fork <slug|url> | list [jar] [--state todo|claimed|…|--all] | claim <id> | status <id> <state> [--pr url] | watch [jar] | self-update"
  );
  process.exit(cmd ? 1 : 0);
}
process.exit(0);
