/** run: in progress. stopped: the reporting process exited before done. */
export type BarState = 'run' | 'complete' | 'fail' | 'stopped'

/** '' for a count, 'B' for bytes, '%' for percent. */
export type BarUnit = '' | 'B' | '%'

export type Bar = {
  /** File name in the progress directory: the task name. */
  name: string
  /** Detail text, or the failure message. */
  label: string
  done: number
  /** null when the script gave no total (indeterminate bar). */
  total: number | null
  unit: BarUnit
  state: BarState
  /** Process that reports progress, or null for a plain text file. */
  pid: number | null
  /** First time the mod saw the file, in ms since the epoch. */
  startedAt: number
  /** Modification time of the last update, in ms since the epoch. */
  updatedAt: number
  /** Time of the last change of state, in ms since the epoch. */
  endedAt: number | null
  /** Number of updates with progress. */
  samples: number
  /** Smoothed rate in units per ms, or null before two updates. */
  rate: number | null
  /** Shown time left at updatedAt in ms, or null while estimating. */
  eta: number | null
}

export type Board = { dir: string | null; bars: Bar[]; now: number }

declare module 'claude-code' {
  interface PluginState {
    'simple-progress-bars': { board: Board }
  }
}
