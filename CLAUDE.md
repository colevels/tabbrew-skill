# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Layout follows the [mattpocock/skills](https://github.com/mattpocock/skills) Claude Code plugin convention: `.claude-plugin/plugin.json` declares the plugin, skills live under `skills/<name>/`, and the TypeScript runtime is a sibling under `runtime/`.

Two artifacts shipped together as one package:

1. **`skills/tabbrew/SKILL.md`** (+ `examples.md`) — a Claude skill that translates a Chrome tab snapshot + a natural-language goal into a TabBrew Script. This is a contract document, not code: the wording is load-bearing because real users invoke this skill behind a one-shot HTTP API.
2. **`runtime/src/`** — the TypeScript runtime that *executes* those scripts inside a Chrome extension (parser → simulator → executor). Plain TS with `@types/chrome` as the only runtime dependency; designed to be copied into a host extension's source tree, not consumed as an npm package (`"private": true`).

`runtime/src/index.ts` is the public export barrel — `parseTabbrewScript`, `executeBatch`, `simulateBatch`, `snapshotCurrentWindow`, `compactUrl`, `stripCountPrefix`, plus all public types. Adding a new top-level function for consumers means touching this file; adding a verb does not (the public surface stays the same).

The two are tightly coupled — the skill emits a DSL the runtime parses. Changes to verbs/grammar must land in `skills/tabbrew/SKILL.md`, `docs/grammar.md`, `skills/tabbrew/examples.md`, and `runtime/src/parser.ts` + `runtime/src/execute.ts` + `runtime/src/simulate.ts` in lockstep, or the model and the executor disagree.

## Commands

```bash
cd runtime
npm install        # one-time
npm run typecheck  # tsc --noEmit
npm test           # vitest run — parser/simulate/execute/snapshot/url-utils suites
npm run test:watch # vitest in watch mode
```

The `package.json` lives in `runtime/`, so all npm commands run from there. No lint, no build step (consumers compile the `.ts` files in their own extension). The `tsconfig.json` `outDir: dist` exists only so `tsc` is happy — `dist/` isn't shipped.

### Tests

Vitest specs live in `runtime/tests/` (`parser`, `simulate`, `execute`, `snapshot`, `url-utils`), configured by `runtime/vitest.config.ts` to include `tests/**/*.test.ts`. There is no real Chrome in the test environment, so `runtime/tests/setup.ts` installs a `globalThis.chrome` stub: `makeChromeStub({...})` builds a fully-mocked `chrome.tabs` / `chrome.tabGroups` / `chrome.windows` surface (all `vi.fn`), `installChromeStub` assigns it to the global, and a no-op baseline is installed at load so any module touching `chrome.*` at import time doesn't crash. `execute.test.ts` asserts against these mock call args to pin the phase order and coalescing/bucketing behavior; `snapshot.test.ts` uses shared fixtures from `tests/fixtures/snapshots.ts`.

## Architecture

### The DSL — six verbs, one per line

`DEL`, `PIN`, `UNPIN`, `UNGROUP`, `GROUP`, `MOVE`. Each maps 1:1 to a `chrome.tabs.*` / `chrome.tabGroups.*` call. The design point is **safety**: no `eval`, no JS sandbox, parser rejects anything outside the grammar, blast radius is bounded to those six APIs. See `docs/grammar.md` for the formal reference.

### Phased execution is the non-obvious part

`executeBatch` in `runtime/src/execute.ts` ignores the order of ops in the script and re-groups them into a fixed phase order:

```
DEL → UNPIN → UNGROUP → GROUP → PIN → MOVE
```

This order is not arbitrary — it's chosen so each phase leaves tab indices and group memberships valid for the next:

- DEL first so MOVE indices reflect the post-deletion strip.
- UNPIN/UNGROUP before GROUP because Chrome rejects grouping pinned tabs and a tab can only be in one group.
- PIN after GROUP for the same reason.
- MOVE last because every prior phase shifts indices.

**Consequence for the model contract**: the skill must compute `MOVE` indices against the *post-non-MOVE* state, not the original snapshot. This is documented in `SKILL.md` rule 2 — don't loosen that wording without re-deriving why the phase order works.

**Consequence for the runtime**: `runtime/src/simulate.ts` mirrors the exact same phase order so previews match what Chrome will actually render. If you change one, change both.

### Coalescing and bucketing

- Multiple `GROUP ... "Name"` lines with the same quoted name fold into **one** Chrome group at execution time. Same for `GROUP ... @<gid>`. The executor builds `groupsByName: Map<string, ids[]>` / `groupsByGid: Map<number, ids[]>` and emits one Chrome call per map entry. This is a deliberate feature — same-name GROUP lines coalesce so the skill can keep semantically distinct buckets visually separate in the script but produce one group at runtime.
- `MOVE` lines are bucketed by destination window, sorted by target index, and emitted as a single `chrome.tabs.move(ids, { index })` call starting at the smallest index — so "move these 5 tabs to position 3" produces a contiguous block, not 5 interleaved moves.

### Stale id filtering

Before any phase runs, `executeBatch` calls `chrome.tabs.query({})` to enumerate live tab ids and drops any script-supplied id that's no longer alive. Dropped ids are reported as a `PRECHECK` phase entry. Without this, a single tab closed between snapshot and run aborts the whole batch. `simulateBatch` does the equivalent against the snapshot payload.

### Snapshot format

`snapshotCurrentWindow` in `runtime/src/snapshot.ts` produces both a **markdown string** (what the model sees) and a **typed payload** (what `simulateBatch` consumes). The string format — sections in order `# Goal`, `# Cross-window: yes|no`, `# Windows`, `# Groups`, `# Tabs` with JSONL bodies — is the contract `SKILL.md` is written against. The "optional field absence" convention (`pinned`/`active`/`focused`/`groupId`/`color` omitted when false/undefined) shrinks input tokens and is documented in `SKILL.md` §Input format.

The snapshotter deliberately excludes the tab hosting the extension page itself (newtab, popup, sidepanel, etc.) — otherwise the model can plan ops against the very tab running the executor.

`compactUrl` strips `https?://(www.)?` and caps URLs at 80 chars; `stripCountPrefix` removes `(N) ` unread badges from titles (X/Twitter, YouTube, Gmail). Both exist to keep model input small.

### Cross-window mode

The `crossWindow` snapshot option (and the corresponding `# Cross-window: yes|no` header in the rendered snapshot) gates `MOVE ... @win=<wid>`. When `no`, the snapshot only contains the focused window's tabs and the skill must not emit `@win=`. A Chrome tab group can never span windows, so `GROUP @<gid>` always requires the listed tabs to already be in the group's window — phase order means you can't pre-position with MOVE in the same script.

## Plugin discoverability

When this plugin is *not* installed, hosts like Cowork decide whether to suggest it (via `suggest_plugin_install`) by string-matching the user's message against two fields:

1. `description` in `.claude-plugin/plugin.json` — read by the plugin host before any skill is loaded.
2. `description` in the YAML frontmatter of `skills/tabbrew/SKILL.md` — read by Claude when deciding whether to load the skill on-demand.

Both fields are kept deliberately phrase-heavy: they list the concrete things a user would actually type ("organize my tabs", "close all YouTube tabs", "group my Chrome tabs by domain", "TabBrew script") rather than a clean abstract summary. Generic descriptions like "manages Chrome tabs" don't match real user phrasings and the plugin stays invisible. The verb list (organize / clean up / categorize / pin / unpin / move / close / delete / group / ungroup) is duplicated in both fields on purpose — matchers don't share state across files.

`keywords` in `plugin.json` (`chrome`, `tabs`, `tab-management`, `tabbrew`, `organize-tabs`, `browser`) is a secondary signal used by some hosts. Keep it short and intent-flavored, not feature-flavored.

When changing either description, run `claude plugin validate .claude-plugin/plugin.json` from the repo root. One warning is expected and by design: CLAUDE.md sits at the plugin root and is *not* shipped as plugin context — it's for contributors editing this repo. Skill consumers only see `skills/tabbrew/SKILL.md`.

## When editing

- **Adding a verb**: touch `runtime/src/types.ts`, `runtime/src/parser.ts`, `runtime/src/execute.ts`, `runtime/src/simulate.ts`, `docs/grammar.md`, `skills/tabbrew/SKILL.md`'s grammar table, and add an example to `skills/tabbrew/examples.md`. Decide where it fits in the phase order — that decision is the design. Add coverage in `runtime/tests/parser.test.ts` and `runtime/tests/execute.test.ts`.
- **Changing snapshot output**: the markdown string and the JSONL field set are the model's input contract. Update `skills/tabbrew/SKILL.md` §Input format in the same change, otherwise the model's parsing assumptions drift. Update `runtime/tests/snapshot.test.ts` and the `tests/fixtures/snapshots.ts` fixtures alongside.
- **Changing phase order**: update `runtime/src/execute.ts`, `runtime/src/simulate.ts`, `docs/runtime.md`, and `skills/tabbrew/SKILL.md` rule 2 together. `runtime/tests/execute.test.ts` asserts the phase order against the Chrome mock — keep it in sync.
- **Always run `npm test` and `npm run typecheck` from `runtime/` before considering a change done.**
