import { expect, test } from 'claude-code/testing'

import { MASCOT_SVG, moodFor, spin } from '../hooks/mascot'

test('idle stays idle, busy rotates through four moods every 8 seconds', async () => {
  expect(moodFor(123_456, false)).toBe('idle')
  const seen = new Set([0, 1, 2, 3].map(i => moodFor(i * 8000, true)))
  expect([...seen].sort()).toEqual(['hop', 'laptop', 'read', 'walk'])
})

test('every mood is a well-formed SVG under the size limit', async () => {
  for (const mood of ['idle', 'laptop', 'walk', 'hop', 'read'] as const) {
    const svg = MASCOT_SVG(mood)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg.length).toBeLessThan(131_072)
  }
})

test('the spinner cycles through ten frames', async () => {
  expect(new Set(Array.from({ length: 10 }, (_, i) => spin(i * 1000))).size).toBe(10)
})
