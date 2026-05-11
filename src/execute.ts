import { ExecuteResult, Op, PhaseResult } from './types'

const safeRun = async (phase: string, label: string, affectedIds: number[], fn: () => Promise<unknown>): Promise<PhaseResult> => {
  try {
    await fn()
    return { phase, ok: true, detail: label, affectedIds }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { phase, ok: false, detail: `${label} — ${msg}`, affectedIds }
  }
}

type MoveOp = { id: number; index: number; windowId?: number }

export const executeBatch = async (ops: Op[]): Promise<ExecuteResult> => {
  // Snapshot the live tab id set up-front so we can drop stale ids that the
  // generator emitted before the user clicked Run. Without this, a single
  // closed tab makes chrome.tabs.* reject the whole batch.
  const liveTabs = await chrome.tabs.query({})
  const liveIds = new Set<number>()
  for (const t of liveTabs) if (typeof t.id === 'number') liveIds.add(t.id)
  const dropped: number[] = []
  const filterIds = (ids: number[]): number[] => {
    const out: number[] = []
    for (const id of ids) {
      if (liveIds.has(id)) out.push(id)
      else dropped.push(id)
    }
    return out
  }

  const dels: number[] = []
  const pins: number[] = []
  const unpins: number[] = []
  const ungroups: number[] = []
  const groupsByName = new Map<string, number[]>()
  const groupsByGid = new Map<number, number[]>()
  const moves: MoveOp[] = []

  for (const op of ops) {
    switch (op.verb) {
      case 'DEL':
        dels.push(...filterIds(op.ids))
        break
      case 'PIN':
        pins.push(...filterIds(op.ids))
        break
      case 'UNPIN':
        unpins.push(...filterIds(op.ids))
        break
      case 'UNGROUP':
        ungroups.push(...filterIds(op.ids))
        break
      case 'GROUP':
        if ('gid' in op) {
          groupsByGid.set(op.gid, [...(groupsByGid.get(op.gid) ?? []), ...filterIds(op.ids)])
        } else {
          groupsByName.set(op.name, [...(groupsByName.get(op.name) ?? []), ...filterIds(op.ids)])
        }
        break
      case 'MOVE':
        if (liveIds.has(op.id)) moves.push({ id: op.id, index: op.index, windowId: op.windowId })
        else dropped.push(op.id)
        break
    }
  }

  const phases: PhaseResult[] = []

  if (dropped.length) {
    phases.push({
      phase: 'PRECHECK',
      ok: true,
      detail: `dropped ${dropped.length} stale id(s) — tab no longer exists`,
      affectedIds: dropped,
    })
  }

  if (dels.length) {
    phases.push(await safeRun('DEL', `removed ${dels.length} tab(s)`, dels, () => chrome.tabs.remove(dels)))
  }

  if (unpins.length) {
    phases.push(
      await safeRun('UNPIN', `unpinned ${unpins.length} tab(s)`, unpins, () =>
        Promise.all(unpins.map((id) => chrome.tabs.update(id, { pinned: false })))
      )
    )
  }

  if (ungroups.length) {
    phases.push(await safeRun('UNGROUP', `ungrouped ${ungroups.length} tab(s)`, ungroups, () => chrome.tabs.ungroup(ungroups)))
  }

  const namedGroupEntries = Array.from(groupsByName.entries())
  for (const [name, ids] of namedGroupEntries) {
    phases.push(
      await safeRun('GROUP', `"${name}" ← ${ids.length} tab(s)`, ids, async () => {
        const gid = await chrome.tabs.group({ tabIds: ids })
        await chrome.tabGroups.update(gid, { title: name })
      })
    )
  }

  const reuseGroupEntries = Array.from(groupsByGid.entries())
  for (const [gid, ids] of reuseGroupEntries) {
    phases.push(
      await safeRun('GROUP', `@${gid} ← ${ids.length} tab(s)`, ids, async () => {
        await chrome.tabs.group({ groupId: gid, tabIds: ids })
      })
    )
  }

  if (pins.length) {
    phases.push(
      await safeRun('PIN', `pinned ${pins.length} tab(s)`, pins, () =>
        Promise.all(pins.map((id) => chrome.tabs.update(id, { pinned: true })))
      )
    )
  }

  if (moves.length) {
    const buckets = new Map<number | 'self', MoveOp[]>()
    for (const m of moves) {
      const key: number | 'self' = m.windowId ?? 'self'
      const arr = buckets.get(key) ?? []
      arr.push(m)
      buckets.set(key, arr)
    }
    const bucketEntries = Array.from(buckets.entries())
    for (const [key, bucket] of bucketEntries) {
      bucket.sort((a, b) => a.index - b.index)
      const ids = bucket.map((m) => m.id)
      const startIdx = bucket[0].index
      const target = key === 'self' ? '' : ` → @win=${key}`
      phases.push(
        await safeRun('MOVE', `moved ${ids.length} tab(s)${target} starting at index ${startIdx}`, ids, () =>
          chrome.tabs.move(ids, key === 'self' ? { index: startIdx } : { index: startIdx, windowId: key })
        )
      )
    }
  }

  const ok = phases.every((p) => p.ok)
  return { phases, ok }
}
