import { describe, expect, it, vi } from 'vitest'
import { executeBatch } from '../src/execute'
import type { Op } from '../src/types'
import { installChromeStub, makeChromeStub } from './setup'

type ChromeTab = { id: number }

const setupChrome = (liveTabIds: number[]) => {
  const calls: string[] = []
  installChromeStub(
    makeChromeStub({
      tabs: {
        query: vi.fn(async () => {
          calls.push('tabs.query')
          return liveTabIds.map((id) => ({ id }) as ChromeTab as chrome.tabs.Tab)
        }),
        remove: vi.fn(async () => {
          calls.push('tabs.remove')
        }),
        update: vi.fn(async (_id: number, props: { pinned?: boolean }) => {
          calls.push(`tabs.update.${props.pinned ? 'pin' : 'unpin'}`)
          return {} as chrome.tabs.Tab
        }),
        ungroup: vi.fn(async () => {
          calls.push('tabs.ungroup')
        }),
        group: vi.fn(async (opts: { groupId?: number; tabIds: [number, ...number[]] }) => {
          calls.push(opts.groupId ? `tabs.group.gid=${opts.groupId}` : 'tabs.group.new')
          return (opts.groupId ?? 500) as number
        }),
        move: vi.fn(async () => {
          calls.push('tabs.move')
          return [] as unknown as chrome.tabs.Tab[]
        }),
        getCurrent: vi.fn(async () => undefined),
      },
      tabGroups: {
        update: vi.fn(async () => {
          calls.push('tabGroups.update')
          return {} as chrome.tabGroups.TabGroup
        }),
      },
    })
  )
  return { calls }
}

const firstIndexMatching = (calls: string[], pattern: RegExp): number =>
  calls.findIndex((c) => pattern.test(c))

describe('executeBatch — phase order', () => {
  it('emits chrome.* calls in DEL → UNPIN → UNGROUP → GROUP → PIN → MOVE order', async () => {
    const { calls } = setupChrome([1, 2, 3, 4, 5, 6])
    const ops: Op[] = [
      // Scrambled script order; phase order must reassert itself.
      { verb: 'MOVE', id: 1, index: 0 },
      { verb: 'PIN', ids: [2] },
      { verb: 'GROUP', ids: [3], name: 'Work' },
      { verb: 'UNGROUP', ids: [4] },
      { verb: 'UNPIN', ids: [5] },
      { verb: 'DEL', ids: [6] },
    ]
    await executeBatch(ops)

    // tabs.query runs first (PRECHECK), then phases in fixed order. Find the
    // first call belonging to each phase and assert their relative order.
    const idxDel = firstIndexMatching(calls, /^tabs\.remove$/)
    const idxUnpin = firstIndexMatching(calls, /^tabs\.update\.unpin$/)
    const idxUngroup = firstIndexMatching(calls, /^tabs\.ungroup$/)
    const idxGroup = firstIndexMatching(calls, /^tabs\.group\./)
    const idxPin = firstIndexMatching(calls, /^tabs\.update\.pin$/)
    const idxMove = firstIndexMatching(calls, /^tabs\.move$/)

    expect(idxDel).toBeGreaterThanOrEqual(0)
    expect(idxDel).toBeLessThan(idxUnpin)
    expect(idxUnpin).toBeLessThan(idxUngroup)
    expect(idxUngroup).toBeLessThan(idxGroup)
    expect(idxGroup).toBeLessThan(idxPin)
    expect(idxPin).toBeLessThan(idxMove)
  })
})

describe('executeBatch — pre-check', () => {
  it('drops stale ids (not present in chrome.tabs.query) and reports a PRECHECK phase', async () => {
    setupChrome([1, 2]) // only tabs 1 and 2 are alive
    const result = await executeBatch([
      { verb: 'DEL', ids: [1, 99] },
      { verb: 'PIN', ids: [2, 100] },
      { verb: 'MOVE', id: 88, index: 0 },
    ])
    const precheck = result.phases.find((p) => p.phase === 'PRECHECK')
    expect(precheck).toBeDefined()
    expect(precheck?.affectedIds).toEqual(expect.arrayContaining([99, 100, 88]))
  })

  it('returns ok=true with no phases when every op references a stale id', async () => {
    setupChrome([1, 2])
    const result = await executeBatch([{ verb: 'DEL', ids: [999] }])
    expect(result.ok).toBe(true)
    // Only the PRECHECK phase should be present; no DEL because dels is empty.
    expect(result.phases.map((p) => p.phase)).toEqual(['PRECHECK'])
  })
})

describe('executeBatch — coalescing', () => {
  it('coalesces multiple GROUP "Name" ops into one chrome.tabs.group call', async () => {
    const { calls } = setupChrome([1, 2, 3])
    await executeBatch([
      { verb: 'GROUP', ids: [1, 2], name: 'Work' },
      { verb: 'GROUP', ids: [3], name: 'Work' },
    ])
    const groupCalls = calls.filter((c) => c === 'tabs.group.new')
    expect(groupCalls).toHaveLength(1)
  })

  it('coalesces multiple GROUP @gid ops into one chrome.tabs.group call per gid', async () => {
    const { calls } = setupChrome([1, 2, 3])
    await executeBatch([
      { verb: 'GROUP', ids: [1], gid: 42 },
      { verb: 'GROUP', ids: [2, 3], gid: 42 },
    ])
    const groupCalls = calls.filter((c) => c === 'tabs.group.gid=42')
    expect(groupCalls).toHaveLength(1)
  })

  it('buckets MOVE ops by destination window into one chrome.tabs.move call each', async () => {
    const { calls } = setupChrome([1, 2, 3, 4])
    await executeBatch([
      { verb: 'MOVE', id: 1, index: 5 },
      { verb: 'MOVE', id: 2, index: 6 },
      { verb: 'MOVE', id: 3, index: 0, windowId: 20 },
      { verb: 'MOVE', id: 4, index: 1, windowId: 20 },
    ])
    const moveCalls = calls.filter((c) => c === 'tabs.move')
    // One per destination bucket (self-window + window 20).
    expect(moveCalls).toHaveLength(2)
  })
})
