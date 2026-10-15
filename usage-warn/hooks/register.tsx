import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'
import type { Reading } from '../types'
import {
  addSample,
  circleColor,
  forecastFull,
  isTracked,
  readSettings,
  statusPart,
  stepFor,
  warningText,
  type Sample,
  type Settings,
} from './logic'

type Warned = { window: string; step: number }
type Samples = { window: string; points: Sample[] }

const isWarned = (v: unknown): v is Warned =>
  typeof v === 'object' && v !== null && typeof (v as Warned).window === 'string' && typeof (v as Warned).step === 'number'

const isSamples = (v: unknown): v is Samples =>
  typeof v === 'object' && v !== null && typeof (v as Samples).window === 'string' && Array.isArray((v as Samples).points)

const STATUS_REFRESH_MS = 60_000

// The latest reading of each window, for the band and the status line; in $.state so a reload keeps them.
const readings = atom({ plugin: 'usage-warn', key: 'readings' } as const, [] as Reading[])
// Whether the band's info text is pinned open by a click on a circle.
const isOpen = atom({ plugin: 'usage-warn', key: 'isOpen' } as const, false)

async function drawStatus($: EngineInterface, s: Settings) {
  if (!s.statusLine) return
  const now = await $.clock.now()
  const shown = (await read($, readings)).filter(r => r.percentUsed >= s.start)
  $.ui.status(shown.length ? shown.map(r => statusPart(r, r.fullAt, now)).join('  ·  ') : undefined)
}

async function check($: EngineInterface, s: Settings, limits: readonly SessionRateLimit[]) {
  const now = await $.clock.now()
  const next: Reading[] = []

  for (const limit of limits) {
    const kind = limit.kind
    if (!isTracked(kind, s.sevenDay)) continue
    const window = limit.resetsAt ?? 'unknown'

    // Samples feed the forecast; $.store is shared, so every session adds to the same history.
    let fullAt: number | undefined
    if (s.forecast) {
      const stored = await $.store.get(`samples:${kind}`)
      const points = isSamples(stored) && stored.window === window ? stored.points : []
      const updated = addSample(points, [now, limit.percentUsed])
      await $.store.set(`samples:${kind}`, { window, points: updated } satisfies Samples)
      fullAt = forecastFull(limit, updated, now)
    }
    next.push({ kind, percentUsed: limit.percentUsed, resetsAt: limit.resetsAt, fullAt })

    const step = stepFor(limit.percentUsed, s)
    if (step === 0) continue
    const last = await $.store.get(`warned:${kind}`)
    const warnedStep = isWarned(last) && last.window === window ? last.step : 0
    if (step <= warnedStep) continue

    await $.store.set(`warned:${kind}`, { window, step } satisfies Warned)
    const text = warningText(limit, step, fullAt, now)
    $.ui.toast(text, { timeoutMs: s.toastMs })

    const isLoud = s.notifyAt !== undefined && step >= s.notifyAt
    if (isLoud) await $.ui.notify(text, { title: 'Claude usage' }).catch(() => undefined)
    if (s.sound === 'every' || (s.sound === 'notify' && isLoud)) {
      await $.audio.play({ asset: 'sounds/alert.wav' }).catch(() => undefined)
    }
  }

  await update($, readings, () => next)
  await drawStatus($, s)
}

export const register: Register = (on, options) => {
  const s = readSettings(options)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage().catch(() => undefined)
    if (usage) await check($, s, usage.rateLimits)
    if (s.statusLine) $.clock.every(STATUS_REFRESH_MS, () => void drawStatus($, s))
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await check($, s, e.rateLimits)
    return next(e)
  })

  // One circle per window in use, at the right end of the band above the prompt.
  // Hovering the row reveals the details; a click on a circle pins them open.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!s.indicator || e.props.hasSurvey) return next(e)
    const shown = (await read($, readings)).filter(r => r.percentUsed > 0)
    if (shown.length === 0) return next(e)

    const now = await $.clock.now()
    const isPinned = await read($, isOpen)
    const toggle = () => update($, isOpen, open => !open)
    const revealOnHover = isPinned ? {} : { display: 'none' as const, hover: { display: 'flex' as const } }
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box key="usage" flexDirection="row" justifyContent="flex-end" gap={1}>
        <Box {...revealOnHover}>
          <Text dimColor>{shown.map(r => statusPart(r, r.fullAt, now)).join('  ·  ')}</Text>
        </Box>
        {shown.map(r => (
          <Button key={`usage-${r.kind}`} plain onPress={toggle}>
            <Text color={circleColor(r.percentUsed, s)}>●</Text>
          </Button>
        ))}
      </Box>
    )
  })
}
