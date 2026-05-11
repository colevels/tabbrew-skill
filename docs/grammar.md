# TabBrew Script — grammar reference

One verb per line. Lines starting with `#` are comments. Blank lines are ignored.

## Verbs

| Verb      | Shape                                            | Notes                                                                                                                                                                       |
| --------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEL`     | `DEL <id>+`                                      | Close one or more tabs.                                                                                                                                                     |
| `PIN`     | `PIN <id>+`                                      | Pin one or more tabs.                                                                                                                                                       |
| `UNPIN`   | `UNPIN <id>+`                                    | Unpin one or more tabs.                                                                                                                                                     |
| `UNGROUP` | `UNGROUP <id>+`                                  | Remove tabs from any tab group they're in.                                                                                                                                  |
| `GROUP`   | `GROUP <id>+ "<name>"` _or_ `GROUP <id>+ @<gid>` | Last token is either a quoted name (creates a **new** group with that title) or `@<gid>` referencing an existing group id (adds the tabs to that **existing** group).        |
| `MOVE`    | `MOVE <id> <index> [@win=<wid>]`                 | Move one tab to position `<index>`. `-1` appends. Optional `@win=<wid>` re-homes the tab into a different window. Emit one line per tab.                                    |

## Tokens

- **Tab ids** (`<id>`) — positive integers, the same numeric ids used by `chrome.tabs.Tab.id`.
- **Group ids** (`@<gid>`) — positive integers prefixed with `@`, same as `chrome.tabGroups.TabGroup.id`.
- **Window ids** (`@win=<wid>`) — positive integers prefixed with `@win=`, same as `chrome.windows.Window.id`.
- **Indices** (`<index>`) — non-negative integers (window-relative, `0` is leftmost after pinned strip). `-1` is a sentinel for "append to end". Other negative numbers aren't supported.
- **Names** — straight ASCII quoted strings (`"..."`). Embedded `"` is not supported.

## Group semantics

- `GROUP <ids> "Reading"` always creates a fresh Chrome group, even if another group named `"Reading"` already exists. To reuse an existing group, use `@<gid>` instead.
- Same-name `GROUP` lines coalesce: `GROUP 1 2 "Work"` followed by `GROUP 3 4 "Work"` produces one Chrome group with all four tabs.
- Same `@<gid>` lines fold into a single `chrome.tabs.group({ groupId, tabIds })` call.

## Cross-window operations

- `MOVE <id> <index> @win=<wid>` re-homes a tab to a different window's tab strip.
- `GROUP @<gid>` requires every listed tab to be already in the group's window — Chrome groups cannot span windows.

## Comment-only output

A response consisting of a single `#` line is allowed when:

- A referenced tab/group doesn't appear in the snapshot.
- The goal requires cross-window operations but cross-window is disabled.
- The goal is already satisfied — no ops would have any effect.

In every other case the script must contain at least one verb.

## Parser

`parseTabbrewScript(input: string) → { ops: Op[]; errors: ParseError[] }`

The parser tokenizes line-by-line, returning typed `Op` objects plus per-line error reports. Errors are non-fatal — partial parses still return whatever `ops` were valid.
