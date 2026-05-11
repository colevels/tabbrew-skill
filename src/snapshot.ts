export type TabSnapshot = {
  id: number
  index: number
  pinned: boolean
  title: string
  url: string
  windowId: number
  groupId?: number
  active?: boolean
}

export type GroupSnapshot = {
  id: number
  windowId: number
  title: string
  color?: string
  tabCount: number
}

export type WindowSnapshot = {
  id: number
  focused: boolean
  tabCount: number
}

export type SnapshotPayload = {
  tabs: TabSnapshot[]
  groups: GroupSnapshot[]
  windows: WindowSnapshot[]
  allowCrossWindow: boolean
}

export type SnapshotOptions = { crossWindow: boolean }
export type SnapshotResult = { snapshot: string; payload: SnapshotPayload }

const yn = (b: boolean) => (b ? 'yes' : 'no')

// Drops http(s):// and leading www. then caps at MAX_URL_LEN with an
// ellipsis so pathological URLs do not balloon input tokens when shipped
// to the model.
const MAX_URL_LEN = 80
export const compactUrl = (raw: string): string => {
  if (!raw) return ''
  const stripped = raw.replace(/^https?:\/\/(www\.)?/i, '')
  const normalized = stripped === raw ? raw : stripped
  return normalized.length > MAX_URL_LEN ? normalized.slice(0, MAX_URL_LEN - 1) + '…' : normalized
}

// Strips leading "(N) " unread/notification badges from tab titles
// (X/Twitter, YouTube, Gmail).
export const stripCountPrefix = (raw: string): string => raw.replace(/^\(\d+\+?\)\s+/, '')

const isGrouped = (groupId: number | undefined): groupId is number =>
  typeof groupId === 'number' && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE

const windowToJsonl = (w: WindowSnapshot): string =>
  JSON.stringify({ id: w.id, ...(w.focused && { focused: true }), tabCount: w.tabCount })

const groupToJsonl = (g: GroupSnapshot): string =>
  JSON.stringify({ id: g.id, winId: g.windowId, title: g.title, ...(g.color && { color: g.color }), tabCount: g.tabCount })

const tabToJsonl = (t: TabSnapshot): string =>
  JSON.stringify({
    id: t.id,
    idx: t.index,
    ...(t.pinned && { pinned: true }),
    winId: t.windowId,
    ...(t.groupId !== undefined && { groupId: t.groupId }),
    title: stripCountPrefix(t.title),
    url: compactUrl(t.url),
    ...(t.active && { active: true }),
  })

const EMPTY_SNAPSHOT = [
  '# Goal',
  '(describe what you want done)',
  '',
  '# Cross-window: no',
  '',
  '# Windows',
  '_(none)_',
  '',
  '# Groups',
  '_(none)_',
  '',
  '# Tabs',
  '_(none)_',
].join('\n')

export const snapshotCurrentWindow = async (options: SnapshotOptions = { crossWindow: false }): Promise<SnapshotResult> => {
  const { crossWindow } = options

  const allWindows = await chrome.windows.getAll({})
  const focused = allWindows.find((w) => w.focused) ?? allWindows[0]
  if (!focused?.id) {
    return {
      snapshot: EMPTY_SNAPSHOT,
      payload: { tabs: [], groups: [], windows: [], allowCrossWindow: crossWindow },
    }
  }

  // Exclude the tab hosting the executor itself (the extension page calling
  // this snapshot — newtab, popup, options, sidepanel, etc.). Without this,
  // the model can plan ops against the very tab running the executor and
  // kill its own host mid-execution.
  let selfTabId: number | undefined
  try {
    const selfTab = await chrome.tabs.getCurrent()
    selfTabId = typeof selfTab?.id === 'number' ? selfTab.id : undefined
  } catch {
    selfTabId = undefined
  }

  const inScopeWindowIds = crossWindow
    ? (allWindows.map((w) => w.id).filter((id): id is number => typeof id === 'number'))
    : [focused.id]

  const rawTabs = crossWindow ? await chrome.tabs.query({}) : await chrome.tabs.query({ windowId: focused.id })
  const tabs = rawTabs.filter(
    (t) => typeof t.windowId === 'number' && inScopeWindowIds.indexOf(t.windowId) >= 0 && t.id !== selfTabId
  )

  const groupIds = Array.from(new Set(tabs.map((t) => t.groupId).filter(isGrouped))) as number[]
  const groupRecords = await Promise.all(
    groupIds.map(async (gid) => {
      try {
        return await chrome.tabGroups.get(gid)
      } catch {
        return null
      }
    })
  )

  const tabCountByWindow: Record<number, number> = {}
  for (const t of tabs) {
    if (typeof t.windowId === 'number') tabCountByWindow[t.windowId] = (tabCountByWindow[t.windowId] ?? 0) + 1
  }

  const tabCountByGroup: Record<number, number> = {}
  for (const t of tabs) {
    if (isGrouped(t.groupId)) tabCountByGroup[t.groupId] = (tabCountByGroup[t.groupId] ?? 0) + 1
  }

  const windowsPayload: WindowSnapshot[] = allWindows
    .filter((w) => typeof w.id === 'number' && inScopeWindowIds.indexOf(w.id) >= 0)
    .map((w) => ({
      id: w.id as number,
      focused: !!w.focused,
      tabCount: tabCountByWindow[w.id as number] ?? 0,
    }))

  const groupsPayload: GroupSnapshot[] = groupRecords
    .filter((g): g is chrome.tabGroups.TabGroup => g !== null)
    .map((g) => ({
      id: g.id,
      windowId: g.windowId,
      title: g.title || `(group ${g.id})`,
      color: g.color,
      tabCount: tabCountByGroup[g.id] ?? 0,
    }))

  const tabsPayload: TabSnapshot[] = tabs
    .slice()
    .sort((a, b) => (a.windowId - b.windowId) || (a.index - b.index))
    .map((t) => ({
      id: t.id as number,
      index: t.index,
      pinned: !!t.pinned,
      title: t.title || '',
      url: t.url || '',
      windowId: t.windowId as number,
      groupId: isGrouped(t.groupId) ? t.groupId : undefined,
      active: !!t.active,
    }))

  const snapshot = renderSnapshot({ tabs: tabsPayload, groups: groupsPayload, windows: windowsPayload, allowCrossWindow: crossWindow })

  return { snapshot, payload: { tabs: tabsPayload, groups: groupsPayload, windows: windowsPayload, allowCrossWindow: crossWindow } }
}

const renderSnapshot = (p: SnapshotPayload): string => {
  const goalSection = `# Goal\n(describe what you want done)`
  const header = `# Cross-window: ${yn(p.allowCrossWindow)}`

  const windowsSection = (() => {
    const head = `# Windows`
    if (p.windows.length === 0) return [head, '_(none)_'].join('\n')
    return [head, ...p.windows.map(windowToJsonl)].join('\n')
  })()

  const groupsSection = (() => {
    const head = `# Groups`
    if (p.groups.length === 0) return [head, '_(none)_'].join('\n')
    return [head, ...p.groups.map(groupToJsonl)].join('\n')
  })()

  const tabsSection = (() => {
    const head = `# Tabs`
    if (p.tabs.length === 0) return [head, '_(none)_'].join('\n')
    return [head, ...p.tabs.map(tabToJsonl)].join('\n')
  })()

  return [goalSection, '', header, '', windowsSection, '', groupsSection, '', tabsSection].join('\n')
}
