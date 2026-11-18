import { VIDEO_IDLE, VIDEO_PLAY } from './mascot-video'

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spin(now: number): string {
  return SPIN[Math.floor(now / 1000) % SPIN.length] ?? '⠋'
}

/** Optional local art: SVG strings in hooks/mascot-video.ts. The committed file holds empty strings, so nothing is drawn. */
export function mascotSvg(busy: boolean): string {
  const play: string = VIDEO_PLAY
  const idle: string = VIDEO_IDLE

  return busy ? play : idle
}
