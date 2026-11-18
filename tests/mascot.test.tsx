import { expect, test } from 'claude-code/testing'

import { mascotSvg, spin } from '../hooks/mascot'

test('optional art is either empty or an SVG under the size limit', async () => {
  for (const busy of [false, true]) {
    const svg = mascotSvg(busy)
    expect(svg === '' || (svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length < 131_072)).toBe(true)
  }
})

test('the spinner cycles through ten frames', async () => {
  expect(new Set(Array.from({ length: 10 }, (_, i) => spin(i * 1000))).size).toBe(10)
})
