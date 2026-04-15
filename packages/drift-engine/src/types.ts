/** Metadata extracted from git history for a single file. */
export interface GitFileMeta {
  /** Most recent commit date for this file (within the scan window). */
  lastModifiedDate: Date
  /** Number of commits to this file in the last 6 months. */
  commitCount: number
}

/** All git metadata keyed by repository-relative file path. */
export type GitHistory = Map<string, GitFileMeta>

export type DriftLevel = 'Low' | 'Med' | 'High' | 'CRITICAL'

/**
 * A pairing of one code file with its nearest documentation file,
 * plus the computed drift score.
 */
export interface DriftPair {
  codeFile: string
  /** null when no documentation file could be located. */
  docFile: string | null
  /** Commits to the code file in the last 6 months. */
  codeCommitCount: number
  /**
   * Calendar days since the doc file was last touched.
   * Set to 730 (2 years) when no doc file exists.
   */
  daysSinceDocUpdate: number
  /** codeCommitCount × daysSinceDocUpdate */
  driftScore: number
  driftLevel: DriftLevel
}

export interface DriftReport {
  /** All drift pairs, sorted by driftScore descending. */
  pairs: DriftPair[]
  /** Total code files found (active + unchanged). */
  totalCodeFiles: number
  /** Code files that have a paired doc file. */
  pairedFiles: number
  /** Percentage of active files rated High or CRITICAL. */
  overallDriftPct: number
  repoPath: string
}
