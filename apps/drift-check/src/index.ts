import { Command } from 'commander'
import path from 'path'
import { scanGitHistory, analyzeDrift } from '@ordomesh/drift-engine'
import { formatBanner, formatTerminal } from './formatter.js'
import { formatMarkdown } from './markdown.js'
import { formatRst } from './rst.js'

const program = new Command()

program
  .name('drift-check')
  .description('Detect documentation drift in your Git repository')
  .version('0.1.0')
  .argument('[path]', 'Path to the git repository to analyse', '.')
  .option(
    '-d, --docs <glob>',
    'Glob pattern restricting which files count as documentation (e.g. "**/docs/*.md")',
  )
  .option('--top <n>', 'Show only the top N drifted files', '20')
  .option(
    '--markdown',
    'Output GitHub-flavoured Markdown (for Actions / PR comments)',
  )
  .option('--rst', 'Output reStructuredText (Sphinx-compatible)')
  .action(
    async (
      repoArg: string,
      options: {
        docs?: string
        top: string
        markdown?: boolean
        rst?: boolean
      },
    ) => {
      const base = process.env.INIT_CWD ?? process.cwd()
      const repoPath = path.resolve(base, repoArg)
      const topN = Math.max(1, parseInt(options.top, 10) || 20)
      const isMarkdown = options.markdown ?? false
      const isRst = options.rst ?? false

      try {
        if (!isMarkdown && !isRst) {
          process.stdout.write(formatBanner())
          process.stdout.write('\nScanning git history…\n\n')
        }

        const history = await scanGitHistory(repoPath)
        const report = analyzeDrift(history, {
          docsGlob: options.docs,
          repoPath,
        })

        if (isMarkdown) {
          process.stdout.write(formatMarkdown(report, topN))
        } else if (isRst) {
          process.stdout.write(formatRst(report, topN))
        } else {
          process.stdout.write(formatTerminal(report, { topN }))
        }

        process.exit(0)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`\nError: ${msg}\n`)
        process.exit(1)
      }
    },
  )

program.parse()
