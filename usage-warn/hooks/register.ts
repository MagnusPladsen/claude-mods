import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'
import {
  addSample,
  forecastFull,
  readSettings,
  statusPart,
  stepFor,
  warningText,
  type Sample,
  type Settings,
  type WindowKind,
} from './logic'

type Warned = { window: string; step: number }
type Samples = { window: string; points: Sample[] }
type Reading = { limit: SessionRateLimit; fullAt: number | undefined }

const isWarned = (v: unknown): v is Warned =>
  typeof v === 'object' && v !== null && typeof (v as Warned).window === 'string' && typeof (v as Warned).step === 'number'

const isSamples = (v: unknown): v is Samples =>
  typeof v === 'object' && v !== null && typeof (v as Samples).window === 'string' && Array.isArray((v as Samples).points)

const STATUS_REFRESH_MS = 60_000

// The latest reading of each window, for redrawing the status line between measurements.
let latest: Reading[] = []

async function drawStatus($: EngineInterface, s: Settings) {
  if (!s.statusLine) return
  const now = await $.clock.now()
  const shown = latest.filter(l => l.limit.percentUsed >= s.start)
  $.ui.status(shown.length ? shown.map(l => statusPart(l.limit, l.fullAt, now)).join('  ·  ') : undefined)
}

async function check($: EngineInterface, s: Settings, limits: readonly SessionRateLimit[]) {
  const now = await $.clock.now()
  const kinds: WindowKind[] = s.sevenDay ? ['five_hour', 'seven_day'] : ['five_hour']
  const readings: Reading[] = []

  for (const kind of kinds) {
    const limit = limits.find(r => r.kind === kind)
    if (!limit) continue
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
    readings.push({ limit, fullAt })

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

  latest = readings
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
}
