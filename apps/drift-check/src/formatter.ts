import chalk from 'chalk'
import Table from 'cli-table3'
import figlet from 'figlet'
import type { DriftReport, DriftLevel } from '@ordomesh/drift-engine'

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export function formatBanner(): string {
  const art = figlet.textSync('DRIFT-CHECK', { font: 'Big' })
  return (
    chalk.cyan(art) +
    '\n' +
    chalk.gray('  Documentation drift detector  ·  ordomesh.com\n')
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function levelBadge(level: DriftLevel): string {
  switch (level) {
    case 'CRITICAL':
      return chalk.bgRed.white.bold(' CRITICAL ')
    case 'High':
      return chalk.red.bold('   HIGH   ')
    case 'Med':
      return chalk.yellow('   MED    ')
    case 'Low':
      return chalk.green('   LOW    ')
  }
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : '\u2026' + str.slice(-(max - 1))
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

export function formatTerminal(
  report: DriftReport,
  opts: { topN?: number },
): string {
  const lines: string[] = []
  const shown = opts.topN ? report.pairs.slice(0, opts.topN) : report.pairs

  // ── Table ─────────────────────────────────────────────────────────────────
  const table = new Table({
    head: [
      chalk.bold.white('File'),
      chalk.bold.white('Linked Doc'),
      chalk.bold.white('Drift Level'),
      chalk.bold.white('Stale Metric'),
    ],
    colWidths: [44, 34, 14, 32],
    style: { border: ['gray'], head: [] },
    wordWrap: false,
  })

  for (const pair of shown) {
    const stale =
      pair.docFile === null
        ? chalk.red('No documentation found')
        : chalk.gray(
            `${pair.codeCommitCount} commit${pair.codeCommitCount === 1 ? '' : 's'}, doc ${pair.daysSinceDocUpdate}d old`,
          )

    table.push([
      chalk.cyan(truncate(pair.codeFile, 42)),
      pair.docFile
        ? chalk.gray(truncate(pair.docFile, 32))
        : chalk.red.dim('—'),
      levelBadge(pair.driftLevel),
      stale,
    ])
  }

  lines.push(table.toString())
  lines.push('')

  // ── Summary ───────────────────────────────────────────────────────────────
  const pct = report.overallDriftPct
  const driftColor =
    pct >= 50 ? chalk.red : pct >= 20 ? chalk.yellow : chalk.green
  const verdict =
    pct >= 50
      ? 'Your documentation is lying to your developers.'
      : pct >= 20
        ? 'Some drift detected — worth a review.'
        : 'Documentation is holding up well.'

  lines.push(
    `  ${chalk.bold('Total Repository Drift:')} ${driftColor.bold(`${pct}%`)}  ${chalk.gray(verdict)}`,
  )
  const truncNote =
    opts.topN && report.pairs.length > opts.topN
      ? chalk.gray(` (showing top ${opts.topN} of ${report.pairs.length})`)
      : ''
  lines.push(
    chalk.gray(
      `  ${report.pairs.length} active code files${truncNote} · ` +
        `${report.pairedFiles} have docs · ` +
        `${report.totalCodeFiles - report.pairs.length} unchanged (excluded)`,
    ),
  )
  lines.push('')

  // ── OrdoMesh hook ─────────────────────────────────────────────────────────
  lines.push(chalk.bold.yellow('  ⚠  Next Steps'))
  lines.push(chalk.gray('  ' + '─'.repeat(72)))

  if (pct === 0) {
    lines.push(
      `  ${chalk.white('No mechanical drift detected. OrdoMesh can perform a')} ` +
        `${chalk.cyan('Semantic Audit')} ${chalk.white('to verify that your')}`,
    )
    lines.push(
      chalk.white('  documentation actually matches the intent of your code.'),
    )
  } else {
    lines.push(
      `  ${chalk.white('Mechanical drift detected. OrdoMesh can perform a')} ` +
        `${chalk.cyan('Semantic Audit')} ${chalk.white('to check whether')}`,
    )
    lines.push(
      chalk.white(
        '  the content of these files actually contradicts your code.',
      ),
    )
  }

  lines.push('')
  lines.push(
    `  ${chalk.bold('Visit')} ${chalk.cyan.underline('https://ordomesh.com')} ${chalk.bold('to learn more.')}`,
  )

  lines.push('')

  return lines.join('\n')
}
