import simpleGit from 'simple-git'
import { GitHistory } from './types.js'

interface MutableMeta {
  lastModifiedDate: Date | null
  commitCount: number
}

/**
 * Scans the Git history of a repository to gather per-file metadata.
 *
 * Strategy: two-year rolling window parsed in a single `git log` pass.
 * - First occurrence of each file  → last modified date (log is newest-first).
 * - Occurrences within last 6 months → recent commit count.
 *
 * Files tracked by Git but not touched in 2 years are recorded with
 * lastModifiedDate = twoYearsAgo and commitCount = 0.
 */
export async function scanGitHistory(repoPath: string): Promise<GitHistory> {
  const git = simpleGit(repoPath)

  const isRepo = await git.checkIsRepo()
  if (!isRepo) throw new Error(`Not a git repository: ${repoPath}`)

  // All tracked files (automatically respects .gitignore)
  const lsFiles = await git.raw(['ls-files'])
  const trackedFiles = new Set(lsFiles.split('\n').filter(Boolean))

  const now = new Date()

  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Single git-log pass covering 2 years of history.
  // Output format: blank line between commits, file names listed below each header.
  const raw = await git.raw([
    'log',
    `--since=${twoYearsAgo.toISOString()}`,
    '--name-only',
    '--format=COMMIT %aI',
    '--diff-filter=AM', // Added or Modified only (skip renames/deletes)
    '--no-merges',
  ])

  // Pre-populate all tracked files so every file appears in the result.
  const mutable = new Map<string, MutableMeta>()
  for (const file of trackedFiles) {
    mutable.set(file, { lastModifiedDate: null, commitCount: 0 })
  }

  let currentDate: Date | null = null

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT ')) {
      currentDate = new Date(line.slice(7).trim())
    } else if (line.trim() && currentDate !== null) {
      const file = line.trim()
      const entry = mutable.get(file)
      if (!entry) continue // file not in ls-files (e.g. deleted)

      // Newest-first: first occurrence = most recent modification.
      if (entry.lastModifiedDate === null) {
        entry.lastModifiedDate = currentDate
      }

      // Count commits within the 6-month window.
      if (currentDate >= sixMonthsAgo) {
        entry.commitCount++
      }
    }
  }

  // Materialise into the final read-only map.
  const history: GitHistory = new Map()
  for (const [file, meta] of mutable) {
    history.set(file, {
      lastModifiedDate: meta.lastModifiedDate ?? twoYearsAgo,
      commitCount: meta.commitCount,
    })
  }

  return history
}
