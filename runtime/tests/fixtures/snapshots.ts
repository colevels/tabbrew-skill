import type { SnapshotPayload } from '../../src/snapshot'

// Single window, 5 tabs. tab 1 pinned, tabs 3+4 in group 100, tab 5 ungrouped.
export const singleWindowPayload = (): SnapshotPayload => ({
  windows: [{ id: 10, focused: true, tabCount: 5 }],
  groups: [{ id: 100, windowId: 10, title: 'Work', tabCount: 2 }],
  tabs: [
    { id: 1, index: 0, pinned: true, title: 'Pinned', url: 'a.com', windowId: 10 },
    { id: 2, index: 1, pinned: false, title: 'Two', url: 'b.com', windowId: 10 },
    { id: 3, index: 2, pinned: false, title: 'Three', url: 'c.com', windowId: 10, groupId: 100 },
    { id: 4, index: 3, pinned: false, title: 'Four', url: 'd.com', windowId: 10, groupId: 100 },
    { id: 5, index: 4, pinned: false, title: 'Five', url: 'e.com', windowId: 10 },
  ],
  allowCrossWindow: false,
})

// Two windows: window 10 has tabs 1-3, window 20 has tabs 4-5.
export const twoWindowsPayload = (): SnapshotPayload => ({
  windows: [
    { id: 10, focused: true, tabCount: 3 },
    { id: 20, focused: false, tabCount: 2 },
  ],
  groups: [],
  tabs: [
    { id: 1, index: 0, pinned: false, title: 'W10-A', url: 'a.com', windowId: 10 },
    { id: 2, index: 1, pinned: false, title: 'W10-B', url: 'b.com', windowId: 10 },
    { id: 3, index: 2, pinned: false, title: 'W10-C', url: 'c.com', windowId: 10 },
    { id: 4, index: 0, pinned: false, title: 'W20-A', url: 'd.com', windowId: 20 },
    { id: 5, index: 1, pinned: false, title: 'W20-B', url: 'e.com', windowId: 20 },
  ],
  allowCrossWindow: true,
})
