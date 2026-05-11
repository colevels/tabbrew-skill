# TabBrew Script — worked examples

Twenty-four fully worked `goal → TabBrew Script` pairs. Each example shows the exact input format you will receive and the exact output you must produce. Mirror their style: terse, only the fenced block, no commentary.

## Index by capability

When you need a pattern, jump to the example that demonstrates it:

- **DEL** — 1 (URL match), 2 (multi-domain), 5 (UNGROUP+rename helper), 15 (title match), 16 (URL multi-domain), 18 (close all but pinned)
- **PIN / UNPIN** — 6 (PIN), 7 (UNPIN all), 17 (PIN active tab)
- **GROUP `"name"`** (new group) — 3 (single line), 4 (multi-line, same name coalescing), 10 (mixed gesture)
- **GROUP `@<gid>`** (reuse existing) — 19 (single tab), 20 (mix new + existing)
- **UNGROUP → GROUP** (rename) — 5
- **MOVE** — 8 (`-1` append), 9 (`0` front), 13 (post-DEL index recomputation)
- **MOVE `@win=`** (cross-window) — 21
- **Vague-goal defaults** — 12 (organize → group by domain), 23 (categorize + dedup existing), 24 (clean up blanks + merge)
- **Comment-only rejections** — 11 (id not in snapshot), 14 (no-op already satisfied), 22 (cross-window blocked)

---

## Example 1 — Pure DEL (URL-based selection)

# Goal
close all youtube tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
_(none)_

# Tabs
{"id":100,"idx":0,"winId":1,"title":"Inbox (3) - Gmail","url":"mail.google.com/inbox","active":true}
{"id":101,"idx":1,"winId":1,"title":"Cat compilation","url":"youtube.com/watch?v=cats"}
{"id":102,"idx":2,"winId":1,"title":"Lo-fi beats","url":"youtube.com/watch?v=lofi"}
{"id":103,"idx":3,"winId":1,"title":"TabBrew docs","url":"tabbrew.com/docs"}

```tabbrew
DEL 101 102
```

---

## Example 2 — Multi-criteria DEL

# Goal
close all youtube and twitter tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":5}

# Groups
_(none)_

# Tabs
{"id":200,"idx":0,"winId":1,"title":"Inbox","url":"mail.google.com"}
{"id":201,"idx":1,"winId":1,"title":"YT Music","url":"youtube.com/music"}
{"id":202,"idx":2,"winId":1,"title":"Tweet 1","url":"twitter.com/x/status/1"}
{"id":203,"idx":3,"winId":1,"title":"Tweet 2","url":"x.com/y/status/2"}
{"id":204,"idx":4,"winId":1,"title":"News","url":"nytimes.com","active":true}

```tabbrew
DEL 201 202 203
```

---

## Example 3 — Single GROUP (URL-based selection, new group)

# Goal
group all my github tabs into "Code Review"

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
_(none)_

# Tabs
{"id":300,"idx":0,"winId":1,"title":"Gmail","url":"mail.google.com"}
{"id":301,"idx":1,"winId":1,"title":"PR #42","url":"github.com/owner/repo/pull/42","active":true}
{"id":302,"idx":2,"winId":1,"title":"Issue #5","url":"github.com/owner/repo/issues/5"}
{"id":303,"idx":3,"winId":1,"title":"Hacker News","url":"news.ycombinator.com"}

```tabbrew
GROUP 301 302 "Code Review"
```

---

## Example 4 — Multi-line GROUP coalescing

# Goal
group all github PRs and all linear tickets into "Inbox"

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":6}

# Groups
_(none)_

# Tabs
{"id":400,"idx":0,"winId":1,"title":"Gmail","url":"mail.google.com"}
{"id":401,"idx":1,"winId":1,"title":"PR #42","url":"github.com/x/y/pull/42"}
{"id":402,"idx":2,"winId":1,"title":"LIN-001","url":"linear.app/x/issue/LIN-001"}
{"id":403,"idx":3,"winId":1,"title":"Hacker News","url":"news.ycombinator.com"}
{"id":404,"idx":4,"winId":1,"title":"PR #50","url":"github.com/x/y/pull/50"}
{"id":405,"idx":5,"winId":1,"title":"LIN-002","url":"linear.app/x/issue/LIN-002","active":true}

```tabbrew
GROUP 401 404 "Inbox"
GROUP 402 405 "Inbox"
```

(Two lines, same group name — the executor coalesces them into one Chrome group call, but separating PRs from Linear tickets is more readable than one mixed line.)

---

## Example 5 — UNGROUP then GROUP (group rename)

# Goal
rename my "Work" group to "Office"

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
{"id":5001,"winId":1,"title":"Work","color":"blue","tabCount":2}
{"id":5002,"winId":1,"title":"Personal","color":"green","tabCount":1}

# Tabs
{"id":500,"idx":0,"winId":1,"groupId":5001,"title":"PR #1","url":"github.com/x/y/pull/1"}
{"id":501,"idx":1,"winId":1,"groupId":5001,"title":"LIN-1","url":"linear.app/x/issue/LIN-1","active":true}
{"id":502,"idx":2,"winId":1,"groupId":5002,"title":"Twitter","url":"twitter.com"}
{"id":503,"idx":3,"winId":1,"title":"Gmail","url":"mail.google.com"}

```tabbrew
UNGROUP 500 501
GROUP 500 501 "Office"
```

(Renaming requires UNGROUP then a fresh GROUP "Office" — `@5001` would only re-add the same tabs to the existing "Work" group, leaving the title unchanged.)

---

## Example 6 — PIN

# Goal
pin gmail and calendar

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":3}

# Groups
_(none)_

# Tabs
{"id":600,"idx":0,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com/inbox"}
{"id":601,"idx":1,"winId":1,"title":"Today - Google Calendar","url":"calendar.google.com/calendar/u/0/r/day","active":true}
{"id":602,"idx":2,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
PIN 600 601
```

---

## Example 7 — UNPIN all

# Goal
unpin everything

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":3}

# Groups
_(none)_

# Tabs
{"id":700,"idx":0,"pinned":true,"winId":1,"title":"Pinned Gmail","url":"mail.google.com"}
{"id":701,"idx":1,"pinned":true,"winId":1,"title":"Pinned Calendar","url":"calendar.google.com"}
{"id":702,"idx":2,"winId":1,"title":"News","url":"nytimes.com","active":true}

```tabbrew
UNPIN 700 701
```

---

## Example 8 — MOVE to end (`-1`)

# Goal
move the youtube tab to the end

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
_(none)_

# Tabs
{"id":800,"idx":0,"winId":1,"title":"Inbox","url":"mail.google.com"}
{"id":801,"idx":1,"winId":1,"title":"YouTube","url":"youtube.com/music","active":true}
{"id":802,"idx":2,"winId":1,"title":"Notion","url":"notion.so"}
{"id":803,"idx":3,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
MOVE 801 -1
```

---

## Example 9 — MOVE to front (`0`)

# Goal
move my gmail tab to the very front

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":3}

# Groups
_(none)_

# Tabs
{"id":900,"idx":0,"winId":1,"title":"News","url":"nytimes.com"}
{"id":901,"idx":1,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com","active":true}
{"id":902,"idx":2,"winId":1,"title":"YouTube","url":"youtube.com"}

```tabbrew
MOVE 901 0
```

---

## Example 10 — Mixed gesture

# Goal
close youtube tabs, pin gmail, and group these long-read articles into "Reading"

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":5}

# Groups
_(none)_

# Tabs
{"id":1000,"idx":0,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com","active":true}
{"id":1001,"idx":1,"winId":1,"title":"YT Music","url":"youtube.com/music"}
{"id":1002,"idx":2,"winId":1,"title":"The case for X — Stratechery","url":"stratechery.com/2026/x"}
{"id":1003,"idx":3,"winId":1,"title":"Essay on systems thinking","url":"lesswrong.com/posts/123"}
{"id":1004,"idx":4,"winId":1,"title":"YT video","url":"youtube.com/watch?v=abc"}

```tabbrew
DEL 1001 1004
GROUP 1002 1003 "Reading"
PIN 1000
```

---

## Example 11 — Id not in snapshot (rejection)

# Goal
close the stripe dashboard tab

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":3}

# Groups
_(none)_

# Tabs
{"id":1100,"idx":0,"winId":1,"title":"Inbox","url":"mail.google.com","active":true}
{"id":1101,"idx":1,"winId":1,"title":"TabBrew","url":"tabbrew.com"}
{"id":1102,"idx":2,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
# could not find a Stripe tab in the snapshot
```

---

## Example 12 — Vague goal "organize my tabs" → categorize by domain (no clarifying questions)

# Goal
organize my tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":8}

# Groups
_(none)_

# Tabs
{"id":1200,"idx":0,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com/inbox"}
{"id":1201,"idx":1,"winId":1,"title":"NYTimes","url":"nytimes.com"}
{"id":1202,"idx":2,"winId":1,"title":"PR #42","url":"github.com/x/y/pull/42","active":true}
{"id":1203,"idx":3,"winId":1,"title":"Issue #5","url":"github.com/x/y/issues/5"}
{"id":1204,"idx":4,"winId":1,"title":"YT Music","url":"youtube.com/music"}
{"id":1205,"idx":5,"winId":1,"title":"YT Video","url":"youtube.com/watch?v=a"}
{"id":1206,"idx":6,"winId":1,"title":"Tweet 1","url":"x.com/foo/status/1"}
{"id":1207,"idx":7,"winId":1,"title":"Tweet 2","url":"twitter.com/bar/status/2"}

```tabbrew
GROUP 1200 "Email"
GROUP 1202 1203 "Code"
GROUP 1204 1205 "YouTube"
GROUP 1206 1207 "Social"
```

(Open-ended "organize my tabs" is a command to act, not a question. The model picks the most useful default — group by domain — and emits a TabBrew Script. NYTimes (tab 1201) is a one-off and stays ungrouped. No `#` comment, no clarifying questions.)

---

## Example 13 — DEL then MOVE (index recomputation)

# Goal
close youtube tabs, then move gmail to position 0

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":5}

# Groups
_(none)_

# Tabs
{"id":1300,"idx":0,"winId":1,"title":"News","url":"nytimes.com"}
{"id":1301,"idx":1,"winId":1,"title":"YT Music","url":"youtube.com/music"}
{"id":1302,"idx":2,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com","active":true}
{"id":1303,"idx":3,"winId":1,"title":"YT Video","url":"youtube.com/watch?v=abc"}
{"id":1304,"idx":4,"winId":1,"title":"Notion","url":"notion.so"}

```tabbrew
DEL 1301 1303
MOVE 1302 0
```

(After the DEL phase the remaining strip is `News=0, Gmail=1, Notion=2`. The MOVE target index `0` is computed against that post-DEL state, not the original snapshot.)

---

## Example 14 — No-op (goal already satisfied)

# Goal
close all pinned tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":2}

# Groups
_(none)_

# Tabs
{"id":1400,"idx":0,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com","active":true}
{"id":1401,"idx":1,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
# no action needed — there are no pinned tabs in the snapshot
```

---

## Example 15 — Title-based selection

# Goal
close all tabs about cats

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":5}

# Groups
_(none)_

# Tabs
{"id":1500,"idx":0,"winId":1,"title":"Cat compilation 2026","url":"youtube.com/watch?v=cats"}
{"id":1501,"idx":1,"winId":1,"title":"TabBrew docs","url":"tabbrew.com/docs","active":true}
{"id":1502,"idx":2,"winId":1,"title":"My cat's vet appointment","url":"chewy.com/x"}
{"id":1503,"idx":3,"winId":1,"title":"r/cats — funniest threads","url":"reddit.com/r/cats/123"}
{"id":1504,"idx":4,"winId":1,"title":"Programming news","url":"news.ycombinator.com"}

```tabbrew
DEL 1500 1502 1503
```

---

## Example 16 — URL-based selection (multi-domain)

# Goal
close all twitter tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
_(none)_

# Tabs
{"id":1600,"idx":0,"winId":1,"title":"Tweet 1","url":"twitter.com/x/status/1"}
{"id":1601,"idx":1,"winId":1,"title":"Tweet 2","url":"x.com/y/status/2"}
{"id":1602,"idx":2,"winId":1,"title":"News","url":"nytimes.com","active":true}
{"id":1603,"idx":3,"winId":1,"title":"Tweet 3","url":"twitter.com/x/status/3"}

```tabbrew
DEL 1600 1601 1603
```

(Twitter migrated to the `x.com` domain, so URL matching must cover both `twitter.com` and `x.com`.)

---

## Example 17 — Pin the active tab

# Goal
pin the active tab

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":3}

# Groups
_(none)_

# Tabs
{"id":1700,"idx":0,"winId":1,"title":"Inbox - Gmail","url":"mail.google.com"}
{"id":1701,"idx":1,"winId":1,"title":"Notion - Q4 plan","url":"notion.so/q4","active":true}
{"id":1702,"idx":2,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
PIN 1701
```

---

## Example 18 — Close all but pinned

# Goal
close everything except pinned tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":5}

# Groups
_(none)_

# Tabs
{"id":1800,"idx":0,"pinned":true,"winId":1,"title":"Pinned Gmail","url":"mail.google.com"}
{"id":1801,"idx":1,"pinned":true,"winId":1,"title":"Pinned Calendar","url":"calendar.google.com"}
{"id":1802,"idx":2,"winId":1,"title":"News","url":"nytimes.com","active":true}
{"id":1803,"idx":3,"winId":1,"title":"YouTube","url":"youtube.com"}
{"id":1804,"idx":4,"winId":1,"title":"Notion","url":"notion.so"}

```tabbrew
DEL 1802 1803 1804
```

---

## Example 19 — Add to existing group (gid reuse, no duplicate)

# Goal
add my Slack tab to my Work group

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
{"id":5001,"winId":1,"title":"Work","color":"blue","tabCount":2}

# Tabs
{"id":1900,"idx":0,"winId":1,"groupId":5001,"title":"Linear","url":"linear.app"}
{"id":1901,"idx":1,"winId":1,"groupId":5001,"title":"PR #42","url":"github.com/x/y/pull/42"}
{"id":1902,"idx":2,"winId":1,"title":"Slack","url":"app.slack.com","active":true}
{"id":1903,"idx":3,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
GROUP 1902 @5001
```

(Reuse `@5001` rather than `GROUP 1902 "Work"` — the latter would create a second Chrome group also titled "Work", duplicating what already exists.)

---

## Example 20 — Mix new + existing groups

# Goal
group my Notion tabs into "Notes" if it exists, and create a new "Code" group for github

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":6}

# Groups
{"id":5002,"winId":1,"title":"Notes","color":"yellow","tabCount":1}

# Tabs
{"id":2000,"idx":0,"winId":1,"groupId":5002,"title":"Daily journal","url":"notion.so/journal"}
{"id":2001,"idx":1,"winId":1,"title":"Notion - Q4 plan","url":"notion.so/q4","active":true}
{"id":2002,"idx":2,"winId":1,"title":"Notion - meeting notes","url":"notion.so/notes"}
{"id":2003,"idx":3,"winId":1,"title":"PR #11","url":"github.com/x/y/pull/11"}
{"id":2004,"idx":4,"winId":1,"title":"Issue #88","url":"github.com/x/y/issues/88"}
{"id":2005,"idx":5,"winId":1,"title":"Hacker News","url":"news.ycombinator.com"}

```tabbrew
GROUP 2001 2002 @5002
GROUP 2003 2004 "Code"
```

(`@5002` adds the two ungrouped Notion tabs to the existing "Notes" group; `"Code"` creates a fresh group for the github tabs.)

---

## Example 21 — Cross-window MOVE (toggle on)

# Goal
move all my YouTube tabs to my Reading window

# Cross-window: yes

# Windows
{"id":1,"focused":true,"tabCount":4}
{"id":2,"tabCount":2}

# Groups
{"id":5003,"winId":2,"title":"Reading","color":"green","tabCount":2}

# Tabs
{"id":2100,"idx":0,"winId":1,"title":"Inbox","url":"mail.google.com","active":true}
{"id":2101,"idx":1,"winId":1,"title":"YT Music","url":"youtube.com/music"}
{"id":2102,"idx":2,"winId":1,"title":"YT Video","url":"youtube.com/watch?v=a"}
{"id":2103,"idx":3,"winId":1,"title":"News","url":"nytimes.com"}
{"id":2104,"idx":0,"winId":2,"groupId":5003,"title":"Stratechery","url":"stratechery.com/x"}
{"id":2105,"idx":1,"winId":2,"groupId":5003,"title":"LessWrong","url":"lesswrong.com/posts/1"}

```tabbrew
MOVE 2101 -1 @win=2
MOVE 2102 -1 @win=2
```

(Pure cross-window MOVE — re-homing the YouTube tabs into window 2. We do **not** also emit `GROUP 2101 2102 @5003` here: the executor runs GROUP before MOVE, so at GROUP time tabs 2101/2102 are still in window 1 and Chrome would reject the call. If the user explicitly asks "and also add them to my Reading group," that requires two passes — generate a MOVE-only script first, then a GROUP-only script after the moves complete.)

---

## Example 22 — Cross-window blocked (toggle off)

# Goal
move my work tabs to a separate window

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":4}

# Groups
{"id":5004,"winId":1,"title":"Work","color":"blue","tabCount":2}

# Tabs
{"id":2200,"idx":0,"winId":1,"groupId":5004,"title":"PR #1","url":"github.com/x/y/pull/1","active":true}
{"id":2201,"idx":1,"winId":1,"groupId":5004,"title":"LIN-1","url":"linear.app/x/issue/LIN-1"}
{"id":2202,"idx":2,"winId":1,"title":"Gmail","url":"mail.google.com"}
{"id":2203,"idx":3,"winId":1,"title":"News","url":"nytimes.com"}

```tabbrew
# cross-window operations are disabled — turn on the cross-window option to move tabs to another window
```

---

## Example 23 — "categorize" with existing duplicate groups → reuse + merge (no questions)

# Goal
help me categorize my tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":12}

# Groups
{"id":6001,"winId":1,"title":"Work","color":"blue","tabCount":2}
{"id":6002,"winId":1,"title":"Work","color":"blue","tabCount":1}
{"id":6003,"winId":1,"title":"YouTube","color":"red","tabCount":1}

# Tabs
{"id":2300,"idx":0,"winId":1,"groupId":6001,"title":"Linear","url":"linear.app"}
{"id":2301,"idx":1,"winId":1,"groupId":6001,"title":"PR #11","url":"github.com/x/y/pull/11"}
{"id":2302,"idx":2,"winId":1,"groupId":6002,"title":"Notion plan","url":"notion.so/q4-plan"}
{"id":2303,"idx":3,"winId":1,"groupId":6003,"title":"YT Music","url":"youtube.com/music","active":true}
{"id":2304,"idx":4,"winId":1,"title":"YT Video","url":"youtube.com/watch?v=a"}
{"id":2305,"idx":5,"winId":1,"title":"YT Stream","url":"youtube.com/watch?v=b"}
{"id":2306,"idx":6,"winId":1,"title":"PR #42","url":"github.com/x/y/pull/42"}
{"id":2307,"idx":7,"winId":1,"title":"Issue #5","url":"github.com/x/y/issues/5"}
{"id":2308,"idx":8,"winId":1,"title":"Tweet 1","url":"x.com/foo/status/1"}
{"id":2309,"idx":9,"winId":1,"title":"Tweet 2","url":"twitter.com/bar/status/2"}
{"id":2310,"idx":10,"winId":1,"title":"Inbox","url":"mail.google.com"}
{"id":2311,"idx":11,"winId":1,"title":"Calendar","url":"calendar.google.com"}

```tabbrew
UNGROUP 2302
GROUP 2302 2306 2307 @6001
GROUP 2304 2305 @6003
GROUP 2308 2309 "Social"
GROUP 2310 2311 "Email"
```

(Default for vague "categorize": route ungrouped tabs into existing matching groups (`@6001` for Work, `@6003` for YouTube), merge the duplicate `Work` group 6002 into 6001 by ungrouping its member and re-grouping with the others, and create new groups only where no fit exists (Social, Email). No clarifying questions, no bullet lists.)

---

## Example 24 — "clean up" → close blank tabs and merge duplicate groups

# Goal
clean up my tabs

# Cross-window: no

# Windows
{"id":1,"focused":true,"tabCount":7}

# Groups
{"id":7001,"winId":1,"title":"Reading","color":"green","tabCount":1}
{"id":7002,"winId":1,"title":"Reading","color":"green","tabCount":2}

# Tabs
{"id":2400,"idx":0,"winId":1,"groupId":7001,"title":"Stratechery","url":"stratechery.com"}
{"id":2401,"idx":1,"winId":1,"groupId":7002,"title":"LessWrong","url":"lesswrong.com/posts/1"}
{"id":2402,"idx":2,"winId":1,"groupId":7002,"title":"Substack post","url":"something.substack.com","active":true}
{"id":2403,"idx":3,"winId":1,"title":"New Tab","url":"chrome://newtab"}
{"id":2404,"idx":4,"winId":1,"title":"","url":"about:blank"}
{"id":2405,"idx":5,"winId":1,"title":"New Tab","url":"chrome://newtab"}
{"id":2406,"idx":6,"winId":1,"title":"Inbox","url":"mail.google.com"}

```tabbrew
DEL 2403 2404 2405
UNGROUP 2401 2402
GROUP 2401 2402 @7001
```

("Clean up" default: close obvious blanks (`chrome://newtab`, `about:blank`) and merge duplicate same-titled groups in the same window by ungrouping the smaller and re-grouping into the larger with `@<gid>`. The active tab and ordinary tabs are left alone.)
