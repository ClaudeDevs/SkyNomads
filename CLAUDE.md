# CLAUDE.md — SkyNomads

This file is the source of truth for how SkyNomads is architected and built.
Read it before making changes. When a convention here is wrong or a new pattern
emerges, update this file in the same change.

> **Stack note (read this):** SkyNomads' client was originally Godot. It is now a
> **browser game built with Phaser 3 + TypeScript** (`web/`). The Nakama
> TypeScript backend (`server/`) and the shared contract (`shared/`) carried
> over unchanged. If you find references to Godot/GDScript anywhere, they are
> stale — delete them.

---

## 1. Project Overview

**SkyNomads** is an isometric, browser-based MMO (floating "sky islands",
skyblock-style) in the spirit of kintara.gg.

- **Client:** **Phaser 3** (TypeScript), bundled with **Vite**, deployed to
  **Vercel** as a static site. Lives in `web/`.
- **Backend:** [Nakama](https://heroiclabs.com/nakama/) — auth, realtime match
  logic, storage, RPCs. TypeScript runtime modules in `server/`.
- **Contract:** `shared/` — the opcode table, message shapes, and tunables both
  sides obey.

### The One Rule That Shapes Everything: Server Authority

The server is the single source of truth for all game state. **The client is a
renderer and an input device, never an authority.** A modified or malicious
browser client must not be able to corrupt the game — this matters doubly
because the economy is headed toward real value (a token layer).

Every gameplay-affecting action has **two** sides:

1. A **client** side (`web/`) that captures intent, predicts the result locally
   for responsiveness, and sends a request to the server.
2. A **server** side (`server/`) that *validates* the request against
   authoritative state, applies it, persists if durable, and broadcasts.

> Before editing any gameplay system, ask: "What is the server-side counterpart,
> and does this change keep the two in sync?" A change that only touches the
> client and "looks like it works" is the most common way to ship an exploit.

---

## 2. High-Level Architecture

```
┌──────────────────────────┐   opcodes    ┌──────────────────────────┐
│      Phaser 3 + TS       │  + JSON over │          Nakama          │
│        (web/)            │  match data  │        (server/)         │
│                          │ ───────────► │                          │
│  Input → Predict →       │              │  Validate → Apply →      │
│  Render ◄── Reconcile    │ ◄─────────── │  Persist → Broadcast     │
└──────────────────────────┘   RPCs       └──────────────────────────┘
            ▲                                          ▲
            └───────────────── shared/ ────────────────┘
                 opcodes, message schemas, constants
```

- **Realtime gameplay** (movement, gathering, building) → Nakama **match data**
  keyed by integer **opcodes**.
- **Request/response** (inventory, wallet, market, quests, join-island) →
  Nakama **RPCs**.
- `web/` and `server/` never import from each other. Both depend only on the
  shared contract.

### Deployment topology
- **Vercel** hosts the static Phaser bundle (`web/`). Frontend only.
- **Nakama + Postgres** run on a separate always-on host (e.g. an Oracle Cloud
  Always-Free VM via Docker). The browser talks to it over **wss/https** — a
  reverse proxy (Caddy) terminates TLS. See §10.
- The client picks its server via env vars (`VITE_NAKAMA_HOST`,
  `VITE_NAKAMA_PORT`, `VITE_NAKAMA_SSL`). Never hardcode `127.0.0.1`.

---

## 3. Backend Language Choice (Nakama Modules)

Nakama supports **Go**, **TypeScript**, and **Lua**.

- **Default: TypeScript.** Authoritative match handlers, RPCs, and hooks. Best
  balance of type-safety and iteration speed; mirrors the client's language.
- **Go** only for a hot match loop that TypeScript profiling proves is a
  bottleneck. Isolate it; don't scatter it.
- **Avoid Lua** for new code.

The server bundles to a single `server/build/index.js` (rollup) that Nakama
loads. Commit source under `server/src/`, never the bundle.

---

## 4. Directory Structure

```
/
├── CLAUDE.md
├── README.md
├── docker-compose.yml          # local dev: Postgres + Nakama
│
├── web/                        # Phaser 3 + TypeScript client (Vite). Vercel root.
│   ├── index.html
│   ├── package.json            # phaser, @heroiclabs/nakama-js, vite, typescript
│   ├── vite.config.ts
│   ├── public/assets/          # sprites, tiles (CC0 art only)
│   └── src/
│       ├── main.ts             # Phaser game bootstrap + auto-connect
│       ├── scenes/             # one file per Phaser scene
│       │   ├── GameScene.ts    # world render, input, movement, entities
│       │   └── UIScene.ts      # HTML/CSS HUD overlay (modals, hotbar)
│       ├── network/
│       │   ├── NakamaClient.ts # socket lifecycle, send/receive, opcode dispatch
│       │   └── Opcodes.ts      # mirror of shared/ opcodes
│       └── utils/
│           └── IsoMath.ts      # THE iso<->cartesian conversion (one place)
│
├── server/                     # Nakama runtime modules (TypeScript)
│   ├── src/
│   │   ├── main.ts             # InitModule: registers matches/RPCs/hooks
│   │   ├── matches/world/      # authoritative match handler (hub + island)
│   │   ├── rpc/                # request/response RPCs (join-island, market, quests…)
│   │   ├── validation/         # pure validators (movement, gather, market)
│   │   ├── systems/            # pure game logic (loot-roller, wallet, inventory)
│   │   ├── data/               # SERVER-ONLY tables (loot odds, node defs, quests)
│   │   ├── persistence/        # Nakama storage wrappers (inventory, wallet, island…)
│   │   └── contract/           # mirror of shared/ (opcodes, constants)
│   ├── tests/                  # vitest unit tests (validators, systems)
│   └── package.json
│
└── shared/                     # The contract. Canonical, language-neutral.
    ├── opcodes/                # opcode enum (source of truth)
    ├── schemas/               # message payload shapes + RPC table
    └── constants/              # tunables both sides agree on (MAX_MOVE_SPEED…)
```

### Placement rules
- Anything that defines client↔server behavior (limits, opcodes, payload fields,
  RPC names) belongs in `shared/`, **never** duplicated as a literal in both sides.
  Each side keeps a thin mirror (`web/src/network/Opcodes.ts`,
  `server/src/contract/`). Never edit one mirror without the other.
- **Secret/exploitable data stays server-only** (`server/src/data/`): loot odds,
  spawn tables, quest rewards, drop rates. The client sees only the *result*.
- `web/public/assets/` is raw media only (CC0-licensed). No logic.

---

## 5. Client Conventions (Phaser)

- **One scene per responsibility.** `GameScene` = the world (tiles, entities,
  input, camera). `UIScene` = the HUD, rendered as an **HTML/CSS overlay**
  (`pointer-events: none` so clicks pass through to the game). Add `BankScene`,
  `MarketScene` etc. as new scenes/overlays — don't cram everything into one.
- **Isometric math lives in exactly one file** (`utils/IsoMath.ts`):
  `cartesianToIso`, `isoToCartesian`, `getTileCoordinate`. Never inline the
  tile math anywhere else.
- **Networking is a singleton** (`network` in `NakamaClient.ts`). It owns the
  socket and exposes typed callbacks (`onMoveBroadcast`, `onWorldSnapshot`…).
  Gameplay code subscribes to those callbacks; it never touches the socket
  directly. Keep it plumbing — no game logic inside `NakamaClient`.
- **Predict, then reconcile.** The local player moves immediately on input; the
  server's authoritative broadcast corrects it. Remote players render from
  broadcasts only.
- **Offline-resilient.** The game must render and be controllable even if the
  Nakama connection fails (spawn a local player, no-op the network sends). The
  live site should never be a blank screen because the backend is down.

---

## 6. Naming Conventions (TypeScript, both sides)

| Thing                | Style              | Example                  |
|----------------------|--------------------|--------------------------|
| Files (client)       | `PascalCase.ts` for classes/scenes | `GameScene.ts`, `NakamaClient.ts` |
| Files (server)       | `kebab-case.ts`    | `movement-validator.ts`  |
| Classes / types      | `PascalCase`       | `MatchState`, `GameScene`|
| Functions / vars     | `camelCase`        | `validateMovement()`     |
| Constants            | `UPPER_SNAKE_CASE` | `MAX_MOVE_SPEED`         |

### Shared (the contract)
- **Opcodes:** `UPPER_SNAKE_CASE`, namespaced by domain:
  `MOVE_REQUEST`, `MOVE_BROADCAST`, `GATHER_REQUEST`, `BUILD_REQUEST`.
- Pairing: `*_REQUEST` (client→server), `*_RESPONSE`/RPC return (server→sender),
  `*_BROADCAST`/`*_SNAPSHOT` (server→clients).
- RPC names: `snake_case` (`join_island`, `market_buy`, `claim_quest`).

---

## 7. The Cross-File Change Checklist

Most gameplay changes are multi-file. Before considering one done:

- [ ] **Contract** (`shared/` + both mirrors): new/changed opcode or RPC?
- [ ] **Client** (`web/`): input capture, prediction, render, reconciliation.
- [ ] **Server** (`server/`): validate against authoritative state (reject the
      impossible), mutate, persist if durable, broadcast.
- [ ] **Constants**: shared magic numbers live in `shared/constants/`.
- [ ] **Tests**: server validator has a unit test for the reject path.

---

## 8. Testing & Quality

- **Server validators/systems are pure functions** and must have **vitest**
  tests — especially reject/cheat cases (overspeed move, listing items you don't
  own, claiming an unfinished quest, double-spend).
- **Client**: keep logic (iso math, prediction) in small pure functions that can
  be unit-tested; don't test Phaser rendering.

---

## 9. Git & Workflow

- Branch per change; never commit straight to `main` unless it's a trivial,
  reviewed fix.
- Commit messages: imperative, scoped — `web: add market modal`,
  `server: validate build placement`, `shared: add BUILD_REQUEST`.
- A logical change touches all the layers it needs in **one** commit so the
  contract never lands half-implemented.
- When replacing a file via the GitHub web editor, paste the **entire** file —
  never a fragment.

---

## 10. Build, Run & Deploy

### Local development
```bash
# Backend (Nakama + Postgres)
cd server && npm install && npm run build   # -> server/build/index.js
cd .. && docker compose up                  # API :7350, console :7351

# Client (Phaser + Vite)
cd web && npm install && npm run dev         # http://localhost:3000
```
Point the local client at the local server with `web/.env`:
```
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SSL=false
```

### Production
- **Client → Vercel.** Project root directory = `web`. Build `npm run build`,
  output `dist`. Set `VITE_NAKAMA_HOST` / `VITE_NAKAMA_PORT=443` /
  `VITE_NAKAMA_SSL=true` to point at the hosted server.
- **Server → an always-on host** (Oracle Cloud Always-Free VM, Docker). Nakama +
  Postgres behind a **Caddy** reverse proxy that provides `wss://` TLS (required:
  an HTTPS Vercel page cannot talk to an insecure `ws://`). See the deploy notes
  / `server/` deploy compose.

---

## 11. For Claude Specifically

- **Think across layers first.** State which files in `web/`, `server/`, and
  `shared/` a task affects before writing code.
- **Never trust the client.** Add the server-side validation even if not asked,
  and say so.
- **Keep this file current.** New convention or structural change → update
  CLAUDE.md in the same change.
- **Full files for paste.** The maintainer applies changes via the GitHub web
  editor; always provide complete files, never fragments.
- When unsure about a contract change, surface the opcode/RPC/payload diff
  explicitly so it can be reviewed.
