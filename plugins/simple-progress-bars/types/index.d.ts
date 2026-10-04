/**
 * run: in progress. complete: done. fail: the script reported a failure.
 * stopped: the Bash call that ran it ended before the task was done.
 */
export type BarState = 'run' | 'complete' | 'fail' | 'stopped'

/** '' for a count, 'B' for bytes, '%' for percent. */
export type BarUnit = '' | 'B' | '%'

/** One task as the plugin shows it. All times are ms since the epoch. */
export type Bar = {
  /** The path of the task file: unique across the watched session directories. */
  key: string
  /** The task name: the file name. */
  name: string
  /** Detail text, or the failure message. */
  label: string
  done: number
  /** null when the script gave no total (an indeterminate bar). */
  total: number | null
  unit: BarUnit
  state: BarState
  /** The first update of this run. */
  startedAt: number
  /** The file's modification time at the last update. */
  updatedAt: number
  /** The last update that changed the count. The rate and the estimate count from it. */
  progressAt: number
  /** When the bar left the run state, or null while it runs. */
  endedAt: number | null
  /** The number of updates that changed the count in this run. */
  samples: number
  /** The smoothed rate in units per ms, or null before two counted updates. */
  rate: number | null
  /** The shown time left at progressAt, in ms, or null while estimating. */
  eta: number | null
}

export type Board = { bars: Bar[]; now: number }

declare module 'claude-code' {
  interface PluginState {
    'simple-progress-bars': { board: Board }
  }
}
