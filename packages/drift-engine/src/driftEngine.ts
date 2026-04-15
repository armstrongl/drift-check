import * as path from 'path'
import micromatch from 'micromatch'
import { GitHistory, DriftLevel, DriftPair, DriftReport } from './types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.cc',
  '.h',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.ex',
  '.exs',
  '.scala',
  '.lua',
  '.dart',
])

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.txt'])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCodeFile(filePath: string): boolean {
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function isDocFile(filePath: string): boolean {
  return DOC_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function toDriftLevel(score: number): DriftLevel {
  if (score >= 1000) return 'CRITICAL'
  if (score >= 200) return 'High'
  if (score >= 50) return 'Med'
  return 'Low'
}

// ---------------------------------------------------------------------------
// Documentation file lookup
// ---------------------------------------------------------------------------

/**
 * Default doc-file search strategy for a given code file.
 *
 * For `src/auth/login.ts` it tries (in order):
 *   1. docs/auth/login.md          — sibling "docs mirror" with same name
 *   2. src/auth/README.md          — README in the same directory
 *   3. docs/auth/README.md         — README in the docs mirror directory
 *   4. docs/auth/login.md          — (after stripping leading "src/")
 *   5. docs/README.md (walk up)    — section-level README
 *   6. README.md                   — root fallback
 */
function defaultDocSearch(
  codeFile: string,
  docFileSet: Set<string>,
): string | null {
  const dir = path.dirname(codeFile)
  const base = path.basename(codeFile, path.extname(codeFile))

  // Strip a leading "src/" segment when building the docs/ mirror path.
  const mirrorDir = dir.replace(/^src(\/|$)/, '').replace(/^\./, '')
  const mirrorPrefix = mirrorDir ? `docs/${mirrorDir}` : 'docs'

  const candidates: string[] = [
    `${mirrorPrefix}/${base}.md`,
    `${dir}/README.md`,
    `${mirrorPrefix}/README.md`,
    `docs/${dir}/${base}.md`,
    // Walk up one level
    `docs/${path.dirname(dir)}/README.md`,
    `docs/README.md`,
    'README.md',
  ]

  for (const candidate of candidates) {
    // Normalise double slashes and leading "./"
    const normalised = candidate.replace(/\/+/g, '/').replace(/^\.\//, '')
    if (docFileSet.has(normalised)) return normalised
  }

  return null
}

/**
 * When a custom docs glob is supplied, pick the doc file that shares the most
 * leading path segments with the code file (closest ancestor folder wins).
 */
function closestDocMatch(codeFile: string, docFiles: string[]): string | null {
  if (docFiles.length === 0) return null

  const codeParts = path.dirname(codeFile).split('/')
  let best: string | null = null
  let bestScore = -1

  for (const doc of docFiles) {
    const docParts = path.dirname(doc).split('/')
    let shared = 0
    for (let i = 0; i < Math.min(codeParts.length, docParts.length); i++) {
      if (codeParts[i] === docParts[i]) shared++
      else break
    }
    if (shared > bestScore) {
      bestScore = shared
      best = doc
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  // Glob pattern restricting which files count as documentation, e.g. `**/ docs /*.md`
  docsGlob?: string
  repoPath?: string
}

/**
 * Computes drift pairs from pre-scanned git history.
 *
 * Only code files with ≥1 commit in the last 6 months are included —
 * unchanged files don't contribute to drift.
 */
export function analyzeDrift(
  history: GitHistory,
  options: AnalyzeOptions = {},
): DriftReport {
  const now = new Date()
  const { docsGlob, repoPath = '.' } = options

  const allFiles = Array.from(history.keys())
  const codeFiles = allFiles.filter(isCodeFile)
  const allDocFiles = allFiles.filter(isDocFile)

  // Apply custom glob filter if provided.
  const eligibleDocFiles = docsGlob
    ? micromatch(allDocFiles, docsGlob)
    : allDocFiles
  const docFileSet = new Set(eligibleDocFiles)

  const pairs: DriftPair[] = []

  for (const codeFile of codeFiles) {
    const codeMeta = history.get(codeFile)!

    // Skip files that have not changed recently — they are not drifting.
    if (codeMeta.commitCount === 0) continue

    const docFile = docsGlob
      ? closestDocMatch(codeFile, eligibleDocFiles)
      : defaultDocSearch(codeFile, docFileSet)

    let daysSinceDocUpdate: number
    if (docFile) {
      const docMeta = history.get(docFile)!
      daysSinceDocUpdate = daysBetween(docMeta.lastModifiedDate, now)
    } else {
      // No documentation at all: treat as 2 years stale.
      daysSinceDocUpdate = 365 * 2
    }

    const driftScore = codeMeta.commitCount * daysSinceDocUpdate

    pairs.push({
      codeFile,
      docFile,
      codeCommitCount: codeMeta.commitCount,
      daysSinceDocUpdate,
      driftScore,
      driftLevel: toDriftLevel(driftScore),
    })
  }

  pairs.sort((a, b) => b.driftScore - a.driftScore)

  const highRisk = pairs.filter(
    (p) => p.driftLevel === 'High' || p.driftLevel === 'CRITICAL',
  ).length

  return {
    pairs,
    totalCodeFiles: codeFiles.length,
    pairedFiles: pairs.filter((p) => p.docFile !== null).length,
    overallDriftPct:
      pairs.length > 0 ? Math.round((highRisk / pairs.length) * 100) : 0,
    repoPath,
  }
}
