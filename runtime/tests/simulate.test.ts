import { describe, expect, it } from 'vitest'
import { simulateBatch } from '../src/simulate'
import type { Op } from '../src/types'
import { singleWindowPayload, twoWindowsPayload } from './fixtures/snapshots'

describe('simulateBatch — phase order', () => {
  it('runs verbs in DEL → UNPIN → UNGROUP → GROUP → PIN → MOVE order regardless of script order', () => {
    const payload = singleWindowPayload()
    // Deliberately mixed-up script order. The result must reflect phase order.
    const ops: Op[] = [
      { verb: 'MOVE', id: 2, index: 4 },
      { verb: 'DEL', ids: [5] },
      { verb: 'UNPIN', ids: [1] },
      { verb: 'PIN', ids: [2] },
      { verb: 'UNGROUP', ids: [3] },
      { verb: 'GROUP', ids: [4], name: 'NewGrp' },
    ]
    const result = simulateBatch(payload, ops)

    expect(result.deleted.map((t) => t.id)).toEqual([5])
    expect(result.droppedStaleIds).toEqual([])

    const byId = new Map(result.tabs.map((t) => [t.id, t]))
    expect(byId.get(1)?.pinned).toBe(false)
    expect(byId.get(1)?.changes).toContain('unpinned')
    expect(byId.get(2)?.pinned).toBe(true)
    expect(byId.get(2)?.changes).toEqual(expect.arrayContaining(['pinned', 'moved']))
    expect(byId.get(3)?.groupId).toBeUndefined()
    expect(byId.get(3)?.changes).toContain('ungrouped')
    expect(byId.get(4)?.groupId).toBeLessThan(0) // synthetic
    expect(byId.get(4)?.changes).toContain('grouped')
  })

  it('DEL-before-MOVE: deleting a tab makes a subsequent MOVE of the same id a no-op', () => {
    const payload = singleWindowPayload()
    // Same id appears in DEL and MOVE. Phase order means DEL wins; MOVE
    // finds no live tab and silently skips. If MOVE ran first, the moved
    // tab would still appear in `tabs` post-delete (it wouldn't, but the
    // 'moved' change marker would survive on the deleted record).
    const ops: Op[] = [
      { verb: 'MOVE', id: 5, index: 0 },
      { verb: 'DEL', ids: [5] },
    ]
    const result = simulateBatch(payload, ops)
    expect(result.tabs.find((t) => t.id === 5)).toBeUndefined()
    expect(result.deleted.find((t) => t.id === 5)?.changes).toEqual(['deleted'])
  })

  it('UNPIN-then-PIN of the same id: PIN wins because PIN runs after UNPIN', () => {
    const payload = singleWindowPayload() // tab 1 starts pinned
    // Script orders PIN first then UNPIN. Phase order should still apply
    // UNPIN before PIN, so the final state is pinned (PIN wins).
    const ops: Op[] = [
      { verb: 'PIN', ids: [1] },
      { verb: 'UNPIN', ids: [1] },
    ]
    const result = simulateBatch(payload, ops)
    expect(result.tabs.find((t) => t.id === 1)?.pinned).toBe(true)
  })

  it('UNGROUP-then-GROUP of the same id: GROUP wins because GROUP runs after UNGROUP', () => {
    const payload = singleWindowPayload() // tab 3 starts in group 100
    const ops: Op[] = [
      { verb: 'GROUP', ids: [3], gid: 200 },
      { verb: 'UNGROUP', ids: [3] },
    ]
    const result = simulateBatch(payload, ops)
    expect(result.tabs.find((t) => t.id === 3)?.groupId).toBe(200)
  })

  it('UNPIN-before-GROUP order lets a pinned tab be grouped within a single script', () => {
    const payload = singleWindowPayload()
    const ops: Op[] = [
      // Script order: GROUP first, UNPIN second. Phase order should still
      // run UNPIN before GROUP so the pinned tab is ungrouped-eligible.
      { verb: 'GROUP', ids: [1], name: 'Movable' },
      { verb: 'UNPIN', ids: [1] },
    ]
    const result = simulateBatch(payload, ops)
    const t1 = result.tabs.find((t) => t.id === 1)
    expect(t1?.pinned).toBe(false)
    expect(t1?.groupId).toBeLessThan(0)
  })
})

describe('simulateBatch — GROUP coalescing', () => {
  it('coalesces multiple GROUP lines with the same quoted name into one new group', () => {
    const payload = singleWindowPayload()
    const ops: Op[] = [
      { verb: 'GROUP', ids: [2], name: 'NewSet' },
      { verb: 'GROUP', ids: [5], name: 'NewSet' },
    ]
    const result = simulateBatch(payload, ops)
    // Same-name GROUP lines coalesce within the script. They do not merge
    // into pre-existing same-titled groups — that's what GROUP @gid is for.
    const newSet = result.groups.filter((g) => g.title === 'NewSet')
    expect(newSet).toHaveLength(1)
    expect(newSet[0].tabCount).toBe(2)
    expect(result.tabs.find((t) => t.id === 2)?.groupId).toBe(newSet[0].id)
    expect(result.tabs.find((t) => t.id === 5)?.groupId).toBe(newSet[0].id)
  })

  it('coalesces multiple GROUP lines with the same @gid', () => {
    const payload = singleWindowPayload()
    // Existing group 100 already has tabs 3 and 4. Add tabs 2 and 5 in two
    // separate script lines that both target @100.
    const ops: Op[] = [
      { verb: 'GROUP', ids: [2], gid: 100 },
      { verb: 'GROUP', ids: [5], gid: 100 },
    ]
    const result = simulateBatch(payload, ops)
    const inGroup100 = result.tabs.filter((t) => t.groupId === 100).map((t) => t.id).sort()
    expect(inGroup100).toEqual([2, 3, 4, 5])
    const group = result.groups.find((g) => g.id === 100)
    expect(group?.tabCount).toBe(4)
  })
})

describe('simulateBatch — MOVE bucketing', () => {
  it('routes cross-window MOVE @win=<wid> to the destination window', () => {
    const payload = twoWindowsPayload()
    const ops: Op[] = [{ verb: 'MOVE', id: 1, index: 0, windowId: 20 }]
    const result = simulateBatch(payload, ops)
    const t1 = result.tabs.find((t) => t.id === 1)
    expect(t1?.windowId).toBe(20)
    expect(t1?.changes).toContain('moved')
  })

  it('bucketing within the same window places moved tabs contiguously starting at the smallest index', () => {
    const payload = twoWindowsPayload() // window 10 has tabs [1,2,3]; window 20 has [4,5]
    // Move tabs 4 and 5 to window 10, indices 1 and 2 (interleaving the
    // existing tabs). They should end up contiguous starting at index 1.
    const ops: Op[] = [
      { verb: 'MOVE', id: 4, index: 1, windowId: 10 },
      { verb: 'MOVE', id: 5, index: 2, windowId: 10 },
    ]
    const result = simulateBatch(payload, ops)
    const window10 = result.tabs.filter((t) => t.windowId === 10).sort((a, b) => a.index - b.index)
    // Pinned-first/group-clustering is applied so the exact final order
    // depends on Chrome layout invariants. The invariant we care about is:
    // tabs 4 and 5 sit next to each other (no original tab between them).
    const order = window10.map((t) => t.id)
    const i4 = order.indexOf(4)
    const i5 = order.indexOf(5)
    expect(Math.abs(i4 - i5)).toBe(1)
  })
})

describe('simulateBatch — stale id filtering', () => {
  it('moves unknown ids referenced by ops to droppedStaleIds and does not affect any tab', () => {
    const payload = singleWindowPayload()
    const ops: Op[] = [
      { verb: 'DEL', ids: [999] },
      { verb: 'MOVE', id: 888, index: 0 },
      { verb: 'PIN', ids: [3, 777] },
    ]
    const result = simulateBatch(payload, ops)
    expect(result.droppedStaleIds).toEqual(expect.arrayContaining([999, 888, 777]))
    expect(result.deleted).toEqual([])
    // Tab 3 (a live id) was still pinned by the surviving ids in the PIN op.
    expect(result.tabs.find((t) => t.id === 3)?.pinned).toBe(true)
  })
})

describe('simulateBatch — group recomputation', () => {
  it('drops a group whose last tab was deleted', () => {
    const payload = singleWindowPayload() // group 100 has tabs 3 and 4
    const ops: Op[] = [{ verb: 'DEL', ids: [3, 4] }]
    const result = simulateBatch(payload, ops)
    expect(result.groups.find((g) => g.id === 100)).toBeUndefined()
  })

  it('recomputes tabCount when a group loses one of its tabs', () => {
    const payload = singleWindowPayload() // group 100 has tabs 3 and 4
    const ops: Op[] = [{ verb: 'UNGROUP', ids: [3] }]
    const result = simulateBatch(payload, ops)
    const group = result.groups.find((g) => g.id === 100)
    expect(group?.tabCount).toBe(1)
  })
})
