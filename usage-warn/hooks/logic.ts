import type { PluginOptions, SessionRateLimit } from 'claude-code'

const HOUR_MS = 60 * 60 * 1000

/** The windows the mod tracks: the 5-hour one, and every weekly one (7d, 7d opus, ...). */
export const isTracked = (kind: string, sevenDay: boolean) =>
  kind === 'five_hour' || (sevenDay && kind.startsWith('seven_day'))

/** 5h, 7d, or 7d opus for a model-scoped weekly window. */
export const windowLabel = (kind: string) => {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return '7d'
  if (kind.startsWith('seven_day_')) return `7d ${kind.slice('seven_day_'.length).replace(/_/g, ' ')}`
  return kind
}

const windowLength = (kind: string) => {
  if (kind === 'five_hour') return 5 * HOUR_MS
  if (kind.startsWith('seven_day')) return 7 * 24 * HOUR_MS
  return undefined
}

export type Settings = {
  start: number
  step: number
  notifyAt: number | undefined
  toastMs: number
  statusLine: boolean
  forecast: boolean
  sevenDay: boolean
  sound: 'off' | 'notify' | 'every'
  indicator: boolean
}

const num = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const readSettings = (o: PluginOptions): Settings => ({
  start: num(o.start, 50),
  step: num(o.step, 10),
  notifyAt: o.notifyAt === 'off' ? undefined : num(o.notifyAt, 90),
  toastMs: num(o.toastSeconds, 8) * 1000,
  statusLine: o.statusLine !== 'off',
  forecast: o.forecast !== 'off',
  sevenDay: o.sevenDay !== 'off',
  sound: o.sound === 'off' ? 'off' : o.sound === 'every step' ? 'every' : 'notify',
  indicator: o.indicator !== 'off',
})

/** The circle's theme color: green below the start, warning from it, error from the notification percent. */
export const circleColor = (percent: number, s: Settings): 'success' | 'warning' | 'error' => {
  if (percent >= (s.notifyAt ?? 90)) return 'error'
  if (percent >= s.start) return 'warning'
  return 'success'
}

/** The highest warning step reached, or 0 below the start. */
export const stepFor = (percent: number, s: Settings) => {
  if (percent < s.start) return 0
  return s.start + Math.floor((percent - s.start) / s.step) * s.step
}

export type Sample = [time: number, percent: number]

const SAMPLE_SPAN_MS = HOUR_MS
const MIN_SPAN_MS = 10 * 60 * 1000

/** Keeps the last hour of samples, at most one a minute. */
export const addSample = (samples: readonly Sample[], next: Sample): Sample[] => {
  const last = samples[samples.length - 1]
  const kept = last && next[0] - last[0] < 60_000 ? samples.slice(0, -1) : samples
  return [...kept, next].filter(([t]) => next[0] - t <= SAMPLE_SPAN_MS)
}

/**
 * When the window hits 100% at the current pace, or undefined when that is
 * after the reset or the pace is unknown. Uses the last hour's samples, and
 * falls back to the average since the window opened.
 */
export const forecastFull = (
  limit: SessionRateLimit,
  samples: readonly Sample[],
  now: number,
): number | undefined => {
  const resetsAt = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
  if (Number.isNaN(resetsAt) || limit.percentUsed >= 100) return undefined

  let ratePerMs = 0
  const first = samples[0]
  if (first && now - first[0] >= MIN_SPAN_MS && limit.percentUsed > first[1]) {
    ratePerMs = (limit.percentUsed - first[1]) / (now - first[0])
  } else {
    const length = windowLength(limit.kind)
    const elapsed = length ? now - (resetsAt - length) : 0
    if (elapsed >= MIN_SPAN_MS) ratePerMs = limit.percentUsed / elapsed
  }
  if (ratePerMs <= 0) return undefined

  const fullAt = now + (100 - limit.percentUsed) / ratePerMs
  return fullAt < resetsAt ? fullAt : undefined
}

const pad = (n: number) => String(n).padStart(2, '0')
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 14:30 today, or Thu 14:30 for another day. */
export const clockTime = (ms: number, now: number) => {
  const at = new Date(ms)
  const hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  return at.toDateString() === new Date(now).toDateString() ? hm : `${DAYS[at.getDay()]} ${hm}`
}

/** 1h12m, 45m, or 3d4h. */
export const duration = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60_000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h${pad(mins % 60)}m`
  return `${Math.floor(hours / 24)}d${hours % 24}h`
}

export const warningText = (
  limit: SessionRateLimit,
  step: number,
  fullAt: number | undefined,
  now: number,
) => {
  const label = windowLabel(limit.kind)
  const resetsAt = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
  const parts = [`${label} usage at ${step}%`]
  if (!Number.isNaN(resetsAt)) parts.push(`resets ${clockTime(resetsAt, now)}`)
  if (fullAt !== undefined) parts.push(`on pace for 100% at ${clockTime(fullAt, now)}`)
  return parts.join(' · ')
}

export const statusPart = (limit: SessionRateLimit, fullAt: number | undefined, now: number) => {
  const label = windowLabel(limit.kind)
  const resetsAt = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
  let text = `${label} ${Math.round(limit.percentUsed)}%`
  if (!Number.isNaN(resetsAt)) text += ` · resets in ${duration(resetsAt - now)}`
  if (fullAt !== undefined) text += ` · 100% by ${clockTime(fullAt, now)}`
  return text
}
