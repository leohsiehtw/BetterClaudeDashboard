import { expect, mock, test } from 'claude-code/testing'

import { LOCALES, detectLocale, nextLocale, strings } from '../hooks/i18n'

const PANE = {
  plugin: 'better-claude-dashboard',
  component: 'Pane',
  requestId: 'better-claude-dashboard',
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
  await ui.press({ plugin: 'better-claude-dashboard', key: 'turn-fold' })
  expect(await ui.find({ type: 'Text', text: /^last turn/ })).toBeFalsy()
  await ui.press({ plugin: 'better-claude-dashboard', key: 'turn-fold' })
  expect(await ui.find({ type: 'Text', text: /^last turn/ })).toBeTruthy()
  await ui.unmount()
})

test('a card is picked up by its handle and dropped by another handle', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /moving/ })).toBeFalsy()
  await ui.press({ plugin: 'better-claude-dashboard', key: 'turn-grip' })
  expect(await ui.find({ type: 'Text', text: /moving turn/ })).toBeTruthy()
  await ui.press({ plugin: 'better-claude-dashboard', key: 'log-grip' })
  expect(await ui.find({ type: 'Text', text: /moving/ })).toBeFalsy()
  await ui.unmount()
})

test('the language button cycles every locale and back to English', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /PERMISSIONS$/ })).toBeTruthy()
  for (const title of ['權限', '权限', '権限', '권한', 'PERMISSIONS']) {
    await ui.press({ plugin: 'better-claude-dashboard', key: 'lang' })
    expect(await ui.find({ type: 'Text', text: new RegExp(`${title}$`) })).toBeTruthy()
  }
  await ui.unmount()
})

test('locale detection maps env and setting spellings', async () => {
  expect(detectLocale('zh_TW.UTF-8')).toBe('zh-TW')
  expect(detectLocale('zh-Hant')).toBe('zh-TW')
  expect(detectLocale('Traditional Chinese')).toBe('zh-TW')
  expect(detectLocale('zh_CN.UTF-8')).toBe('zh-CN')
  expect(detectLocale('简体中文')).toBe('zh-CN')
  expect(detectLocale('ja_JP.UTF-8')).toBe('ja')
  expect(detectLocale('japanese')).toBe('ja')
  expect(detectLocale('ko_KR.UTF-8')).toBe('ko')
  expect(detectLocale('en_US.UTF-8')).toBe('en')
  expect(detectLocale('C.UTF-8')).toBeUndefined()
  expect(detectLocale('fr_FR.UTF-8')).toBeUndefined()
  expect(detectLocale(undefined)).toBeUndefined()
})

test('every locale has card titles and unknown codes fall back to English', async () => {
  for (const code of LOCALES) {
    const S = strings(code)
    for (const t of [S.session, S.context, S.turn, S.permissions, S.log]) expect(t.length > 0).toBe(true)
  }
  expect(strings('xx').permissions).toBe('PERMISSIONS')
  expect(nextLocale('ko')).toBe('en')
  expect(nextLocale('')).toBe('zh-TW')
})
