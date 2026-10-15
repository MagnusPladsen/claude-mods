import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { addSample, circleColor, duration, readSettings, stepFor, windowLabel } from './logic'

const HOUR = 60 * 60 * 1000
const RESET_A = Date.parse('2026-10-14T15:00:00.000Z')
const RESET_B = Date.parse('2026-10-14T20:00:00.000Z')

const reading = (limits: { kind: string; percentUsed: number; resetsAt?: number }[]) => ({
  context: { window: 200000 },
  rateLimits: limits.map(l => ({ ...l, resetsAt: l.resetsAt === undefined ? undefined : new Date(l.resetsAt).toISOString() })),
  changed: ['rateLimits' as const],
})

const fiveHour = (percentUsed: number, resetsAt = RESET_A) => reading([{ kind: 'five_hour', percentUsed, resetsAt }])

/** The engine's side for every call the mod makes; returns what it recorded. */
const world = (on: On, now = RESET_A - 3 * HOUR) => {
  mock.store(on)
  const clock = mock.clock(on, { now })
  const toasts: string[] = []
  const notes: string[] = []
  const statuses: (string | undefined)[] = []
  let sounds = 0
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  // The engine's own band when the mod passes: empty.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.notify', (_$, e) => {
    notes.push(e.text)
    return { value: { isSent: true as const, channel: 'kitty' as const } }
  })
  on('ui.status', (_$, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('audio.play', () => {
    sounds++
    return { value: undefined }
  })
  return { clock, toasts, notes, statuses, sounds: () => sounds }
}

test('warns once per 10% step from 50%, and again in a new window', async ($, on) => {
  const w = world(on)

  await $.session.measure(fiveHour(45))
  expect(w.toasts.length).toBe(0)

  await $.session.measure(fiveHour(52))
  expect(w.toasts.length).toBe(1)
  expect(w.toasts[0]).toContain('5h usage at 50%')

  await $.session.measure(fiveHour(55))
  expect(w.toasts.length).toBe(1)

  await $.session.measure(fiveHour(73.5))
  expect(w.toasts.length).toBe(2)
  expect(w.toasts[1]).toContain('70%')
  expect(w.notes.length).toBe(0)
  expect(w.sounds()).toBe(0)

  await $.session.measure(fiveHour(91))
  expect(w.toasts.length).toBe(3)
  expect(w.notes.length).toBe(1)
  expect(w.sounds()).toBe(1)

  await $.session.measure(fiveHour(51, RESET_B))
  expect(w.toasts.length).toBe(4)
  expect(w.toasts[3]).toContain('50%')
})

test('warns for the 7-day window on its own track', async ($, on) => {
  const w = world(on)
  const reset7d = RESET_A + 3 * 24 * HOUR

  await $.session.measure(reading([
    { kind: 'five_hour', percentUsed: 52, resetsAt: RESET_A },
    { kind: 'seven_day', percentUsed: 61, resetsAt: reset7d },
  ]))
  expect(w.toasts.length).toBe(2)
  expect(w.toasts.some(t => t.startsWith('7d usage at 60%'))).toBe(true)
})

test('settings: start, step, 7-day off, no notification, sound on every step', {
  options: { start: '70', step: '5', sevenDay: 'off', notifyAt: 'off', sound: 'every step' },
}, async ($, on) => {
  const w = world(on)

  await $.session.measure(reading([
    { kind: 'five_hour', percentUsed: 65, resetsAt: RESET_A },
    { kind: 'seven_day', percentUsed: 95, resetsAt: RESET_A + 24 * HOUR },
  ]))
  expect(w.toasts.length).toBe(0)

  await $.session.measure(fiveHour(72))
  await $.session.measure(fiveHour(76))
  await $.session.measure(fiveHour(96))
  expect(w.toasts.map(t => t.split(' · ')[0])).toEqual(['5h usage at 70%', '5h usage at 75%', '5h usage at 95%'])
  expect(w.notes.length).toBe(0)
  expect(w.sounds()).toBe(3)
})

test('forecasts 100% before the reset only when the pace gets there', async ($, on) => {
  // Two hours into a five-hour window.
  const w = world(on, RESET_A - 3 * HOUR)

  await $.session.measure(fiveHour(60))
  expect(w.toasts[0]).toContain('on pace for 100%')

  await $.session.measure(fiveHour(30, RESET_B))
  expect(w.toasts.length).toBe(1)
})

test('forecasts from the last hour of samples when there are enough', async ($, on) => {
  // An hour into the window: the average says 50%/h, the last 20 minutes say 3%/h.
  const w = world(on, RESET_A - 4 * HOUR)
  await $.session.measure(fiveHour(49))
  await w.clock.advance(20 * 60 * 1000)
  await $.session.measure(fiveHour(50))
  expect(w.toasts.length).toBe(1)
  expect(w.toasts[0]).not.toContain('on pace')
})

test('status line shows past the start and clears below it', async ($, on) => {
  const w = world(on)

  await $.session.measure(fiveHour(40))
  expect(w.statuses.at(-1)).toBeUndefined()

  await $.session.measure(fiveHour(63))
  expect(w.statuses.at(-1)).toContain('5h 63% · resets in 3h00m')

  await $.session.measure(fiveHour(5, RESET_B))
  expect(w.statuses.at(-1)).toBeUndefined()
})

test('status line off keeps the line untouched', { options: { statusLine: 'off' } }, async ($, on) => {
  const w = world(on)
  await $.session.measure(fiveHour(63))
  expect(w.statuses.length).toBe(0)
})

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
}

test('band: no circle at 0%, one per window in use, colored by threshold', async ($, on) => {
  world(on)
  const reset7d = RESET_A + 3 * 24 * HOUR

  await $.session.measure(reading([
    { kind: 'five_hour', percentUsed: 0, resetsAt: RESET_A },
    { kind: 'seven_day', percentUsed: 0, resetsAt: reset7d },
  ]))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-warn', surface, ...BAND })
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
    await ui.unmount()
  }

  await $.session.measure(reading([
    { kind: 'five_hour', percentUsed: 12, resetsAt: RESET_A },
    { kind: 'seven_day', percentUsed: 64, resetsAt: reset7d },
    { kind: 'seven_day_opus', percentUsed: 91, resetsAt: reset7d },
  ]))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-warn', surface, ...BAND })
    const circles = await ui.findAll({ type: 'Button' })
    expect(circles.map(c => c.key)).toEqual(['usage-five_hour', 'usage-seven_day', 'usage-seven_day_opus'])
    const colors = await ui.findAll({ type: 'Text', text: '●' })
    expect(colors.map(c => c.props.color)).toEqual(['success', 'warning', 'error'])
    await ui.unmount()
  }
})

test('band: details hidden until hovered, pinned by a click, unpinned by another', async ($, on) => {
  world(on)
  await $.session.measure(fiveHour(63))
  const ui = await $.ui.mount({ plugin: 'usage-warn', surface: 'terminal', ...BAND })

  // The details Box is the inner one; the outer row shows the same text.
  const details = async () => (await ui.findAll({ type: 'Box', text: /resets in/ }))[1]
  expect((await details())?.props.display).toBe('none')
  expect((await details())?.text).toContain('5h 63% · resets in 3h00m')

  await ui.press({ key: 'usage-five_hour' })
  expect((await details())?.props.display).toBeUndefined()

  await ui.press({ key: 'usage-five_hour' })
  expect((await details())?.props.display).toBe('none')
})

test('band: circles off draws nothing', { options: { indicator: 'off' } }, async ($, on) => {
  world(on)
  await $.session.measure(fiveHour(63))
  const ui = await $.ui.mount({ plugin: 'usage-warn', surface: 'terminal', ...BAND })
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
})

test('logic: labels and circle colors', async () => {
  const s = readSettings({})
  expect(['five_hour', 'seven_day', 'seven_day_opus', 'spend_limit'].map(windowLabel)).toEqual(['5h', '7d', '7d opus', 'spend_limit'])
  expect([0.1, 49.9, 50, 89.9, 90].map(p => circleColor(p, s))).toEqual(['success', 'success', 'warning', 'warning', 'error'])
  expect(circleColor(75, readSettings({ start: '70', notifyAt: 'off' }))).toBe('warning')
  expect(circleColor(95, readSettings({ notifyAt: 'off' }))).toBe('error')
})

test('logic: steps, durations and sample trimming', async () => {
  const s = readSettings({})
  expect([49.9, 50, 59.9, 60, 99].map(p => stepFor(p, s))).toEqual([0, 50, 50, 60, 90])
  expect([30, 72, 3 * 24 * 60 + 4 * 60].map(m => duration(m * 60_000))).toEqual(['30m', '1h12m', '3d4h'])

  let samples = addSample([], [0, 10])
  samples = addSample(samples, [30_000, 11])
  expect(samples).toEqual([[30_000, 11]])
  samples = addSample(samples, [2 * HOUR, 20])
  expect(samples).toEqual([[2 * HOUR, 20]])
})
