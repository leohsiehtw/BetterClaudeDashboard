const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** Own pixel-style mascot sketch (not an official asset): legs shuffle while busy, eyes blink when idle. */
export function mascot(now: number, busy: boolean): string[] {
  const t = Math.floor(now / 1000)
  const eyes = busy ? (t % 2 === 0 ? '▘ ▝' : '▖ ▗') : t % 6 === 0 ? '▁ ▁' : '▘ ▝'
  const legs = busy ? (t % 2 === 0 ? '▘▘ ▝▝' : ' ▘▝▘ ') : '▘▘ ▝▝'

  return [' ▗▟█████▙▖', `▐█ ${eyes} █▌`, ` ▝▜█████▛▘`, `   ${legs}`]
}

export type Mood = 'idle' | 'laptop' | 'walk' | 'hop' | 'read'

export const MOODS: Mood[] = ['laptop', 'walk', 'hop', 'read']

export function moodFor(now: number, busy: boolean): Mood {
  return busy ? (MOODS[Math.floor(now / 8000) % MOODS.length] ?? 'laptop') : 'idle'
}

export const MASCOT_SVG = (mood: Mood): string => {
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

export function spin(now: number): string {
  return SPIN[Math.floor(now / 1000) % SPIN.length] ?? '⠋'
}
