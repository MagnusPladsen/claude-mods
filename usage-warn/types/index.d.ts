/** One usage window as last measured, kept for the band and the status line. */
export type Reading = {
  kind: string
  percentUsed: number
  resetsAt?: string
  fullAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-warn': { readings: Reading[]; isOpen: boolean }
  }
}
