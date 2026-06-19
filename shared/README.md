# shared/ — The Contract

This directory is the **canonical, language-neutral** definition of how the
client and server talk. See `CLAUDE.md` §2.

- `opcodes/opcodes.json` — the integer opcode table (source of truth)
- `constants/constants.json` — tunables both sides depend on
- `schemas/messages.md` — payload shape per opcode

Because GDScript and TypeScript can't import these JSON files as native
constants ergonomically, each side keeps a **thin mirror**:

| Canonical                      | Client mirror                          | Server mirror                       |
|--------------------------------|----------------------------------------|-------------------------------------|
| `opcodes/opcodes.json`         | `client/scripts/net/net_contract.gd`   | `server/src/contract/opcodes.ts`    |
| `constants/constants.json`     | `client/scripts/net/net_contract.gd`   | `server/src/contract/constants.ts`  |

**Rule:** never change a mirror without changing the canonical file and the
other mirror in the same commit. A half-applied contract change is a bug.
