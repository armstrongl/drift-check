# drift-check

A CLI tool that finds files that have changed significantly while their associated documentation hasn't been touched.

It scans git history, pairs each code file with its nearest doc file, and computes a **drift score** (`commit_count × days_since_doc_update`). The result is a colour-coded table of your most at-risk files — plus a summary of overall repository drift.

```
  _____  _____  _____ ______ _______      _____ _    _ ______ _____ _  __
 |  __ \|  __ \|_   _|  ____|__   __|    / ____| |  | |  ____/ ____| |/ /
 | |  | | |__) | | | | |__     | |______| |    | |__| | |__ | |    | ' /
 | |  | |  _  /  | | |  __|    | |______| |    |  __  |  __|| |    |  <
 | |__| | | \ \ _| |_| |       | |      | |____| |  | | |___| |____| . \
 |_____/|_|  \_\_____|_|       |_|       \_____|_|  |_|______\_____|_|\_\

  Documentation drift detector  ·  ordomesh.com
```

---

## Usage

### Using npx

```bash
npx @ordomesh/drift-check /path/to/repo
```

### During development (from repo root)

```bash
pnpm --filter @ordomesh/drift-check dev /path/to/repo
```

### After building

```bash
pnpm --filter @ordomesh/drift-check build
node apps/drift-check/dist/index.js /path/to/repo
```

---

## Options

| Flag            | Description                                                  | Default     |
| --------------- | ------------------------------------------------------------ | ----------- |
| `[path]`        | Path to the git repository to analyse                        | `.` (cwd)   |
| `--top <n>`     | Show only the top N drifted files                            | `20`        |
| `--docs <glob>` | Glob restricting which files count as documentation          | auto-detect |
| `--markdown`    | Output GitHub-flavoured Markdown (for Actions / PR comments) | off         |
| `--verify`      | Show OrdoMesh semantic scan prompt                           | off         |

---

## Examples

```bash
# Analyse the current directory, show top 10
drift-check . --top 10

# Custom docs glob
drift-check . --docs "**/docs/*.md"

# Markdown output — pipe to a GitHub Actions step summary or PR comment
drift-check . --top 20 --markdown >> $GITHUB_STEP_SUMMARY
```

---

## How scoring works

| Drift level | Score     |
| ----------- | --------- |
| Low         | < 50      |
| Med         | 50 – 199  |
| High        | 200 – 999 |
| CRITICAL    | ≥ 1 000   |

**Score = `commit_count × days_since_doc_update`**

- `commit_count` — number of commits to the code file in the last 6 months.
- `days_since_doc_update` — calendar days since the paired doc file was last touched. If no doc file exists, 730 days (2 years) is assumed.

Only files with at least one commit in the last 6 months are included — unchanged files don't contribute to drift.

### Default doc-file mapping

For a file like `src/auth/login.ts`, drift-check searches (in order):

1. `docs/auth/login.md`
2. `src/auth/README.md`
3. `docs/auth/README.md`
4. `docs/auth/README.md` (walking up)
5. `README.md`

Pass `--docs <glob>` to override and restrict which files are considered documentation.

---

## GitHub Actions

Post drift results as a PR comment or step summary:

```yaml
- name: Check documentation drift
  run: npx @ordomesh/drift-check . --top 20 --markdown >> $GITHUB_STEP_SUMMARY
```
