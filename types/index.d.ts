export type DashWindow = { kind: string; percentUsed: number; resetsAt?: string }
export type DashAutoCompact = { isEnabled: boolean; thresholdTokens?: number }
export type DashUsage = {
  measuredAt: number
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: DashWindow[]
  autoCompact?: DashAutoCompact
  costUsd?: number
  model?: string
  turns?: number
  categories?: { name: string; tokens: number; kind: string }[]
  /** the window the breakdown is measured against, in tokens */
  windowTokens?: number
  /** how many memory files, MCP tools and custom agents the breakdown lists */
  counts?: { memory?: number; mcp?: number; agents?: number }
}
export type DashAgent = {
  id: string
  name: string
  type: string
  description: string
  status: string
  startedAt: number
  endedAt?: number
}
/** tool.check verdicts seen on real calls, plus the classic permission events. */
export type DashChecks = {
  allow: number
  ask: number
  deny: number
  /** asks raised while the permission mode was `auto` (the classifier decides those) */
  auto: number
  /** classic PermissionRequest: a permission dialog was put up */
  prompted: number
  /** classic PermissionDenied */
  autoDenied: number
  /** asked calls whose tool.call has not resolved yet */
  open: number
}
export type DashTurn = {
  startedAt?: number
  endedAt?: number
  lastMs?: number
  calls: number
  edits: number
  errors: number
}
export type DashActivity = {
  /** when this mod first saw this session start in this process (not the resumed session's first launch) */
  sessionStartedAt: number
  mode?: string
  effort?: string
  checks: DashChecks
  groups: { file: number; shell: number; other: number }
  tools: Record<string, number>
  turn: DashTurn
  edits: number
  errors: number
  /** summed output tokens of each subagent's turns (turn.complete usage) */
  agentOut: Record<string, { out: number; model?: string }>
}
/** Card order and which cards are folded, kept across reloads. */
export type DashLayout = { order: string[]; collapsed: string[] }
export type DashLogEntry = { at: number; name: string; text: string; tone: 'info' | 'ok' | 'warn' | 'err' }

declare module 'claude-code' {
  interface PluginState {
    'better-claude-dashboard': {
      usage: Shaped<DashUsage>
      agents: Shaped<DashAgent[]>
      now: number
      activity: Shaped<DashActivity>
      log: Shaped<DashLogEntry[]>
      layout: Shaped<DashLayout>
    }
  }
}
