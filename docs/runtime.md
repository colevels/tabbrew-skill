# TabBrew Script — runtime model

## Phased execution

`executeBatch(ops)` groups operations by verb and runs them in a fixed phase order, regardless of the order in which they appear in the script:

```
DEL → UNPIN → UNGROUP → GROUP → PIN → MOVE
```

Why phases?

- **DEL first** — closing tabs invalidates indices and group memberships for everything after. Doing it before MOVE lets MOVE indices be computed against the post-deletion strip.
- **UNPIN before GROUP** — Chrome rejects grouping pinned tabs. UNPIN first lets `GROUP <pinned-id>` succeed.
- **UNGROUP before GROUP** — moving a tab between groups is an UNGROUP-then-GROUP sequence, not an in-place move.
- **PIN after GROUP** — same reason as UNPIN: ungrouped first, then re-pinned.
- **MOVE last** — every other phase can shift indices. Computing MOVE against the original snapshot is the most common script-authoring mistake; ordering MOVE last lets the model's indices be evaluated against a stable post-mutation strip.

Within a phase, all ops issue concurrently where possible (`Promise.all` for PIN/UNPIN, batch APIs for DEL/GROUP/UNGROUP/MOVE).

## Stale id filtering

Before any phase runs, `executeBatch` calls `chrome.tabs.query({})` to enumerate live tab ids. Any id in the script that isn't live is dropped from its op and reported as a `PRECHECK` phase entry in the result. A single closed tab no longer aborts the entire batch.

## Same-name GROUP coalescing

The executor builds two maps — `groupsByName: Map<string, ids[]>` and `groupsByGid: Map<number, ids[]>` — accumulating across all `GROUP` lines. Then it emits one Chrome call per map entry. So:

```tabbrew
GROUP 1 2 "Work"
GROUP 3 4 "Work"
```

produces a single new Chrome group titled "Work" containing `[1, 2, 3, 4]`, not two groups with duplicate titles.

## MOVE bucketing

`MOVE` lines are bucketed by destination window. Within each bucket, indices are sorted ascending and emitted as a single `chrome.tabs.move(ids, { index, windowId })` call starting at the smallest index. This makes "move these 5 tabs to position 3" produce a contiguous block, not five interleaved moves.

## Safety properties

- **No `eval`, no `Function` constructor.** The parser returns plain TypeScript objects. The executor switches on a string discriminant (`op.verb`) to pick which `chrome.tabs.*` call to make.
- **No filesystem, network, or DOM access** is reachable from a script — the only effects are the six Chrome APIs the executor invokes.
- **Bounded blast radius.** A maximally hostile script can close, pin, unpin, group, ungroup, or move tabs. It cannot read tab content, exfiltrate URLs, install other extensions, or escalate privileges.

## Simulation

`simulateBatch(payload, ops)` runs the same phase logic against the snapshot payload (no Chrome calls) and returns a predicted post-state for each tab — useful for showing a preview before letting the user click "run."

The simulator's tab-strip layout enforces Chrome's invariants (pinned-first, group-contiguous), so the preview matches what Chrome will render. Exact post-move indices can drift slightly when Chrome's group-relocation rules kick in; the result is "directionally correct" but not bit-perfect.
