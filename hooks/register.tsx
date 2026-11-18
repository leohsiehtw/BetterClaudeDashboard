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
  DashLogEntry,
  DashUsage,
  DashWindow,
} from '../types'

const PANE = 'claudecode-dashboard'
const TITLE = 'Usage'
const DONE: readonly string[] = ['completed', 'failed', 'killed']
const KEEP_FINISHED = 5
const TICK_MS = 1_000
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** Own pixel-style mascot sketch (not an official asset): legs shuffle while busy, eyes blink when idle. */
function mascot(now: number, busy: boolean): string[] {
  const t = Math.floor(now / 1000)
  const eyes = busy ? (t % 2 === 0 ? '▘ ▝' : '▖ ▗') : t % 6 === 0 ? '▁ ▁' : '▘ ▝'
  const legs = busy ? (t % 2 === 0 ? '▘▘ ▝▝' : ' ▘▝▘ ') : '▘▘ ▝▝'

  return [' ▗▟█████▙▖', `▐█ ${eyes} █▌`, ` ▝▜█████▛▘`, `   ${legs}`]
}

type Mood = 'idle' | 'laptop' | 'walk' | 'hop' | 'read'

const MOODS: Mood[] = ['laptop', 'walk', 'hop', 'read']

function moodFor(now: number, busy: boolean): Mood {
  return busy ? (MOODS[Math.floor(now / 8000) % MOODS.length] ?? 'laptop') : 'idle'
}

const MASCOT_SVG = (mood: Mood): string => {
  const busy = mood !== 'idle'
  const bob = busy ? '0.5s' : '2.4s'
  const step = busy ? '0.4s' : '1.6s'
  const C = '#d97757'
  const dots = `<rect class="d1" x="64" y="0" width="6" height="6" fill="${C}"/><rect class="d2" x="76" y="0" width="6" height="6" fill="${C}"/><rect class="d3" x="88" y="0" width="6" height="6" fill="${C}"/>`
  const css: Record<Mood, string> = {
    idle: `.z1,.z2{animation:zz 4s steps(1,end) infinite;opacity:0}.z2{animation-delay:2s}
.look{animation:look 7s steps(1,end) infinite}.hi{animation:hi 9s steps(1,end) infinite}
@keyframes zz{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}60%{opacity:1;transform:translate(6px,-8px)}80%,100%{opacity:0;transform:translate(10px,-14px)}}
@keyframes look{0%,40%{transform:translateX(0)}45%,60%{transform:translateX(-4px)}65%,85%{transform:translateX(4px)}90%,100%{transform:translateX(0)}}
@keyframes hi{0%,70%{transform:translateY(0)}72%,76%{transform:translateY(-10px)}78%,82%{transform:translateY(-4px)}84%,100%{transform:translateY(0)}}`,
    laptop: `.tap{animation:tap .3s steps(1,end) infinite}
.k1{animation:code 1.6s steps(1,end) infinite}.k2{animation:code 1.6s steps(1,end) infinite .5s}.k3{animation:code 1.6s steps(1,end) infinite 1s}
.cur{animation:cur .6s steps(1,end) infinite}
@keyframes tap{0%{transform:translateY(-4px)}50%{transform:translateY(0)}}
@keyframes code{0%{transform:scaleX(.2)}25%{transform:scaleX(.5)}50%{transform:scaleX(.8)}75%{transform:scaleX(1)}100%{transform:scaleX(.3)}}
@keyframes cur{0%{opacity:1}50%{opacity:0}}`,
    walk: `.w{animation:walk 5s steps(1,end) infinite}.d1,.d2,.d3{animation:dot 1.2s steps(1,end) infinite}.d2{animation-delay:.4s}.d3{animation-delay:.8s}
@keyframes walk{0%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(-24px)}50%{transform:translateX(-12px)}60%{transform:translateX(0)}70%{transform:translateX(12px)}85%{transform:translateX(24px)}95%{transform:translateX(12px)}}
@keyframes dot{0%{opacity:.15}33%{opacity:1}66%{opacity:1}100%{opacity:.15}}`,
    hop: `.w{animation:hop 1s steps(1,end) infinite}.sp{animation:sp 1s steps(1,end) infinite}
@keyframes hop{0%{transform:translateY(0)}25%{transform:translateY(-10px)}50%{transform:translateY(-14px)}75%{transform:translateY(-6px)}}
@keyframes sp{0%{opacity:0}30%{opacity:1}70%{opacity:1}100%{opacity:0}}`,
    read: `.pg{animation:pg 1.2s steps(1,end) infinite}.nod{animation:nod 1.2s steps(1,end) infinite}
@keyframes pg{0%{transform:scaleX(1)}50%{transform:scaleX(.4)}}
@keyframes nod{0%{transform:translateY(0)}50%{transform:translateY(2px)}}`,
  }
  const extras: Record<Mood, string> = {
    idle: `<text class="z1" x="108" y="22" font-size="14" font-family="monospace" font-weight="bold" fill="#9aa3b2">z</text><text class="z2" x="108" y="22" font-size="11" font-family="monospace" font-weight="bold" fill="#9aa3b2">z</text>`,
    laptop: `<g transform="translate(112,24)"><rect x="0" y="0" width="64" height="40" fill="#2b3038"/><rect x="4" y="4" width="56" height="32" fill="#161a20"/>
<rect class="k1" x="8" y="9" width="40" height="3" fill="#2fb36b" style="transform-box:fill-box;transform-origin:left"/>
<rect class="k2" x="8" y="16" width="32" height="3" fill="#5aa9ff" style="transform-box:fill-box;transform-origin:left"/>
<rect class="k3" x="8" y="23" width="44" height="3" fill="#f5a524" style="transform-box:fill-box;transform-origin:left"/>
<rect class="cur" x="52" y="28" width="4" height="5" fill="#fbf3ec"/><rect x="-6" y="40" width="76" height="6" fill="#9aa3b2"/></g><rect x="102" y="52" width="24" height="9" fill="#d97757"/><rect class="tap" x="122" y="52" width="12" height="13" fill="#d97757"/>`,
    walk: '',
    hop: `<rect class="sp" x="14" y="10" width="5" height="5" fill="#f5a524"/><rect class="sp" x="168" y="16" width="5" height="5" fill="#5aa9ff"/><rect class="sp" x="150" y="4" width="4" height="4" fill="#2fb36b"/><rect class="sp" x="30" y="2" width="4" height="4" fill="#d63a3a"/>`,
    read: `<g transform="translate(60,50)"><rect x="0" y="0" width="32" height="22" fill="#fbf3ec"/><rect x="15" y="0" width="2" height="22" fill="#9aa3b2"/><rect class="pg" x="17" y="0" width="15" height="22" fill="#e9dfd3" style="transform-box:fill-box;transform-origin:left"/><rect x="4" y="5" width="9" height="2" fill="#9aa3b2"/><rect x="4" y="10" width="9" height="2" fill="#9aa3b2"/><rect x="4" y="15" width="9" height="2" fill="#9aa3b2"/></g>`,
  }
  const rightArm =
    mood === 'laptop'
      ? ''
      : `<rect class="a2" x="96" y="28" width="16" height="14" fill="${C}"/>`
  const shift = mood === 'laptop' ? 6 : 33
  const topMarks = mood === 'walk' ? dots : ''
  const outer = mood === 'walk' || mood === 'hop' ? 'w' : ''
  const head = mood === 'read' ? 'nod' : mood === 'idle' ? 'look' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="190" height="90" shape-rendering="crispEdges"><style>
.b{animation:bob ${bob} steps(2,end) infinite}
.p1{animation:step ${step} steps(1,end) infinite}.p2{animation:step ${step} steps(1,end) infinite reverse}
.e{animation:blink 3.6s steps(1,end) infinite;transform-box:fill-box;transform-origin:center}
.a1{animation:wave ${bob} steps(1,end) infinite}.a2{animation:wave ${bob} steps(1,end) infinite reverse}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-${busy ? 4 : 2}px)}}
@keyframes step{0%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}94%,98%{transform:scaleY(0.15)}}
@keyframes wave{0%{transform:translateY(0)}50%{transform:translateY(-6px)}}
${css[mood]}
</style><g transform="translate(${shift},12)"><g class="${outer}">${topMarks}<g class="b">
<g class="${mood === 'idle' ? 'hi' : ''}"><rect class="a1" x="8" y="28" width="16" height="14" fill="${C}"/></g>
${rightArm}
<rect x="24" y="8" width="72" height="40" fill="${C}"/>
<g class="${head}"><rect class="e" x="40" y="20" width="8" height="14" fill="#1a1a1a"/><rect class="e" x="72" y="20" width="8" height="14" fill="#1a1a1a"/></g>
<rect class="p1" x="32" y="48" width="8" height="16" fill="${C}"/><rect class="p2" x="48" y="48" width="8" height="16" fill="${C}"/>
<rect class="p1" x="64" y="48" width="8" height="16" fill="${C}"/><rect class="p2" x="80" y="48" width="8" height="16" fill="${C}"/>
</g></g></g>${extras[mood]}</svg>`
}

function spin(now: number): string {
  return SPIN[Math.floor(now / 1000) % SPIN.length] ?? '⠋'
}
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
const usage = atom({ plugin: 'claudecode-dashboard', key: 'usage' } as const, EMPTY_USAGE, {
  shape: 'usage-3',
})
const agents = atom({ plugin: 'claudecode-dashboard', key: 'agents' } as const, [], {
  shape: 'agents-1',
})
const clockNow = atom({ plugin: 'claudecode-dashboard', key: 'now' } as const, 0)
const activity = atom({ plugin: 'claudecode-dashboard', key: 'activity' } as const, emptyActivity(0), {
  shape: 'activity-1',
})
const eventLog = atom({ plugin: 'claudecode-dashboard', key: 'log' } as const, [], {
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
          name: 'claudecode-dashboard',
          description: 'Open the usage dashboard pane: plan limits, context, subagents',
          immediate: true,
        }),
      undefined,
    )

    return next(e)
  })

  on('command.run', { command: 'claudecode-dashboard' }, async $ => {
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
    const { Box, Text } = $.ui.resolve(e)
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
    const art =
      e.surface === 'desktop' ? (
        (() => {
          const { Svg } = $.ui.resolve(e)

          return <Svg source={MASCOT_SVG(moodFor(now, isBusy))} alt="Mascot" isInteractive />
        })()
      ) : (
        mascot(now, isBusy).map((line, i) => (
          <Text key={String(i)} color={ORANGE}>
            {line}
          </Text>
        ))
      )

    return (
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="column" alignItems="center">
          {art}
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor={ORANGE} paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold color={ORANGE}>
              SESSION
            </Text>
            <Text dimColor wrap="wrap">
              {uptime !== undefined ? `up ${uptime}` : snap.measuredAt === 0 ? 'waiting' : 'live'}
            </Text>
          </Box>
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
          {snap.categories !== undefined && snap.categories.length > 0 && (
            <Text dimColor wrap="wrap">
              {snap.categories.map(cat => `${cat.name} ${fmtCompact(cat.tokens)}`).join(' · ')}
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
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor={TEAL} paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold color={TEAL}>
              TURN
            </Text>
            <Text color={turnRunning ? AMBER : TRACK} wrap="wrap">
              {turnHead}
            </Text>
          </Box>
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
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor={AMBER} paddingX={1}>
          <Text bold color={AMBER}>
            PERMISSIONS
          </Text>
          <Text wrap="wrap">
            <Text color={GREEN}>{`✓ ${c.allow} allow`}</Text>
            <Text dimColor> · </Text>
            <Text color={AMBER}>{`? ${c.ask} ask`}</Text>
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
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor={INDIGO} paddingX={1}>
          <Text bold color={INDIGO} wrap="wrap">
            {`AGENTS · ${live.length} running · ${rows.length} total`}
          </Text>
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
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor={BLUE} paddingX={1}>
          <Text bold color={BLUE}>
            SESSION LOG
          </Text>
          {shownLog.length === 0 && <Text dimColor>No events yet.</Text>}
          {shownLog.map(entry => (
            <Text wrap="wrap">
              <Text dimColor>{`${fmtClock(entry.at)} `}</Text>
              <Text color={toneColor(entry.tone)}>{entry.name}</Text>
              <Text dimColor>{entry.text === '' ? '' : ` ${entry.text}`}</Text>
            </Text>
          ))}
        </Box>
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
    decision === 'allow' ? undefined : { at, name: 'check', text: decision, tone: decision === 'deny' ? 'err' : 'warn' },
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
function toolLabel(tool: string, input: unknown): string {
  const args = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const str = (key: string): string | undefined => {
    const v = args[key]

    return typeof v === 'string' && v !== '' ? v : undefined
  }
  if (SHELL_TOOLS.includes(tool)) {
    const first = (str('command') ?? '').trim().split(/\s+/)[0] ?? ''

    return clip(baseName(first), 18)
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
    if (!opened.isPlaced) $.ui.log(`claudecode-dashboard: pane waits: ${opened.reason}`, { to: 'debug' })
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
        .filter(c => !c.isDeferred && !/free|buffer/i.test(c.name) && c.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 4)
        .map(c => ({ name: c.name, tokens: c.tokens }))
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
  $.ui.log(`claudecode-dashboard: ${String(error)}`, { to: 'debug' })
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
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(s % 60)}s`

  return `${s}s`
}

/** Minute granularity: the clock atom only ticks per minute while nothing runs. */
function fmtUptime(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(min / 60)

  return h > 0 ? `${h}h ${pad(min % 60)}m` : `${min}m`
}

function fmtClock(at: number): string {
  const d = new Date(at)

  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtCountdown(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${pad(min % 60)}m`

  return `${min}m`
}
