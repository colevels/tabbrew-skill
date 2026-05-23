import { describe, expect, it, vi } from 'vitest'
import { snapshotCurrentWindow } from '../src/snapshot'
import { installChromeStub, makeChromeStub } from './setup'

type FakeWin = { id: number; focused: boolean }
type FakeTab = Partial<chrome.tabs.Tab> & { id: number; index: number; windowId: number; title: string; url: string }
type FakeGroup = { id: number; windowId: number; title: string; color: string }

const stubWith = (windows: FakeWin[], tabs: FakeTab[], groups: FakeGroup[], selfTabId?: number) => {
  installChromeStub(
    makeChromeStub({
      windows: { getAll: vi.fn(async () => windows as unknown as chrome.windows.Window[]) },
      tabs: {
        query: vi.fn(async (q: chrome.tabs.QueryInfo) => {
          if (typeof q.windowId === 'number') return tabs.filter((t) => t.windowId === q.windowId) as unknown as chrome.tabs.Tab[]
          return tabs as unknown as chrome.tabs.Tab[]
        }),
        getCurrent: vi.fn(async () => (selfTabId !== undefined ? ({ id: selfTabId } as chrome.tabs.Tab) : undefined)),
      },
      tabGroups: {
        get: vi.fn(async (id: number) => {
          const g = groups.find((x) => x.id === id)
          if (!g) throw new Error(`no group ${id}`)
          return g as unknown as chrome.tabGroups.TabGroup
        }),
      },
    })
  )
}

describe('snapshotCurrentWindow — markdown structure', () => {
  it('renders sections in the documented order: Goal, Cross-window, Windows, Groups, Tabs', async () => {
    stubWith(
      [{ id: 10, focused: true }],
      [
        { id: 1, index: 0, windowId: 10, title: 'A', url: 'https://a.com', pinned: false, active: true },
        { id: 2, index: 1, windowId: 10, title: 'B', url: 'https://b.com', pinned: false },
      ],
      []
    )
    const { snapshot } = await snapshotCurrentWindow()
    const order = ['# Goal', '# Cross-window:', '# Windows', '# Groups', '# Tabs']
    let prev = -1
    for (const heading of order) {
      const idx = snapshot.indexOf(heading)
      expect(idx, `missing heading ${heading}`).toBeGreaterThanOrEqual(0)
      expect(idx, `heading ${heading} out of order`).toBeGreaterThan(prev)
      prev = idx
    }
  })

  it('omits pinned/active/groupId fields when their value is falsy/absent', async () => {
    stubWith(
      [{ id: 10, focused: true }],
      [{ id: 1, index: 0, windowId: 10, title: 'Plain', url: 'https://a.com', pinned: false, active: false }],
      []
    )
    const { snapshot, payload } = await snapshotCurrentWindow()
    // Find the JSONL line for tab 1.
    const tabLine = snapshot.split('\n').find((l) => l.startsWith('{"id":1'))
    expect(tabLine).toBeDefined()
    expect(tabLine!).not.toContain('"pinned"')
    expect(tabLine!).not.toContain('"active"')
    expect(tabLine!).not.toContain('"groupId"')

    // Payload retains explicit booleans (for the simulator), but no groupId.
    expect(payload.tabs[0].groupId).toBeUndefined()
  })

  it('strips (N) prefix from titles and compacts URLs', async () => {
    stubWith(
      [{ id: 10, focused: true }],
      [{ id: 1, index: 0, windowId: 10, title: '(12) Inbox', url: 'https://www.example.com/inbox', pinned: false }],
      []
    )
    const { snapshot } = await snapshotCurrentWindow()
    expect(snapshot).toContain('"title":"Inbox"')
    expect(snapshot).toContain('"url":"example.com/inbox"')
  })
})

describe('snapshotCurrentWindow — self-tab exclusion', () => {
  it('omits the tab returned by chrome.tabs.getCurrent (the extension host)', async () => {
    stubWith(
      [{ id: 10, focused: true }],
      [
        { id: 1, index: 0, windowId: 10, title: 'Real', url: 'https://a.com', pinned: false },
        { id: 99, index: 1, windowId: 10, title: 'Self', url: 'chrome-extension://abc/popup.html', pinned: false },
      ],
      [],
      99
    )
    const { payload } = await snapshotCurrentWindow()
    expect(payload.tabs.map((t) => t.id)).toEqual([1])
  })
})

describe('snapshotCurrentWindow — cross-window mode', () => {
  it('default (crossWindow: false) returns only the focused window\'s tabs', async () => {
    stubWith(
      [
        { id: 10, focused: true },
        { id: 20, focused: false },
      ],
      [
        { id: 1, index: 0, windowId: 10, title: 'A', url: 'https://a.com', pinned: false },
        { id: 2, index: 0, windowId: 20, title: 'B', url: 'https://b.com', pinned: false },
      ],
      []
    )
    const { snapshot, payload } = await snapshotCurrentWindow()
    expect(snapshot).toContain('# Cross-window: no')
    expect(payload.allowCrossWindow).toBe(false)
    expect(payload.tabs.map((t) => t.id)).toEqual([1])
  })

  it('crossWindow: true returns tabs from every window and sets allowCrossWindow', async () => {
    stubWith(
      [
        { id: 10, focused: true },
        { id: 20, focused: false },
      ],
      [
        { id: 1, index: 0, windowId: 10, title: 'A', url: 'https://a.com', pinned: false },
        { id: 2, index: 0, windowId: 20, title: 'B', url: 'https://b.com', pinned: false },
      ],
      []
    )
    const { snapshot, payload } = await snapshotCurrentWindow({ crossWindow: true })
    expect(snapshot).toContain('# Cross-window: yes')
    expect(payload.allowCrossWindow).toBe(true)
    expect(payload.tabs.map((t) => t.id).sort()).toEqual([1, 2])
  })
})

describe('snapshotCurrentWindow — groups', () => {
  it('includes only groups whose tabs are in scope and recomputes their tab counts', async () => {
    stubWith(
      [{ id: 10, focused: true }],
      [
        { id: 1, index: 0, windowId: 10, title: 'A', url: 'https://a.com', pinned: false, groupId: 100 },
        { id: 2, index: 1, windowId: 10, title: 'B', url: 'https://b.com', pinned: false, groupId: 100 },
        { id: 3, index: 2, windowId: 10, title: 'C', url: 'https://c.com', pinned: false },
      ],
      [{ id: 100, windowId: 10, title: 'Work', color: 'blue' }]
    )
    const { payload, snapshot } = await snapshotCurrentWindow()
    expect(payload.groups).toHaveLength(1)
    expect(payload.groups[0]).toMatchObject({ id: 100, title: 'Work', color: 'blue', tabCount: 2 })
    expect(snapshot).toContain('"title":"Work"')
    expect(snapshot).toContain('"color":"blue"')
  })
})
