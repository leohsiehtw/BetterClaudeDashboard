const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** Own pixel-style mascot sketch (not an official asset): legs shuffle while busy, eyes blink when idle. */
export function mascot(now: number, busy: boolean): string[] {
  const t = Math.floor(now / 1000)
  const eyes = busy ? (t % 2 === 0 ? '▘ ▝' : '▖ ▗') : t % 6 === 0 ? '▁ ▁' : '▘ ▝'
  const legs = busy ? (t % 2 === 0 ? '▘▘ ▝▝' : ' ▘▝▘ ') : '▘▘ ▝▝'

  return [' ▗▟█████▙▖', `▐█ ${eyes} █▌`, ` ▝▜█████▛▘`, `   ${legs}`]
}

export type Mood = 'idle' | 'laptop' | 'walk' | 'hop' | 'read' | 'search' | 'bulb' | 'coffee'

export const MOODS: Mood[] = ['laptop', 'walk', 'hop', 'read', 'search', 'bulb', 'coffee']

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
.look{animation:look 7s ease-in-out infinite}.hi{animation:hi 9s ease-in-out infinite}
@keyframes zz{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}60%{opacity:1;transform:translate(6px,-8px)}80%,100%{opacity:0;transform:translate(10px,-14px)}}
@keyframes look{0%,40%{transform:translateX(0)}45%,60%{transform:translateX(-4px)}65%,85%{transform:translateX(4px)}90%,100%{transform:translateX(0)}}
@keyframes hi{0%,70%{transform:translateY(0)}72%,76%{transform:translateY(-10px)}78%,82%{transform:translateY(-4px)}84%,100%{transform:translateY(0)}}`,
    laptop: `.tap{animation:tap .3s ease-in-out infinite}
.k1{animation:code 1.6s steps(1,end) infinite}.k2{animation:code 1.6s steps(1,end) infinite .5s}.k3{animation:code 1.6s steps(1,end) infinite 1s}
.cur{animation:cur .6s steps(1,end) infinite}
@keyframes tap{0%{transform:translateY(-4px)}50%{transform:translateY(0)}}
@keyframes code{0%{transform:scaleX(.2)}25%{transform:scaleX(.5)}50%{transform:scaleX(.8)}75%{transform:scaleX(1)}100%{transform:scaleX(.3)}}
@keyframes cur{0%{opacity:1}50%{opacity:0}}`,
    walk: `.w{animation:walk 5s ease-in-out infinite}.d1,.d2,.d3{animation:dot 1.2s steps(1,end) infinite}.d2{animation-delay:.4s}.d3{animation-delay:.8s}
@keyframes walk{0%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(-24px)}50%{transform:translateX(-12px)}60%{transform:translateX(0)}70%{transform:translateX(12px)}85%{transform:translateX(24px)}95%{transform:translateX(12px)}}
@keyframes dot{0%{opacity:.15}33%{opacity:1}66%{opacity:1}100%{opacity:.15}}`,
    hop: `.w{animation:hop 1s ease-in-out infinite}.sp{animation:sp 1s steps(1,end) infinite}
@keyframes hop{0%{transform:translateY(0)}25%{transform:translateY(-10px)}50%{transform:translateY(-14px)}75%{transform:translateY(-6px)}}
@keyframes sp{0%{opacity:0}30%{opacity:1}70%{opacity:1}100%{opacity:0}}`,
    search: `.mg{animation:mg 3s ease-in-out infinite}.look2{animation:l2 3s ease-in-out infinite}
@keyframes mg{0%{transform:translateX(0)}25%{transform:translateX(20px)}50%{transform:translateX(40px)}75%{transform:translateX(20px)}}
@keyframes l2{0%{transform:translateX(-3px)}25%{transform:translateX(0)}50%{transform:translateX(3px)}75%{transform:translateX(0)}}`,
    bulb: `.bl{animation:glow 1s steps(1,end) infinite}.ry{animation:ray 1s steps(1,end) infinite}
@keyframes glow{0%{opacity:.35}50%{opacity:1}}
@keyframes ray{0%{opacity:0}50%{opacity:1}}`,
    coffee: `.st1,.st2{animation:steam 1.6s steps(1,end) infinite}.st2{animation-delay:.8s}.nod{animation:nod 1.6s ease-in-out infinite}
@keyframes steam{0%{transform:translateY(0);opacity:0}25%{transform:translateY(-3px);opacity:1}50%{transform:translateY(-7px);opacity:1}75%{transform:translateY(-11px);opacity:0}}
@keyframes nod{0%{transform:translateY(0)}50%{transform:translateY(2px)}}`,
    read: `.pg{animation:pg 1.2s ease-in-out infinite}.nod{animation:nod 1.2s ease-in-out infinite}
@keyframes pg{0%{transform:scaleX(1)}50%{transform:scaleX(.4)}}
@keyframes nod{0%{transform:translateY(0)}50%{transform:translateY(2px)}}`,
  }
  const extras: Record<Mood, string> = {
    idle: `<text class="z1" x="108" y="22" font-size="14" font-family="monospace" font-weight="bold" fill="#9aa3b2">z</text><text class="z2" x="108" y="22" font-size="11" font-family="monospace" font-weight="bold" fill="#9aa3b2">z</text>`,
    laptop: `<g transform="translate(112,24)"><rect x="0" y="0" width="64" height="40" fill="#2b3038"/><rect x="4" y="4" width="56" height="32" fill="#161a20"/>
<rect class="k1" x="8" y="9" width="40" height="3" fill="#2fb36b" style="transform-box:fill-box;transform-origin:left"/>
<rect class="k2" x="8" y="16" width="32" height="3" fill="#5aa9ff" style="transform-box:fill-box;transform-origin:left"/>
<rect class="k3" x="8" y="23" width="44" height="3" fill="#f5a524" style="transform-box:fill-box;transform-origin:left"/>
<rect class="cur" x="52" y="28" width="4" height="5" fill="#fbf3ec"/><rect x="-6" y="40" width="76" height="6" fill="#9aa3b2"/></g><rect x="92" y="48" width="34" height="9" fill="#d97757"/><rect class="tap" x="122" y="52" width="12" height="13" fill="#d97757"/>`,
    walk: '',
    hop: `<rect class="sp" x="14" y="10" width="5" height="5" fill="#f5a524"/><rect class="sp" x="168" y="16" width="5" height="5" fill="#5aa9ff"/><rect class="sp" x="150" y="4" width="4" height="4" fill="#2fb36b"/><rect class="sp" x="30" y="2" width="4" height="4" fill="#d63a3a"/>`,
    search: `<g class="mg"><g transform="translate(46,40)"><rect x="0" y="0" width="16" height="3" fill="#5aa9ff"/><rect x="0" y="13" width="16" height="3" fill="#5aa9ff"/><rect x="0" y="0" width="3" height="16" fill="#5aa9ff"/><rect x="13" y="0" width="3" height="16" fill="#5aa9ff"/><rect x="3" y="3" width="10" height="10" fill="#5aa9ff" opacity=".25"/><rect x="16" y="16" width="8" height="4" fill="#9aa3b2"/></g></g>`,
    bulb: `<g class="bl"><rect x="76" y="2" width="14" height="12" fill="#f5a524"/><rect x="79" y="14" width="8" height="3" fill="#9aa3b2"/></g><rect class="ry" x="70" y="4" width="3" height="3" fill="#f5a524"/><rect class="ry" x="93" y="4" width="3" height="3" fill="#f5a524"/><rect class="ry" x="82" y="-2" width="3" height="3" fill="#f5a524"/>`,
    coffee: `<g transform="translate(112,50)"><rect x="0" y="0" width="16" height="16" fill="#fbf3ec"/><rect x="16" y="4" width="5" height="8" fill="none" stroke="#fbf3ec" stroke-width="2"/><rect x="2" y="2" width="12" height="4" fill="#7a4a2b"/></g><rect class="st1" x="116" y="42" width="3" height="5" fill="#9aa3b2"/><rect class="st2" x="123" y="42" width="3" height="5" fill="#9aa3b2"/>`,
    read: `<g transform="translate(60,50)"><rect x="0" y="0" width="32" height="22" fill="#fbf3ec"/><rect x="15" y="0" width="2" height="22" fill="#9aa3b2"/><rect class="pg" x="17" y="0" width="15" height="22" fill="#e9dfd3" style="transform-box:fill-box;transform-origin:left"/><rect x="4" y="5" width="9" height="2" fill="#9aa3b2"/><rect x="4" y="10" width="9" height="2" fill="#9aa3b2"/><rect x="4" y="15" width="9" height="2" fill="#9aa3b2"/></g>`,
  }
  const rightArm =
    mood === 'laptop'
      ? ''
      : `<rect class="a2" x="76" y="24" width="16" height="12" fill="${C}"/>`
  const shift = mood === 'laptop' ? 14 : 41
  const topMarks = mood === 'walk' ? dots : ''
  const outer = mood === 'walk' || mood === 'hop' ? 'w' : ''
  const head = mood === 'read' || mood === 'coffee' ? 'nod' : mood === 'idle' ? 'look' : mood === 'search' ? 'look2' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="190" height="90" shape-rendering="crispEdges"><style>
.b{animation:bob ${bob} ease-in-out infinite}
.p1{animation:step ${step} ease-in-out infinite}.p2{animation:step ${step} ease-in-out infinite reverse}
.e{animation:blink 3.6s steps(1,end) infinite;transform-box:fill-box;transform-origin:center}
.a1{animation:wave ${bob} ease-in-out infinite}.a2{animation:wave ${bob} ease-in-out infinite reverse}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-${busy ? 4 : 2}px)}}
@keyframes step{0%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}94%,98%{transform:scaleY(0.15)}}
@keyframes wave{0%{transform:translateY(0)}50%{transform:translateY(-6px)}}
${css[mood]}
</style><g transform="translate(${shift},12)"><g class="${outer}">${topMarks}<g class="b">
<g class="${mood === 'idle' ? 'hi' : ''}"><rect class="a1" x="12" y="24" width="16" height="12" fill="${C}"/></g>
${rightArm}
<rect x="28" y="8" width="48" height="44" fill="${C}"/>
<g class="${head}"><rect class="e" x="40" y="16" width="6" height="9" fill="#1a1a1a"/><rect class="e" x="58" y="16" width="6" height="9" fill="#1a1a1a"/></g>
<rect class="p1" x="30" y="52" width="6" height="14" fill="${C}"/><rect class="p2" x="42" y="52" width="6" height="14" fill="${C}"/>
<rect class="p2" x="58" y="52" width="6" height="14" fill="${C}"/><rect class="p1" x="70" y="52" width="6" height="14" fill="${C}"/><rect class="p2" x="80" y="48" width="8" height="16" fill="${C}"/>
</g></g></g>${extras[mood]}</svg>`
}

export function spin(now: number): string {
  return SPIN[Math.floor(now / 1000) % SPIN.length] ?? '⠋'
}
