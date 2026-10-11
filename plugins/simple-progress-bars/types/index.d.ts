/**
 * run: in progress. complete: done. fail: the script reported a failure.
 * stopped: the wrapper stopped, or its run file went stale.
 */
export type BarState = 'run' | 'complete' | 'fail' | 'stopped'

/** '' for a count, 'B' for bytes, '%' for percent. */
export type BarUnit = '' | 'B' | '%'

/** One task as the plugin shows it. All times are ms since the epoch. */
export type Bar = {
  /** The run file path and the task ID: unique across the watched sessions. */
  key: string
  /** The path of the run file. */
  file: string
  /** The key of the root task, or null for a root. */
  root: string | null
  /** The task name. */
  name: string
  /** Detail text, or the failure message. */
  label: string
  done: number
  /** null when the script gave no total (an indeterminate bar). */
  total: number | null
  unit: BarUnit
  state: BarState
  /** True while the plugin shows the task as stopped because its run file went stale. */
  isStale: boolean
  /** The first update of the task. */
  startedAt: number
  /** The file's modification time at the last update that changed the task. */
  updatedAt: number
  /** The last step: the time when the progress last grew. The rate and the estimate count from it. */
  progressAt: number
  /** The progress at the last step: the count, or for a root the count plus the done part of its one running subtask. */
  progress: number
  /** When the bar left the run state, or null while it runs. */
  endedAt: number | null
  /** The number of steps, counting the first progress as one. */
  samples: number
  /** The rate in units per ms, weighted by time, or null before the second step. */
  rate: number | null
  /** The typical time of a step in ms, or null before the second step. */
  stepTime: number | null
  /** The typical progress of a step, or null before the second step. */
  stepSize: number | null
  /** The shown time left at progressAt, in ms, or null while estimating. */
  eta: number | null
  /** The folded reports at the last update, so that an unchanged task is not updated again. */
  sig: string
}

export type Board = { bars: Bar[]; now: number }

declare module 'claude-code' {
  interface PluginState {
    'simple-progress-bars': {
      board: Board
      /** The keys of the roots that the person collapsed. */
      collapsed: string[]
      /** True while the person keeps the band compact. */
      isCompact: boolean
    }
  }
}
