# CLAUDE.md — SkyNomads

This file is the source of truth for how SkyNomads is architected and built.
Claude (and any human) should read it before making changes. When you touch
code, keep this document accurate: if a convention here is wrong or a new
pattern emerges, update this file in the same change.

---

## 1. Project Overview

**SkyNomads** is an isometric MMO.

- **Client / Engine:** Godot 4 (GDScript by default; C# only where a measured
  performance need justifies it).
- **Backend:** [Nakama](https://heroiclabs.com/nakama/) — handles auth,
  matchmaking, authoritative match logic, storage, social systems, and RPCs.
- **Workflow:** Browser-based. Assume changes are reviewed via pull request and
  CI; do not rely on local-only tooling that can't run in CI.

### The One Rule That Shapes Everything: Server Authority

The server is the single source of truth for all game state. **The client is a
renderer and an input device, never an authority.** A modded or malicious client
must not be able to corrupt the game.

Practically, this means every gameplay-affecting action has **two** sides:

1. A **client** side that captures intent, predicts the result locally for
   responsiveness, and sends a request to the server.
2. A **server** side that *validates* the request against authoritative state,
   applies it, and broadcasts the result.

> **Before editing any gameplay system, ask: "What is the server-side
> counterpart, and does this change keep the two in sync?"**
> Example: changing how the movement script computes speed (`client/`) is
> incomplete until the movement validator (`server/`) and the shared movement
> message contract (`shared/`) are updated to match. A PR that changes one
> without the others is a bug, not a feature.

---

## 2. High-Level Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│        Godot 4          │  opcodes │          Nakama          │
│        (client/)        │ + binary │        (server/)         │
│                         │ payloads │                          │
│  Input → Prediction →   │ ───────► │  Validate → Apply →      │
│  Render ◄── Reconcile   │ ◄─────── │  Persist → Broadcast     │
└─────────────────────────┘         └──────────────────────────┘
            ▲                                     ▲
            └──────────── shared/ ────────────────┘
              opcodes, message schemas, constants
              (the contract both sides obey)
```

Three top-level domains. **Dependencies only ever point toward `shared/`.**
`client/` and `server/` never import from each other.

| Domain     | Runs on        | Owns                                              |
|------------|----------------|---------------------------------------------------|
| `client/`  | Player machine | Rendering, input, prediction, UI, audio, VFX      |
| `server/`  | Nakama runtime | Authoritative state, validation, persistence      |
| `shared/`  | Both (by sync) | Opcodes, message shapes, tunable constants         |

### The Contract (`shared/`)

The client and server communicate over Nakama match data messages keyed by an
integer **opcode**. The opcode table and the shape of each message's payload are
the contract. Both sides must agree on it exactly.

Because Nakama server modules are written in a different language than GDScript
(see §3), `shared/` is the canonical definition and each side has a thin,
**generated-or-mirrored** binding. Treat the canonical definition as
source-controlled truth; never hand-edit one binding without the other.

---

## 3. Backend Language Choice (Nakama Modules)

Nakama supports three runtimes: **Go**, **TypeScript**, and **Lua**.

- **Default: TypeScript.** Best balance of type safety, readability, and
  iteration speed for a browser-based workflow. Authoritative match handlers,
  RPCs, and hooks live here.
- **Go** only for hot-path match loops where TypeScript profiling shows a real
  bottleneck. Isolate Go to specific match handlers; do not scatter it.
- **Avoid Lua** for new code unless integrating an existing plugin.

> If this decision changes, update this section first, then migrate — don't let
> the codebase silently drift from the documented choice.

---

## 4. Directory Structure

```
/
├── CLAUDE.md
├── README.md
│
├── client/                     # Godot 4 project root (project.godot lives here)
│   ├── project.godot
│   ├── autoload/               # Singletons (see §6). One responsibility each.
│   │   ├── network_manager.gd
│   │   ├── event_bus.gd
│   │   └── game_state.gd
│   ├── scenes/                 # .tscn files, grouped by domain
│   │   ├── world/              # tilemaps, chunks, environment
│   │   ├── entities/           # player, npc, mob — see §5 for node layout
│   │   ├── ui/                 # hud, menus, inventory, chat
│   │   └── fx/                 # particles, shaders-as-scenes
│   ├── scripts/                # .gd files NOT colocated with a scene
│   │   ├── entities/
│   │   ├── systems/            # client-side systems (prediction, interpolation)
│   │   ├── net/                # opcode handlers, serialization (mirrors shared/)
│   │   └── ui/
│   ├── resources/              # custom Resource types (.tres/.gd), data tables
│   ├── assets/                 # art, audio, fonts — raw imported media only
│   │   ├── sprites/
│   │   ├── audio/
│   │   └── fonts/
│   └── tests/                  # GUT or gdUnit tests (see §9)
│
├── server/                     # Nakama runtime modules (TypeScript)
│   ├── src/
│   │   ├── main.ts             # InitModule: registers handlers/RPCs/hooks
│   │   ├── matches/            # authoritative match handlers (1 dir per match type)
│   │   │   └── world/          # match loop: join, leave, processMatchData, validate
│   │   ├── rpc/                # request/response RPCs (non-realtime)
│   │   ├── hooks/              # before/after auth, storage hooks
│   │   ├── validation/        # pure validators reused by matches & rpc
│   │   └── persistence/       # storage read/write wrappers
│   ├── tests/
│   └── package.json
│
├── shared/                     # The contract. Canonical, language-neutral.
│   ├── opcodes/                # opcode enum (single source of truth)
│   ├── schemas/               # message payload shapes per opcode
│   └── constants/              # tunables both sides must agree on (e.g. MAX_MOVE_SPEED)
│
└── docs/                       # architecture decision records, diagrams
    └── adr/
```

### Placement rules
- A script that is *the* behavior of one scene → colocate it next to the
  `.tscn` (Godot's default) **or** under `scripts/` mirroring the scene path.
  Pick one policy per subsystem and be consistent; prefer colocation for
  leaf scenes, `scripts/systems/` for cross-cutting logic.
- Anything that defines client↔server behavior (limits, opcodes, message
  fields) belongs in `shared/`, **never** duplicated as a literal in both sides.
- `assets/` is raw media only. No logic, no scenes.

---

## 5. Godot Node & Scene Conventions

### Scene composition (favor composition over inheritance)
Build entities by composing small, single-purpose child nodes rather than deep
script inheritance. A player is a tree of behaviors, not a 2000-line script.

Canonical entity scene layout (e.g. `scenes/entities/player.tscn`):

```
Player (CharacterBody2D)          # root: physics body, owns nothing but wiring
├── Sprite (AnimatedSprite2D)     # visual only
├── CollisionShape2D
├── MovementComponent (Node)      # reads input/intent, moves the body
├── HealthComponent (Node)        # hp, damage, death signals
├── NetSyncComponent (Node)       # serializes state ↔ shared/ opcodes
└── StateMachine (Node)           # idle/walk/attack states
```

Rules:
- **Root node type follows function:** `CharacterBody2D` for moving entities,
  `Node2D` for static/grouped visuals, `Control` for UI, plain `Node` for
  logic-only systems.
- **Components are reusable Nodes** with a single responsibility. A component
  must not reach across siblings directly — communicate via signals or through
  the parent. This keeps a `HealthComponent` droppable onto any entity.
- **Isometric specifics:** use `TileMapLayer` with a diamond/isometric tile set.
  Depth sorting via `y_sort_enabled` on the world layer. Keep world→screen and
  screen→world coordinate conversion in **one** helper (`scripts/systems/iso.gd`),
  never inline the math.

### Signals
- Name signals in **past tense**: `died`, `health_changed`, `move_requested`.
- Emit signals upward (child → parent / bus); call methods downward
  (parent → child). Do not have children call parent methods directly.

---

## 6. Autoloads (Singletons)

Use sparingly — they are global state. Each autoload has exactly one job:

| Autoload          | Responsibility                                                    |
|-------------------|-------------------------------------------------------------------|
| `NetworkManager`  | Nakama socket lifecycle, send/receive match data, opcode dispatch |
| `EventBus`        | Decoupled global signals (avoid cross-scene hard references)       |
| `GameState`       | Client-side cached, server-confirmed state (read-mostly)          |

- Gameplay logic does **not** live in autoloads; they are plumbing.
- Never store authoritative truth in `GameState` as if it were authoritative —
  it is a *cache* of what the server last told us, used for prediction.

---

## 7. Naming Conventions

### GDScript (client)
| Thing                       | Style                | Example                       |
|-----------------------------|----------------------|-------------------------------|
| Files (scripts, scenes)     | `snake_case`         | `movement_component.gd`       |
| Class names (`class_name`)  | `PascalCase`         | `class_name MovementComponent`|
| Nodes in the tree           | `PascalCase`         | `HealthComponent`             |
| Variables / functions       | `snake_case`         | `var move_speed`, `func apply_damage()` |
| Private members             | `_leading_underscore`| `var _velocity`               |
| Constants                   | `UPPER_SNAKE_CASE`   | `const MAX_HEALTH = 100`      |
| Enums                       | `PascalCase` / values `UPPER_SNAKE` | `enum State { IDLE, WALK }` |
| Signals                     | `snake_case`, past tense | `signal health_changed`   |
| Booleans                    | `is_`/`has_`/`can_` prefix | `is_alive`, `can_move`   |

### TypeScript (server)
| Thing                | Style              | Example                  |
|----------------------|--------------------|--------------------------|
| Files                | `kebab-case`       | `movement-validator.ts`  |
| Classes / types      | `PascalCase`       | `MatchState`             |
| Functions / vars     | `camelCase`        | `validateMovement()`     |
| Constants            | `UPPER_SNAKE_CASE` | `MAX_MOVE_SPEED`         |

### Shared
- **Opcodes:** `UPPER_SNAKE_CASE`, namespaced by domain:
  `OP_MOVE_REQUEST`, `OP_MOVE_BROADCAST`, `OP_ATTACK_REQUEST`.
- Request/response pairing convention: `*_REQUEST` (client→server),
  `*_RESPONSE` (server→sender), `*_BROADCAST` (server→all in match).

---

## 8. The Cross-File Change Checklist

Because of server authority, most gameplay changes are multi-file. Before
considering a gameplay change complete, verify:

- [ ] **Contract** (`shared/`): is a new/changed opcode or payload field needed?
      Update the canonical definition first.
- [ ] **Client** (`client/`): input capture, local prediction, render, and
      reconciliation when the server's authoritative result arrives.
- [ ] **Server** (`server/`): validation against authoritative state (reject the
      impossible), state mutation, persistence if durable, broadcast.
- [ ] **Constants**: any magic number that both sides depend on lives in
      `shared/constants/`, not duplicated.
- [ ] **Tests**: server validator has a unit test for the reject path.

> A change that only touches the client and "looks like it works" is the most
> common way to ship an exploit. Trace it to the server before merging.

---

## 9. Testing & Quality

- **Server validators are pure functions where possible** and must have unit
  tests — especially for rejection/cheat cases (out-of-range move, negative
  quantity, cooldown bypass).
- **Client**: use GUT or gdUnit4 for logic-heavy scripts (`client/tests/`).
  Don't unit-test rendering; test prediction/serialization math.
- Prefer small, pure helper functions over logic embedded in `_process`.

---

## 10. Git & Workflow

- Branch per change; never commit straight to `main`.
- Commit messages: imperative mood, scoped — `client: add movement prediction`,
  `server: validate move speed`, `shared: add OP_ATTACK_REQUEST`.
- A single logical change should touch all the layers it needs in **one** PR so
  the contract never lands half-implemented.
- Do not open a pull request unless explicitly requested.

---

## 11. For Claude Specifically

- **Think across layers first.** State which files in `client/`, `server/`, and
  `shared/` a task affects before writing code.
- **Never trust the client.** If asked to add a gameplay feature, add the
  server-side validation even if not explicitly requested, and say so.
- **Keep this file current.** New convention or structural change → update
  CLAUDE.md in the same change.
- **Default to modular.** New behavior tends to be a new Node/component or a new
  pure validator, not another branch inside an existing god-script.
- When unsure about a contract change, surface the opcode/payload diff explicitly
  in your summary so it can be reviewed.
```
