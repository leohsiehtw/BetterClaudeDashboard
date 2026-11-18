import { expect, test } from 'claude-code/testing'

import { MASCOT_SVG, MOODS, moodFor, spin } from '../hooks/mascot'

test('idle stays idle and busy rotates through every mood', async () => {
  expect(moodFor(123_456, false)).toBe('idle')
  expect(new Set(MOODS.map((_, i) => moodFor(i * 8000, true))).size).toBe(MOODS.length)
})

test('every mood is a well-formed SVG under the size limit', async () => {
  for (const mood of ['idle', ...MOODS] as const) {
    const svg = MASCOT_SVG(mood)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg.length).toBeLessThan(131_072)
  }
})

test('the spinner cycles through ten frames', async () => {
  expect(new Set(Array.from({ length: 10 }, (_, i) => spin(i * 1000))).size).toBe(10)
})
