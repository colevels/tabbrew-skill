import { vi } from 'vitest'

// snapshot.ts reads `chrome.tabGroups.TAB_GROUP_ID_NONE` lazily inside
// `isGrouped`, but executeBatch and snapshotCurrentWindow hit `chrome.*`
// the moment they're called. Install a no-op default so importing source
// modules is always safe; tests that exercise Chrome calls override fields
// they care about via `installChromeStub(makeChromeStub({...}))`.
type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> }

export const makeChromeStub = (overrides: DeepPartial<ChromeStubShape> = {}): ChromeStubShape => ({
  tabs: {
    query: vi.fn(async () => []),
    remove: vi.fn(async () => undefined),
    update: vi.fn(async () => ({}) as chrome.tabs.Tab),
    move: vi.fn(async () => ({}) as chrome.tabs.Tab),
    group: vi.fn(async () => 1),
    ungroup: vi.fn(async () => undefined),
    getCurrent: vi.fn(async () => undefined),
    ...overrides.tabs,
  },
  tabGroups: {
    TAB_GROUP_ID_NONE: -1,
    get: vi.fn(async () => ({}) as chrome.tabGroups.TabGroup),
    update: vi.fn(async () => ({}) as chrome.tabGroups.TabGroup),
    ...overrides.tabGroups,
  },
  windows: {
    getAll: vi.fn(async () => []),
    ...overrides.windows,
  },
})

export type ChromeStubShape = {
  tabs: {
    query: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    move: ReturnType<typeof vi.fn>
    group: ReturnType<typeof vi.fn>
    ungroup: ReturnType<typeof vi.fn>
    getCurrent: ReturnType<typeof vi.fn>
  }
  tabGroups: {
    TAB_GROUP_ID_NONE: number
    get: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  windows: {
    getAll: ReturnType<typeof vi.fn>
  }
}

export const installChromeStub = (stub: ChromeStubShape): ChromeStubShape => {
  ;(globalThis as unknown as { chrome: unknown }).chrome = stub
  return stub
}

// Baseline so any import that touches `chrome` at module-load time doesn't crash.
installChromeStub(makeChromeStub())
