import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'claudecode-dashboard',
  component: 'Pane',
  requestId: 'claudecode-dashboard',
  props: {
    title: 'Usage',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const WIDGET = { ...PANE, props: { ...PANE.props, placement: 'widget' } } as const

test('the pane draws before any reading, on terminal and desktop', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /No subagents yet/ }))?.text).toBe('No subagents yet.')
    await ui.unmount()
  }
})

test('the new cards draw before any data, on terminal and desktop', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /PERMISSIONS$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /TURN$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^no turn yet$/ }))?.text).toBe('no turn yet')
    expect(await ui.find({ type: 'Text', text: /SESSION LOG$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /No events yet/ }))?.text).toBe('No events yet.')
    expect((await ui.find({ type: 'Text', text: /no tool calls yet/ }))?.text).toBe('no tool calls yet')
    await ui.unmount()
  }
})

test('the widget glance draws on desktop', async $ => {
  const ui = await $.ui.mount({ ...WIDGET, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /subagents active/ }))?.text).toBe('no subagents active')
  await ui.unmount()
})

test('a card folds when its arrow is pressed and opens again', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^last turn/ })).toBeTruthy()
  await ui.press({ plugin: 'claudecode-dashboard', key: 'turn-fold' })
  expect(await ui.find({ type: 'Text', text: /^last turn/ })).toBeFalsy()
  await ui.press({ plugin: 'claudecode-dashboard', key: 'turn-fold' })
  expect(await ui.find({ type: 'Text', text: /^last turn/ })).toBeTruthy()
  await ui.unmount()
})
