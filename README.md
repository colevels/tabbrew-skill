# tabbrew-skill

A safe, declarative DSL for Chrome tab management — paired with a Claude skill that translates plain English (or any language) into executable scripts.

This is the open-source extraction of the agentic tab-management primitive used inside [TabBrew](https://tabbrew.com). Six verbs, no arbitrary code execution — just a small text language that maps 1:1 onto Chrome's `chrome.tabs.*` and `chrome.tabGroups.*` APIs.

## What's in the repo

```
.claude-plugin/plugin.json   # Claude Code plugin manifest
skills/tabbrew/SKILL.md      # Claude skill — drop into ~/.claude/skills/tabbrew/
skills/tabbrew/examples.md   # 24 worked goal → script pairs covering every verb + edge case
runtime/src/                 # TypeScript runtime: parse / execute / simulate / snapshot
docs/grammar.md              # Formal language reference
docs/runtime.md              # Phased execution model + safety properties
```

## The script language at a glance

One verb per line. Lines starting with `#` are comments.

```tabbrew
DEL 123 456                       # close tabs
PIN 789                           # pin a tab
UNPIN 789                         # unpin
UNGROUP 100 101                   # remove from any group
GROUP 200 201 "Reading"           # create a new group
GROUP 300 @5001                   # add to existing group id 5001
MOVE 400 0                        # move tab to position 0
MOVE 500 -1 @win=2                # move to end of window 2 (cross-window)
```

Full grammar: [docs/grammar.md](docs/grammar.md).
24 worked examples: [skills/tabbrew/examples.md](skills/tabbrew/examples.md).

## Quick start — use the Claude skill

The fastest way is the [skills.sh](https://skills.sh) installer — pick which agent (Claude Code, Codex, etc.) you want to install it on:

```bash
npx skills@latest add colevels/tabbrew-skill
```

Or install manually:

1. `git clone https://github.com/colevels/tabbrew-skill.git`
2. Copy the skill folder into Claude's skill directory:

   ```bash
   cp -r tabbrew-skill/skills/tabbrew ~/.claude/skills/
   ```

   The repo is also a Claude Code plugin (`.claude-plugin/plugin.json`), so plugin-aware installers can load it directly from the repo root.

3. In a chat, paste a snapshot of your Chrome state (matching the input format in `SKILL.md`) with a `# Goal` line. Claude returns one fenced `\`\`\`tabbrew ... \`\`\`` block.

## Quick start — run scripts inside a Chrome extension

`runtime/src/` is plain TypeScript with `@types/chrome` as the only runtime dependency. Copy the files you need into your extension's source tree.

```ts
import { snapshotCurrentWindow, parseTabbrewScript, executeBatch } from './tabbrew-skill'

// 1. Capture current state to ship to the model
const { snapshot, payload } = await snapshotCurrentWindow({ crossWindow: false })

// 2. Send `snapshot` + user goal to your model → receive a tabbrew script
const script = await yourLLMCall(snapshot, 'close all youtube tabs')

// 3. Parse → execute against live Chrome
const { ops, errors } = parseTabbrewScript(script)
if (errors.length) console.warn('parse errors', errors)
const result = await executeBatch(ops)
console.log(result.phases)
```

Want a dry-run first? Use `simulateBatch(payload, ops)` — returns the predicted post-execution state without touching Chrome.

## Why a DSL instead of raw JavaScript

A Claude/agent flow that runs raw JavaScript inside an extension is one prompt injection away from `chrome.tabs.remove(everything)`. TabBrew Script trades expressiveness for safety:

- Six verbs, fixed grammar — the parser rejects anything outside the spec
- Each op maps to one concrete `chrome.tabs.*` / `chrome.tabGroups.*` call
- Phased execution (`DEL → UNPIN → UNGROUP → GROUP → PIN → MOVE`) keeps tab indices valid mid-batch
- Stale tab ids are filtered against `chrome.tabs.query()` before execution

See [docs/runtime.md](docs/runtime.md) for the full execution model.

## TabBrew

This primitive powers the agentic tab-management flow in [TabBrew](https://tabbrew.com), a Chrome extension that replaces the new-tab page with a programmable tab manager.

## Author

Built by [@colevels](https://x.com/colevels).

## License

MIT — see [LICENSE](LICENSE).
