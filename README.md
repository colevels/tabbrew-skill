# tabbrew-skill

**Organize your Chrome tabs by just telling Claude what you want.**

"Close all my YouTube tabs." "Group everything by website." "Pin my email and tidy up the rest." You say it in plain language — Claude figures out exactly which tabs to close, pin, group, or move, and it happens safely.

> 🧩 Works with the **[TabBrew — Tab Manager & Organizer](https://chromewebstore.google.com/detail/tabbrew-tab-manager-organ/ikmpmkkcmhhnjmdiooekbhfmomcbefkf)** Chrome extension — install it from the Chrome Web Store to run these on your real tabs in one click.

## How it works

You tell Claude your goal. Behind the scenes it writes a short, safe script using just six simple actions — **close, pin, unpin, group, ungroup, move** — and nothing else. No arbitrary code runs in your browser, so there's no way for it to do something you didn't ask for.

```
You:    "close all youtube tabs and group the rest by site"
Claude: DEL 123 456        ← closes the YouTube tabs
        GROUP 200 201 "Docs"
        GROUP 300 301 "Shopping"
```

That little script maps directly onto Chrome's own tab controls — one line, one action.

## Get started

### Use it with Claude

The quickest way — pick your agent (Claude Code, Codex, etc.) and install:

```bash
npx skills@latest add colevels/tabbrew-skill
```

Prefer to install by hand?

1. `git clone https://github.com/colevels/tabbrew-skill.git`
2. Copy the skill into Claude's skills folder:

   ```bash
   cp -r tabbrew-skill/skills/tabbrew ~/.claude/skills/
   ```

   It's also a Claude Code plugin, so plugin-aware installers can load it straight from the repo.

3. Tell Claude what you want done with your tabs — it does the rest.

### Run it on your live tabs

The easiest path is the **[TabBrew Chrome extension](https://chromewebstore.google.com/detail/tabbrew-tab-manager-organ/ikmpmkkcmhhnjmdiooekbhfmomcbefkf)** — it already has the skill built in. Just install it and start asking.

## Safe by design

Lots of AI browser tools work by running raw code in your browser, which is one bad prompt away from closing every tab you have. TabBrew doesn't do that. It only ever does six things — close, pin, unpin, group, ungroup, move — and anything outside that is rejected before it runs. You always get exactly what you asked for, nothing more.

---

## For developers

The pieces above are open source. Here's how the repo is laid out:

```
.claude-plugin/plugin.json   # Claude Code plugin manifest
skills/tabbrew/SKILL.md      # the Claude skill itself
skills/tabbrew/examples.md   # 24 worked goal → script examples
runtime/src/                 # TypeScript runtime: parse / execute / simulate / snapshot
docs/grammar.md              # formal language reference
docs/runtime.md              # execution model + safety properties
```

**The script language** — one action per line, `#` for comments:

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

Full grammar: [docs/grammar.md](docs/grammar.md) · 24 examples: [skills/tabbrew/examples.md](skills/tabbrew/examples.md).

**Run scripts inside your own extension** — `runtime/src/` is plain TypeScript with `@types/chrome` as the only dependency. Copy in the files you need:

```ts
import { snapshotCurrentWindow, parseTabbrewScript, executeBatch } from './tabbrew-skill'

// 1. Capture current state to send to the model
const { snapshot, payload } = await snapshotCurrentWindow({ crossWindow: false })

// 2. Send `snapshot` + user goal to your model → receive a tabbrew script
const script = await yourLLMCall(snapshot, 'close all youtube tabs')

// 3. Parse → execute against live Chrome
const { ops, errors } = parseTabbrewScript(script)
if (errors.length) console.warn('parse errors', errors)
const result = await executeBatch(ops)
console.log(result.phases)
```

Want a dry-run first? `simulateBatch(payload, ops)` returns the predicted result without touching Chrome.

Under the hood, actions run in a fixed safe order (`DEL → UNPIN → UNGROUP → GROUP → PIN → MOVE`) so tab positions stay valid mid-batch, and stale tab ids are filtered out before anything runs. See [docs/runtime.md](docs/runtime.md) for the full model.

## TabBrew

This powers the tab-management flow in [TabBrew](https://tabbrew.com), a Chrome extension that turns your new-tab page into a programmable tab manager.

## Author

Built by [@colevels](https://x.com/colevels).

## License

MIT — see [LICENSE](LICENSE).
