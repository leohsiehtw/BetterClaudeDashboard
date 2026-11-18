import { atom, read, update } from 'claude-code'
import type {
  AgentInfo,
  EngineInterface,
  Register,
  SessionContextUsage,
  SessionRateLimit,
  Timer,
} from 'claude-code'

import type {
  DashActivity,
  DashAgent,
  DashAutoCompact,
  DashLayout,
  DashLogEntry,
  DashUsage,
  DashWindow,
} from '../types'
import { MASCOT_SVG, moodFor, spin } from './mascot'

const PANE = 'better-claude-dashboard'
const CARD_IDS = ['session', 'context', 'turn', 'permissions', 'agents', 'log']

function normalizeOrder(order: string[]): string[] {
  return [...order.filter(id => CARD_IDS.includes(id)), ...CARD_IDS.filter(id => !order.includes(id))]
}
const TITLE = 'Usage'
const DONE: readonly string[] = ['completed', 'failed', 'killed']
const KEEP_FINISHED = 5
const TICK_MS = 1_000
const USAGE_EVERY_TICKS = 3
const BREAKDOWN_EVERY_MS = 60_000
const BREAKDOWN_RETRY_MS = 5_000
const FLUSH_MS = 500
const LOG_CAP = 40
const LOG_SHOWN = 12
const TOOLS_CAP = 30
const AGENT_OUT_CAP = 20

const FILE_TOOLS: readonly string[] = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'NotebookEdit']
const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell']
const EDIT_TOOLS: readonly string[] = ['Edit', 'Write', 'NotebookEdit']

const EMPTY_USAGE: DashUsage = { measuredAt: 0, context: { window: 0 }, rateLimits: [] }

function emptyActivity(sessionStartedAt: number): DashActivity {
  return {
    sessionStartedAt,
    checks: { allow: 0, ask: 0, deny: 0, auto: 0, prompted: 0, autoDenied: 0, open: 0 },
    groups: { file: 0, shell: 0, other: 0 },
    tools: {},
    turn: { calls: 0, edits: 0, errors: 0 },
    edits: 0,
    errors: 0,
    agentOut: {},
  }
}

// Change a shape tag whenever that value's type in ../types changes.
const usage = atom({ plugin: 'better-claude-dashboard', key: 'usage' } as const, EMPTY_USAGE, {
  shape: 'usage-4',
})
const agents = atom({ plugin: 'better-claude-dashboard', key: 'agents' } as const, [], {
  shape: 'agents-1',
})
const clockNow = atom({ plugin: 'better-claude-dashboard', key: 'now' } as const, 0)
const activity = atom({ plugin: 'better-claude-dashboard', key: 'activity' } as const, emptyActivity(0), {
  shape: 'activity-1',
})
const layoutAtom = atom({ plugin: 'better-claude-dashboard', key: 'layout' } as const, { order: [], collapsed: [] } as DashLayout, {
  shape: 'layout-1',
})
const eventLog = atom({ plugin: 'better-claude-dashboard', key: 'log' } as const, [], {
  shape: 'log-1',
})

// Timer bookkeeping and not-yet-flushed deltas only (never drawn from); a reload drops them.
let ticker: Timer | undefined
let isTicking = false
let ticks = 0
let breakdownAt = 0
let flushTimer: Timer | undefined
let pendingOps: ((a: DashActivity) => void)[] = []
let pendingLog: DashLogEntry[] = []
const askedIds = new Set<string>()

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    ticker?.cancel()
    ticks = 0
    const now = await $.clock.now()
    // A reload keeps the atom (it is set already); a fresh process starts it at 0.
    await attempt(
      $,
      () => update($, activity, cur => (cur.sessionStartedAt > 0 ? cur : emptyActivity(now))),
      undefined,
    )
    ticker = $.clock.every(TICK_MS, () => void tick($))
    void tick($)
    void openPane($)
    await attempt(
      $,
      () =>
        $.command.register({
          name: 'better-claude-dashboard',
          description: 'Open the usage dashboard pane: plan limits, context, subagents',
          immediate: true,
        }),
      undefined,
    )

    return next(e)
  })

  on('command.run', { command: 'better-claude-dashboard' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return {
      text: opened.isPlaced
        ? 'Usage dashboard opened.'
        : `Usage dashboard waits to be drawn: ${opened.reason}`,
    }
  })

  on('session.measure', async ($, e, next) => {
    await attempt($, () => refreshUsage($), undefined)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await attempt($, () => update($, agents, () => []), [])
      const now = await attempt($, () => $.clock.now(), 0)
      pendingOps = []
      pendingLog = []
      askedIds.clear()
      await attempt($, () => update($, activity, () => emptyActivity(now)), undefined)
      await attempt($, () => update($, eventLog, () => []), [])
    }

    return next(e)
  })

  // Observers below: each only records, then passes the event through unchanged.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    await attempt($, () => noteCheck($, e.tool_use_id, verdict.decision), undefined)

    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await attempt($, () => noteCallStart($, e.tool, toolLabel(e.tool, e)), undefined)
    const ran = await next(e)
    await attempt($, () => noteCallEnd($, e.tool, e.tool_use_id, ran.isError === true), undefined)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await attempt($, () => noteTurnStart($), undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await attempt(
      $,
      () =>
        noteTurnEnd($, e.agentId, e.durationMs, e.reason, e.usage?.output_tokens, e.usage?.model),
      undefined,
    )

    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    noteMode($, e.permission_mode, undefined)

    return next(e)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    noteMode($, e.permission_mode, e.effort?.level)

    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    noteMode($, e.permission_mode, e.effort?.level)

    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    noteMode($, e.permission_mode, e.effort?.level)
    queue($, a => {
      a.checks.prompted += 1
    })

    return next(e)
  })

  on('classic.PermissionDenied', async ($, e, next) => {
    const at = await attempt($, () => $.clock.now(), 0)
    queue(
      $,
      a => {
        a.checks.autoDenied += 1
      },
      { at, name: e.tool_name, text: 'denied', tone: 'err' },
    )

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const layout = await read($, layoutAtom)
    const order = normalizeOrder(layout.order)
    const collapsedIds = new Set(layout.collapsed)
    const toggleCard = (id: string): void =>
      void update($, layoutAtom, cur => ({
        order: normalizeOrder(cur.order),
        collapsed: cur.collapsed.includes(id) ? cur.collapsed.filter(x => x !== id) : [...cur.collapsed, id],
      }))
    const moveCard = (id: string, delta: number): void =>
      void update($, layoutAtom, cur => {
        const next = normalizeOrder(cur.order)
        const i = next.indexOf(id)
        const j = i + delta
        const other = next[j]
        const mine = next[i]
        if (i >= 0 && other !== undefined && mine !== undefined) {
          next[i] = other
          next[j] = mine
        }

        return { order: next, collapsed: cur.collapsed }
      })
    const snap = await read($, usage)
    const rows = await read($, agents)
    const now = await read($, clockNow)
    const live = rows.filter(row => row.endedAt === undefined)
    const ctx = snap.context
    const ctxPercent =
      ctx.percent ??
      (ctx.tokens !== undefined && ctx.window > 0
        ? Math.round((ctx.tokens / ctx.window) * 100)
        : undefined)
    const activeText =
      live.length === 0
        ? 'no subagents active'
        : `${live.length} subagent${live.length === 1 ? '' : 's'} active`

    if (e.props.placement === 'widget') {
      const glance = snap.rateLimits
        .filter(w => w.kind === 'five_hour' || w.kind === 'seven_day')
        .map(w => `${w.kind === 'five_hour' ? '5h' : 'wk'} ${w.percentUsed}%`)
      if (ctxPercent !== undefined) glance.push(`ctx ${ctxPercent}%`)

      return (
        <Box flexDirection="column">
          <Text>{glance.length === 0 ? 'Usage: waiting for a reading' : glance.join(' · ')}</Text>
          <Text dimColor>{activeText}</Text>
        </Box>
      )
    }

    const act = await read($, activity)
    const log = await read($, eventLog)
    const ctxPct = ctxPercent ?? 0
    const uptime =
      act.sessionStartedAt > 0 && now >= act.sessionStartedAt
        ? fmtUptime(now - act.sessionStartedAt)
        : undefined
    const modeLine = [snap.model, act.mode, act.effort === undefined ? undefined : `effort ${act.effort}`]
      .filter(part => part !== undefined && part !== '')
      .join(' · ')
    const statLine = [
      snap.turns === undefined ? undefined : `${snap.turns} turns`,
      snap.costUsd === undefined ? undefined : `$${snap.costUsd.toFixed(2)}`,
    ]
      .filter(part => part !== undefined)
      .join(' · ')
    const turn = act.turn
    const turnRunning = turn.startedAt !== undefined && turn.endedAt === undefined
    const turnHead =
      turn.startedAt === undefined
        ? 'no turn yet'
        : turnRunning
          ? `${spin(now)} running ${fmtElapsed(Math.max(0, now - turn.startedAt))}`
          : 'idle'
    const c = act.checks
    const topTools = Object.entries(act.tools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, n]) => `${shortTool(name)} ${n}`)
      .join(' · ')
    const shownLog = log.slice(-LOG_SHOWN)
    const isBusy = turnRunning || live.length > 0
    const cats = snap.categories ?? []
    const win = snap.windowTokens ?? ctx.window
    const share = (tokens: number): string => (win > 0 ? `${((tokens / win) * 100).toFixed(1)}%` : '')
    const swatches = [BLUE, ORANGE, TEAL, AMBER, INDIGO, RED, GREEN, TRACK]
    const used = cats.filter(c => c.kind === 'used').sort((x, y) => y.tokens - x.tokens)
    const rest = cats.filter(c => c.kind !== 'used')
    const COLS = 20
    const ROWS = 5
    const cellsTotal = COLS * ROWS
    const gridCells: { color: string; filled: boolean }[] = []
    const addCells = (n: number, color: string, filled: boolean): void => {
      for (let i = 0; i < n && gridCells.length < cellsTotal; i += 1) gridCells.push({ color, filled })
    }
    used.forEach((c, n) => {
      const cells = win > 0 ? Math.max(c.tokens > 0 ? 1 : 0, Math.round((c.tokens / win) * cellsTotal)) : 0
      addCells(cells, swatches[n % swatches.length] ?? TRACK, true)
    })
    rest
      .filter(c => c.kind === 'buffer')
      .forEach(c => addCells(Math.max(1, Math.round((c.tokens / Math.max(win, 1)) * cellsTotal)), AMBER, true))
    while (gridCells.length < cellsTotal) gridCells.push({ color: TRACK, filled: false })
    const contextBar = (
      <Box flexDirection="column">
        {Array.from({ length: ROWS }, (_, r) => (
          <Text key={String(r)}>
            {gridCells.slice(r * COLS, (r + 1) * COLS).map((cell, i) => (
              <Text key={String(i)} color={cell.color}>
                {cell.filled ? '■' : '□'}
              </Text>
            ))}
          </Text>
        ))}
        <Text bold>{`${ctxPct}% used`}</Text>
      </Box>
    )
    const contextRows = [
      ...used.map((c, n) => ({ c, color: swatches[n % swatches.length] ?? TRACK, dim: false })),
      ...rest.map(c => ({ c, color: TRACK, dim: true })),
    ].map(({ c, color, dim }) => (
      <Box key={c.name} justifyContent="space-between">
        <Box>
          <Text color={color}>■ </Text>
          <Text dimColor={dim} wrap="wrap">
            {c.name}
          </Text>
        </Box>
        <Text dimColor>{c.kind === 'deferred' ? fmtCompact(c.tokens) : `${fmtCompact(c.tokens)} ${share(c.tokens)}`}</Text>
      </Box>
    ))
    const artSource = MASCOT_SVG(moodFor(now, isBusy))
    const art =
      e.surface === 'desktop'
        ? (() => {
            const { Svg } = $.ui.resolve(e)

            return <Svg source={artSource} alt="Mascot" isInteractive />
          })()
        : null

    const card = (id: string, title: string, color: string, hint: JSX.Element | null, body: JSX.Element): JSX.Element => {
      const isFolded = collapsedIds.has(id)
      const at = order.indexOf(id)

      return (
        <Box key={id} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
          <Box justifyContent="space-between">
            <Button key={`${id}-fold`} onPress={() => toggleCard(id)}>
              <Text bold color={color}>{`${isFolded ? '▸' : '▾'} ${title}`}</Text>
            </Button>
            <Box>
              {hint}
              {hint !== null && <Text> </Text>}
              {at > 0 && (
                <Button key={`${id}-up`} onPress={() => moveCard(id, -1)}>
                  <Text dimColor>{' ↑ '}</Text>
                </Button>
              )}
              {at < order.length - 1 && (
                <Button key={`${id}-down`} onPress={() => moveCard(id, 1)}>
                  <Text dimColor>{' ↓ '}</Text>
                </Button>
              )}
            </Box>
          </Box>
          {!isFolded && body}
        </Box>
      )
    }
    const cards: Record<string, JSX.Element | null> = {
      session: card(
        'session',
        'SESSION',
        ORANGE,
        <Text dimColor wrap="wrap">
          {uptime !== undefined ? `up ${uptime}` : snap.measuredAt === 0 ? 'waiting' : 'live'}
        </Text>,
        <Box flexDirection="column">
          <Text wrap="wrap">{modeLine !== '' ? modeLine : 'model · waiting for a reading'}</Text>
          {statLine !== '' && <Text dimColor wrap="wrap">{statLine}</Text>}
          {ctx.tokens === undefined ? (
            <Text dimColor>ctx · no reading yet (fills after the next response)</Text>
          ) : (
            <Text wrap="wrap">
              <Text dimColor>ctx </Text>
              <Text color={levelColor(ctxPct)}>{barFill(ctxPct)}</Text>
              <Text color={TRACK}>{barRest(ctxPct)}</Text>
              <Text bold>{` ${ctxPct}%`}</Text>
            </Text>
          )}
          {ctx.tokens !== undefined && (
            <Text dimColor wrap="wrap">{`    ${fmtCompact(ctx.tokens)} / ${fmtCompact(ctx.window)} tokens`}</Text>
          )}
          {snap.autoCompact !== undefined && (
            <Text dimColor wrap="wrap">
              {autoCompactText(snap.autoCompact, ctx.window)}
            </Text>
          )}
          {snap.measuredAt !== 0 && snap.rateLimits.length === 0 && (
            <Text dimColor>plan limits · no reading yet (subscription only)</Text>
          )}
          {snap.rateLimits.map(w => (
            <Box flexDirection="column">
              <Text wrap="wrap">
                <Text dimColor>{`${shortWindow(w.kind)}  `}</Text>
                <Text color={levelColor(w.percentUsed)}>{barFill(w.percentUsed)}</Text>
                <Text color={TRACK}>{barRest(w.percentUsed)}</Text>
                <Text bold>{` ${w.percentUsed}%`}</Text>
              </Text>
              {resetText(w.resetsAt, now) !== '' && (
                <Text dimColor wrap="wrap">{`    ${resetText(w.resetsAt, now)}`}</Text>
              )}
            </Box>
          ))}
        </Box>,
      ),
      context:
        contextRows.length === 0
          ? null
          : card(
              'context',
              'CONTEXT',
              CYAN,
              <Text dimColor>{`${ctx.tokens === undefined ? '?' : fmtCompact(ctx.tokens)} / ${fmtCompact(snap.windowTokens ?? ctx.window)}`}</Text>,
              <Box flexDirection="column">
                {contextBar}
                {contextRows}
                {snap.counts !== undefined && Object.keys(snap.counts).length > 0 && (
                  <Text dimColor wrap="wrap">
                    {[
                      snap.counts.mcp === undefined ? '' : `MCP tools ${snap.counts.mcp}`,
                      snap.counts.memory === undefined ? '' : `memory files ${snap.counts.memory}`,
                      snap.counts.agents === undefined ? '' : `agents ${snap.counts.agents}`,
                    ]
                      .filter(part => part !== '')
                      .join(' · ')}
                  </Text>
                )}
              </Box>,
            ),
      turn: card(
        'turn',
        'TURN',
        TEAL,
        <Text color={turnRunning ? AMBER : TRACK} wrap="wrap">{turnHead}</Text>,
        <Box flexDirection="column">
          <Text wrap="wrap">
            <Text dimColor>calls </Text>
            <Text bold>{String(turn.calls)}</Text>
            <Text dimColor> · edits </Text>
            <Text bold>{String(turn.edits)}</Text>
            <Text dimColor> · errors </Text>
            <Text bold color={turn.errors > 0 ? RED : GREEN}>
              {String(turn.errors)}
            </Text>
          </Text>
          <Text dimColor wrap="wrap">
            {`last turn ${turn.lastMs === undefined ? '—' : fmtElapsed(turn.lastMs)}`}
          </Text>
          <Text dimColor wrap="wrap">
            {`session edits ${act.edits} · errors ${act.errors}`}
          </Text>
        </Box>,
      ),
      permissions: card(
        'permissions',
        'PERMISSIONS',
        AMBER,
        null,
        <Box flexDirection="column">
          <Text wrap="wrap">
            <Text color={GREEN}>{`✓ ${c.allow} allow`}</Text>
            <Text dimColor> · </Text>
            <Text color={AMBER}>{`? ${Math.max(0, c.ask - c.auto)} ask`}</Text>
            <Text dimColor> · </Text>
            <Text color={RED}>{`✗ ${c.deny + c.autoDenied} deny`}</Text>
          </Text>
          <Text dimColor wrap="wrap">
            {`classifier ${c.auto} · prompted ${c.prompted} · pending ${c.open}`}
          </Text>
          <Text wrap="wrap">
            <Text dimColor>file </Text>
            <Text bold>{String(act.groups.file)}</Text>
            <Text dimColor> · shell </Text>
            <Text bold>{String(act.groups.shell)}</Text>
            <Text dimColor> · other </Text>
            <Text bold>{String(act.groups.other)}</Text>
          </Text>
          <Text dimColor wrap="wrap">
            {topTools !== '' ? topTools : 'no tool calls yet'}
          </Text>
        </Box>,
      ),
      agents: card(
        'agents',
        `AGENTS · ${live.length} running · ${rows.length} total`,
        INDIGO,
        null,
        <Box flexDirection="column">
          {rows.length === 0 && <Text dimColor>No subagents yet.</Text>}
          <Box flexDirection="column" gap="sm">
            {rows.map(row => {
              const used = act.agentOut[row.id]
              const isLive = row.endedAt === undefined
              const isBad = row.status === 'failed' || row.status === 'killed'

              return (
                <Box
                  flexDirection="column"
                  borderStyle="round"
                  borderColor={isLive ? AMBER : isBad ? RED : TRACK}
                  paddingX={1}
                >
                  <Text bold wrap="wrap">
                    {row.name}
                  </Text>
                  <Text dimColor wrap="wrap">
                    {row.description === '' || row.description === row.name
                      ? row.type
                      : `${row.type} · ${row.description}`}
                  </Text>
                  <Text color={isLive ? AMBER : isBad ? RED : GREEN} wrap="wrap">
                    {`${isLive ? `${spin(now)} ` : isBad ? '✗ ' : '✓ '}${fmtElapsed((row.endedAt ?? now) - row.startedAt)}`}
                    <Text dimColor>{` · ${row.status}`}</Text>
                  </Text>
                  {used !== undefined && (
                    <Text dimColor wrap="wrap">
                      {`out ${fmtCompact(used.out)} tok${used.model === undefined ? '' : ` · ${used.model}`}`}
                    </Text>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>,
      ),
      log: card(
        'log',
        'SESSION LOG',
        BLUE,
        null,
        <Box flexDirection="column">
          {shownLog.length === 0 && <Text dimColor>No events yet.</Text>}
          {shownLog.map(entry => (
            <Text wrap="wrap">
              <Text dimColor>{`${fmtClock(entry.at)} `}</Text>
              <Text color={toneColor(entry.tone)}>{entry.name}</Text>
              <Text dimColor>{entry.text === '' ? '' : ` ${entry.text}`}</Text>
            </Text>
          ))}
        </Box>,
      ),
    }

    return (
      <Box flexDirection="column" gap="sm">
        {art !== null && (
          <Box flexDirection="column" alignItems="center">
            {art}
          </Box>
        )}
        {order.map(id => cards[id] ?? null)}
      </Box>
    )
  })

  // A person who closes the pane has no slash command on the desktop app, so a row above
  // the prompt keeps a button that opens it again (a press is an asked open, placed at any width).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Button
          key="open-usage"
          label="Usage ▸"
          onPress={() => void attempt($, () => $.ui.open({ id: PANE, title: TITLE }), undefined)}
        />
      </Box>
    )
  })
}

// ---- event accumulation (deltas flushed to the atoms at most every FLUSH_MS) ----

function queue($: EngineInterface, op: ((a: DashActivity) => void) | undefined, entry?: DashLogEntry): void {
  if (op !== undefined) pendingOps.push(op)
  if (entry !== undefined) pendingLog.push(entry)
  if (flushTimer !== undefined) return
  flushTimer = $.clock.after(FLUSH_MS, () => {
    flushTimer = undefined
    void attempt($, () => flush($), undefined)
  })
}

async function flush($: EngineInterface): Promise<void> {
  const ops = pendingOps
  const entries = pendingLog
  pendingOps = []
  pendingLog = []
  if (ops.length > 0) {
    await update($, activity, cur => {
      const next: DashActivity = JSON.parse(JSON.stringify(cur))
      for (const op of ops) op(next)

      return next
    })
  }
  if (entries.length > 0) {
    await update($, eventLog, cur => [...cur, ...entries].slice(-LOG_CAP))
  }
}

async function noteCheck($: EngineInterface, id: string | undefined, decision: string): Promise<void> {
  // A `$.tool.check` query carries no id: only real calls count.
  if (id === undefined) return
  if (decision === 'ask') askedIds.add(id)
  const open = askedIds.size
  const at = await $.clock.now()
  const isAuto = (await read($, activity)).mode === 'auto'
  queue(
    $,
    a => {
      if (decision === 'allow') a.checks.allow += 1
      else if (decision === 'deny') a.checks.deny += 1
      else {
        a.checks.ask += 1
        if (a.mode === 'auto') a.checks.auto += 1
      }
      a.checks.open = open
    },
    decision === 'allow' || (decision === 'ask' && isAuto)
      ? undefined
      : { at, name: 'check', text: decision, tone: decision === 'deny' ? 'err' : 'warn' },
  )
}

async function noteCallStart($: EngineInterface, tool: string, label: string): Promise<void> {
  const at = await $.clock.now()
  const group = FILE_TOOLS.includes(tool) ? 'file' : SHELL_TOOLS.includes(tool) ? 'shell' : 'other'
  const isEdit = EDIT_TOOLS.includes(tool)
  queue(
    $,
    a => {
      a.groups[group] += 1
      if (a.tools[tool] !== undefined || Object.keys(a.tools).length < TOOLS_CAP) {
        a.tools[tool] = (a.tools[tool] ?? 0) + 1
      }
      a.turn.calls += 1
      if (isEdit) {
        a.turn.edits += 1
        a.edits += 1
      }
    },
    // Agent spawns get their own log line from the agent list.
    tool === 'Agent' || tool === 'Task' ? undefined : { at, name: shortTool(tool), text: label, tone: 'info' },
  )
}

async function noteCallEnd(
  $: EngineInterface,
  tool: string,
  id: string | undefined,
  isError: boolean,
): Promise<void> {
  if (id !== undefined) askedIds.delete(id)
  const open = askedIds.size
  const at = await $.clock.now()
  queue(
    $,
    a => {
      a.checks.open = open
      if (isError) {
        a.turn.errors += 1
        a.errors += 1
      }
    },
    isError ? { at, name: shortTool(tool), text: 'error', tone: 'err' } : undefined,
  )
}

async function noteTurnStart($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  queue(
    $,
    a => {
      a.turn = { startedAt: at, calls: 0, edits: 0, errors: 0, ...(a.turn.lastMs === undefined ? {} : { lastMs: a.turn.lastMs }) }
    },
    { at, name: 'turn', text: 'started', tone: 'info' },
  )
  await flush($)
}

async function noteTurnEnd(
  $: EngineInterface,
  agentId: string | undefined,
  durationMs: number,
  reason: string,
  outTokens: number | undefined,
  model: string | undefined,
): Promise<void> {
  const at = await $.clock.now()
  if (agentId !== undefined) {
    if (outTokens === undefined) return
    queue($, a => {
      const prev = a.agentOut[agentId]
      if (prev === undefined && Object.keys(a.agentOut).length >= AGENT_OUT_CAP) {
        const oldest = Object.keys(a.agentOut)[0]
        if (oldest !== undefined) delete a.agentOut[oldest]
      }
      a.agentOut[agentId] = {
        out: (prev?.out ?? 0) + outTokens,
        ...(model === undefined ? {} : { model: shortModel(model) }),
      }
    })

    return
  }
  queue(
    $,
    a => {
      a.turn.endedAt = at
      a.turn.lastMs = durationMs
    },
    {
      at,
      name: 'turn',
      text: `${reason === 'answer' ? 'done' : reason} ${fmtElapsed(durationMs)}`,
      tone: reason === 'answer' ? 'ok' : reason === 'aborted' ? 'warn' : 'err',
    },
  )
  await flush($)
}

function noteMode($: EngineInterface, mode: string | undefined, effort: string | undefined): void {
  if (mode === undefined && effort === undefined) return
  queue($, a => {
    if (mode !== undefined) a.mode = mode
    if (effort !== undefined) a.effort = effort
  })
}

/** A short, non-sensitive label: a file's basename or a command's first word, never the input itself. */
const SUBCOMMAND: readonly string[] = ['git', 'npm', 'pnpm', 'yarn', 'docker', 'gh', 'pip', 'claude', 'cargo', 'go']

function toolLabel(tool: string, input: unknown): string {
  const args = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const str = (key: string): string | undefined => {
    const v = args[key]

    return typeof v === 'string' && v !== '' ? v : undefined
  }
  if (SHELL_TOOLS.includes(tool)) {
    const parts = (str('command') ?? '')
      .split(/&&|\|\||;|\|/)
      .map(part => part.trim().split(/\s+/))
      .filter(words => (words[0] ?? '') !== '')
    const main = parts.find(words => words[0] !== 'cd') ?? parts[0] ?? []
    const first = baseName(main[0] ?? '')
    const second = main[1] !== undefined && SUBCOMMAND.includes(first) ? ` ${main[1]}` : ''

    return clip(`${first}${second}`, 20)
  }
  const path = str('file_path') ?? str('notebook_path') ?? str('path')

  return path === undefined ? '' : clip(baseName(path), 24)
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(part => part !== '')

  return parts[parts.length - 1] ?? p
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function shortTool(tool: string): string {
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__')

    return clip(parts[parts.length - 1] ?? tool, 14)
  }

  return clip(tool, 14)
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

// ---- polling ----

let wasLive = false

async function tick($: EngineInterface): Promise<void> {
  if (isTicking) return
  isTicking = true
  try {
    const now = await $.clock.now()
    const rows = await attempt($, () => refreshAgents($, now), [])
    if (ticks % USAGE_EVERY_TICKS === 0) await attempt($, () => refreshUsage($), undefined)
    ticks += 1
    await attempt($, () => flush($), undefined)
    const act = await read($, activity)
    const shown = await read($, clockNow)
    const isLive =
      rows.some(row => row.endedAt === undefined) ||
      (act.turn.startedAt !== undefined && act.turn.endedAt === undefined)
    if (isLive || wasLive || Math.floor(shown / 60_000) !== Math.floor(now / 60_000)) {
      await update($, clockNow, () => now)
    }
    wasLive = isLive
  } catch (error) {
    logError($, error)
  } finally {
    isTicking = false
  }
}

async function openPane($: EngineInterface): Promise<void> {
  try {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    if (!opened.isPlaced) $.ui.log(`better-claude-dashboard: pane waits: ${opened.reason}`, { to: 'debug' })
  } catch (error) {
    logError($, error)
  }
}

async function refreshAgents($: EngineInterface, now: number): Promise<DashAgent[]> {
  const list = await $.agent.list()
  const prev = await read($, agents)
  const merged = mergeAgents(prev, list, now)
  if (JSON.stringify(merged) !== JSON.stringify(prev)) {
    for (const row of merged) {
      const old = prev.find(p => p.id === row.id)
      if (old === undefined) {
        pendingLog.push({ at: now, name: clip(row.name, 16), text: 'spawned', tone: 'info' })
      }
      if (row.endedAt !== undefined && (old === undefined || old.endedAt === undefined)) {
        const isBad = row.status === 'failed' || row.status === 'killed'
        pendingLog.push({
          at: now,
          name: clip(row.name, 16),
          text: `${isBad ? row.status : 'done'} ${fmtElapsed(row.endedAt - row.startedAt)}`,
          tone: isBad ? 'err' : 'ok',
        })
      }
    }
    await update($, agents, current => mergeAgents(current, list, now))
  }

  return merged
}

function mergeAgents(prev: readonly DashAgent[], list: readonly AgentInfo[], now: number): DashAgent[] {
  const listed = new Set(list.map(info => info.id))
  const rows: DashAgent[] = list.map(info => {
    const old = prev.find(row => row.id === info.id)
    const endedAt = DONE.includes(info.status) ? (old?.endedAt ?? now) : undefined

    return {
      id: info.id,
      name: info.name ?? info.type,
      type: info.type,
      description: info.description,
      status: info.status,
      startedAt: old?.startedAt ?? now,
      ...(endedAt === undefined ? {} : { endedAt }),
    }
  })
  for (const old of prev) {
    if (!listed.has(old.id)) rows.push(old.endedAt === undefined ? { ...old, status: 'ended', endedAt: now } : old)
  }
  const active = rows.filter(row => row.endedAt === undefined).sort((a, b) => a.startedAt - b.startedAt)
  const finished = rows
    .filter(row => row.endedAt !== undefined)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, KEEP_FINISHED)

  return [...active, ...finished]
}

async function refreshUsage($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const prev = await read($, usage)
  const plain = await $.session.usage()
  const turns = await attempt($, () => $.session.turns(), prev.turns)
  let autoCompact: DashAutoCompact | undefined = prev.autoCompact
  let model: string | undefined = prev.model
  let categories: DashUsage['categories'] = prev.categories
  let windowTokens: number | undefined = prev.windowTokens
  let counts: DashUsage['counts'] = prev.counts
  const wait = autoCompact === undefined ? BREAKDOWN_RETRY_MS : BREAKDOWN_EVERY_MS
  if (plain.context.window !== prev.context.window || now - breakdownAt >= wait) {
    breakdownAt = now
    const breakdown = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
    if (breakdown !== undefined) {
      autoCompact = {
        isEnabled: breakdown.isAutoCompactEnabled,
        ...(breakdown.autoCompactThreshold === undefined
          ? {}
          : { thresholdTokens: breakdown.autoCompactThreshold }),
      }
      model = breakdown.model
      categories = breakdown.categories
        .filter(c => c.tokens > 0)
        .map(c => ({ name: c.name, tokens: c.tokens, kind: c.kind }))
      windowTokens = breakdown.rawMaxTokens
      counts = {
        ...(breakdown.memoryFiles.length > 0 ? { memory: breakdown.memoryFiles.length } : {}),
        ...(breakdown.mcpTools.length > 0 ? { mcp: breakdown.mcpTools.length } : {}),
        ...(breakdown.agents.length > 0 ? { agents: breakdown.agents.length } : {}),
      }
    }
  }
  if (model === undefined) model = await attempt($, () => $.session.model(), undefined)
  const fresh: DashUsage = {
    measuredAt: now,
    context: toContext(plain.context),
    rateLimits: plain.rateLimits.map(toWindow),
    ...(autoCompact === undefined ? {} : { autoCompact }),
    ...(plain.cost === undefined ? {} : { costUsd: plain.cost.usd }),
    ...(model === undefined ? {} : { model }),
    ...(turns === undefined ? {} : { turns }),
    ...(categories === undefined ? {} : { categories }),
    ...(windowTokens === undefined ? {} : { windowTokens }),
    ...(counts === undefined ? {} : { counts }),
  }
  if (prev.measuredAt !== 0 && sameReading(prev, fresh)) return
  await update($, usage, () => fresh)
}

function sameReading(a: DashUsage, b: DashUsage): boolean {
  return JSON.stringify({ ...a, measuredAt: 0 }) === JSON.stringify({ ...b, measuredAt: 0 })
}

function toContext(c: SessionContextUsage): DashUsage['context'] {
  return {
    window: c.window,
    ...(c.tokens === undefined ? {} : { tokens: c.tokens }),
    ...(c.percent === undefined ? {} : { percent: c.percent }),
  }
}

function toWindow(w: SessionRateLimit): DashWindow {
  return {
    kind: w.kind,
    percentUsed: w.percentUsed,
    ...(w.resetsAt === undefined ? {} : { resetsAt: w.resetsAt }),
  }
}

async function attempt<T>($: EngineInterface, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    logError($, error)

    return fallback
  }
}

function logError($: EngineInterface, error: unknown): void {
  $.ui.log(`better-claude-dashboard: ${String(error)}`, { to: 'debug' })
}

// ---- formatting ----

const BAR_CELLS = 10

function filledCells(percent: number): number {
  return Math.max(0, Math.min(BAR_CELLS, Math.round((percent / 100) * BAR_CELLS)))
}

function barFill(percent: number): string {
  return '▰'.repeat(filledCells(percent))
}

function barRest(percent: number): string {
  return '▱'.repeat(BAR_CELLS - filledCells(percent))
}

function shortWindow(kind: string): string {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return '7d'
  if (kind === 'spend_limit') return '$ '

  return kind.slice(0, 2)
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`

  return String(Math.round(n))
}

const GREEN = '#1f9d55'
const AMBER = '#c77800'
const RED = '#d63a3a'
const TRACK = '#9aa3b2'
const ORANGE = '#c8582f'
const INDIGO = '#4f56d9'
const TEAL = '#0e8f84'
const BLUE = '#2f6fe0'
const CYAN = '#0b7285'

function levelColor(percent: number): string {
  return percent >= 90 ? RED : percent >= 70 ? AMBER : GREEN
}

function toneColor(tone: DashLogEntry['tone']): string {
  return tone === 'ok' ? GREEN : tone === 'warn' ? AMBER : tone === 'err' ? RED : INDIGO
}

function autoCompactText(ac: DashAutoCompact, window: number): string {
  if (!ac.isEnabled) return 'auto-compact: off'
  if (ac.thresholdTokens === undefined) return 'auto-compact: on'
  const share = window > 0 ? ` (${Math.round((ac.thresholdTokens / window) * 100)}%)` : ''

  return `auto-compact at ${fmtCompact(ac.thresholdTokens)}${share}`
}

function resetText(resetsAt: string | undefined, now: number): string {
  if (resetsAt === undefined || now === 0) return ''
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) return ''

  return at <= now ? 'resetting' : `resets in ${fmtCountdown(at - now)}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hrs = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(s % 60)}s`

  return `${s}s`
}

/** Minute granularity: the clock atom only ticks per minute while nothing runs. */
function fmtUptime(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000))
  const hrs = Math.floor(min / 60)

  return hrs > 0 ? `${hrs}h ${pad(min % 60)}m` : `${min}m`
}

function fmtClock(at: number): string {
  const d = new Date(at)

  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtCountdown(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000))
  const d = Math.floor(min / 1440)
  const hrs = Math.floor((min % 1440) / 60)
  if (d > 0) return `${d}d ${hrs}h`
  if (hrs > 0) return `${hrs}h ${pad(min % 60)}m`

  return `${min}m`
}
