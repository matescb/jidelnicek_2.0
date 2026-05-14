# Harness & CI Audit

## Scope

Files examined: `.claude/settings.json`, `.claude/settings.local.json`, `CLAUDE.md`, `CLAUDE.local.md`,
`.clinerules/` (4 files), `.cursor/mcp.json`, `.taskmaster/config.json`, `.taskmaster/state.json`,
`.gitlab-ci.yml`, `.github/workflows/i18n-check.yml`, `.dockerignore`, `.gitignore`, `.env.example`,
`Makefile`, `scripts/` directory listing, `.remember/` hook artefacts.

---

## TL;DR

The harness is functional but noisy. `settings.local.json` has accumulated 214 permission rules via
session auto-approval, of which 13 are exact duplicates, at least 15 are pipeline-fragment
non-matchables, 2 embed real local credentials (`jidelnicek_dev_2024`), and several `sudo *`
wildcards grant unrestricted elevated execution. No PostToolUse or PreToolUse hooks are defined at
the project level. The `remember` plugin PostToolUse hook has a race-condition writing a PID file
that produces a benign but noisy error on every save trigger. CI coverage threshold (70%) is below
the documented 80% requirement. Security scanning is `allow_failure: true`, making it advisory-only.
The GitHub Actions workflow uses deprecated action versions with no permissions scoping.

---

## .claude/settings.json

The committed baseline allowlist uses space-delimited patterns (`Bash(python *)`), while
`settings.local.json` uses colon-delimited form (`Bash(python:*)`). Claude Code accepts both; the
inconsistency makes diff review harder. The list covers every common tool without a single `deny`
entry. Notably broad: `Bash(rm *)`, `Bash(export *)`, `Bash(source *)`, `Bash(. *)`,
`Bash(kill *)`, `Bash(killall *)`, `Bash(systemctl *)`. No `sudo *` here — that is only in
`settings.local.json`.

---

## .claude/settings.local.json — invalid rules, fragments, duplicates, dangerous patterns

### Known issues (as flagged in audit brief)

Lines 159 and 184 contain multi-line `python -c "..."` commands embedded as `Bash(...)` patterns.
The embedded newlines make the patterns syntactically unparseable by Claude Code's allowlist engine;
they function as dead entries that silently never match. Line 192 (the 50-line trip-endpoint test
block) has the same problem.

### Pipeline fragment entries — lines 160-162, 175-176, 180-181, 194-197, 200, 205-206

Shell `for/do/done`, `if/then/else/fi` keywords added verbatim as individual permission rules:

```
"Bash(for file in test_recipe_endpoints.py ...)"
"Bash(do echo \"File: $file\")"
"Bash(done)"
"Bash(if [ -f auth_token.txt ])"
"Bash(then echo \"Token file exists\")"
"Bash(else echo \"No token file found\")"
"Bash(fi)"
```

Claude Code evaluates each Bash invocation as a single command. Shell loop constructs are not single
commands; the shell expands them before Claude Code sees the text. These ~15 rules will never match
any real tool call and consume only list-scan time.

### Duplicates (13 entries)

```
2x  Bash(ls:*)
2x  Bash(find:*)
2x  Bash(grep:*)
2x  Bash(mkdir:*)
2x  Bash(chmod:*)
2x  Bash(touch:*)
2x  Bash(tree:*)
2x  Bash(task-master:*)
2x  mcp__memory__add_observations
2x  mcp__memory__create_entities
2x  mcp__memory__create_relations
2x  mcp__memory__read_graph
2x  Bash(PYTHONPATH=.../src python -c "from jidelnicek.core.config import settings...")
```

### Embedded local credentials

Line 158: `DATABASE_URL=postgresql+asyncpg://jidelnicek:jidelnicek_dev_2024@localhost:5432/jidelnicek`
Line 159: same credential inside the multi-line python -c block

The password `jidelnicek_dev_2024` is hardcoded in permission rule strings. `settings.local.json`
is not in `.gitignore` and is currently staged as a new file (`A` in git status). If committed, the
credential enters git history permanently.

### Dangerous wildcard entries

```
Bash(sudo docker:*)
Bash(sudo docker-compose:*)
Bash(sudo docker-compose exec:*)
Bash(sudo docker stop:*)
Bash(sudo docker inspect:*)
Bash(sudo systemctl:*)
Bash(sudo usermod:*)
Bash(sudo kill:*)
Bash(pkill:*)
Bash(rm:*)
Bash(/dev/null)
```

`Bash(sudo usermod:*)` allows adding or modifying any system user without a confirmation prompt.

### Hardcoded absolute paths

Multiple rules such as
`Bash(PYTHONPATH=/mnt/data/WORK/Jidelnicek_2.0/src python -m pytest tests/core/test_security.py::...)`
are machine-specific one-off entries. They will silently fail to match on any other machine and
provide no useful general coverage.

### Stats summary

| Category | Count |
|---|---|
| Total rules | 214 |
| Unique rules | 201 |
| Exact duplicates | 13 |
| Pipeline fragments (dead) | ~15 |
| Unparseable multi-line python -c blocks | 3 |
| Rules with embedded credentials | 2 |
| Sudo wildcard rules | 6 |
| Machine-specific absolute path rules | 8+ |

---

## CLAUDE.md / rules conflict analysis

### CLAUDE.md (417 lines)

Entirely TaskMaster boilerplate copied from upstream documentation. Contains no project-specific
guidance: no stack description, no module layout, no test commands, no environment setup instructions.

Signal-to-noise: very low. An agent loading this file must parse ~400 lines of task management CLI
reference before encountering anything about the actual codebase.

### .clinerules/ (4 files, 1397 lines combined)

- `cline_rules.md` — generic rule-formatting meta-rules for Cline/Roo. Irrelevant to Claude Code.
  Header `globs: .cline/rules/*.md` references a directory that does not exist in this project.
- `dev_workflow.md` (423 lines) — comprehensive TaskMaster workflow guide. Largely duplicates
  `CLAUDE.md`. Both files are loaded simultaneously, meaning approximately 800 lines of identical
  TaskMaster workflow content is injected on every session start.
- `taskmaster.md` (557 lines) — full TaskMaster CLI/MCP reference. Also duplicates `CLAUDE.md`.
- `self_improve.md` — references `cursor_rules.md`, `changeset.md`, and `.cline/rules/*.md`.
  None of these files exist in this project.

### Conflicts between rule files

1. `dev_workflow.md` uses Cline-style `@taskmaster.md` cross-references. Claude Code does not
   honour `@file` directives; the links are silently ignored.
2. `self_improve.md` references `cursor_rules.md` and `changeset.md` (non-existent).
3. Global user rules (`~/.claude/rules/ecc/common/testing.md`) mandate 80% coverage minimum.
   `.gitlab-ci.yml` enforces `--cov-fail-under=70`. Agents following global rules will expect 80%;
   CI will pass at 70%.
4. `cline_rules.md` glob targets `.cline/rules/*.md` — that directory does not exist.

### CLAUDE.local.md

Two lines. Contains two actionable instructions (docker MCP, user email). Not committed. No conflicts.

### .cursor/mcp.json

All values are `*_KEY_HERE` placeholders. Staged for commit. No real keys at risk, but any Cursor
user will get authentication failures without substituting real keys. No project-level `.mcp.json`
exists for Claude Code.

---

## MCP config audit

The project has no `.mcp.json` at root. Global `~/.claude/settings.json` declares no `mcpServers`.
`settings.local.json` allow-rules reference 7 MCP server namespaces:

| Server namespace | Configured in | Status |
|---|---|---|
| `taskmaster` | `.cursor/mcp.json` (placeholder keys only) | Template, not functional |
| `docker` | Not found anywhere | Orphaned allow-rules |
| `apitest` | Not found anywhere | Orphaned allow-rules |
| `memory` | Not found anywhere | Orphaned allow-rules (4 duplicated) |
| `pythonInterpreter` | Not found anywhere | Orphaned allow-rules |
| `sequential-thinking` | Not found anywhere | Orphaned allow-rules |
| `browser` | `settings.json` baseline (`mcp__browser__*`) | OK |

`CLAUDE.local.md` instructs "use docker MCP for docker operations" but there is no `docker` MCP
server configuration in any scanned file. The instruction is currently unactionable.

### .taskmaster/config.json

`projectName` is `"Taskmaster"` (default) and `global.userId` is `"1234567890"` (placeholder).
No functional impact but indicates the config was not personalised after init.

### .taskmaster/state.json

Sane. `currentTag: master`, `branchTagMapping: {}`, `migrationNoticeShown: true`. No issues.

---

## CI/CD pipeline audit

### .gitlab-ci.yml

**Stage organisation:** Five stages (build, test, quality, security, deploy). `docker-build` is in
stage `build` with `only: main`, so feature branch pipelines run without a verified Docker image.
Acceptable but worth documenting.

**Caching:** Cache key uses `poetry.lock + pyproject.toml`. Cache includes `.venv/`. Correct
strategy. However, `apt-get install` results are not cached; each job pays 30-60 seconds of
package installation overhead.

**Service readiness:** Three test jobs (`unit-tests`, `integration-tests`, `performance-tests`) use
`sleep 15` to wait for Postgres/Redis. Fragile on loaded runners. A `pg_isready` / `redis-cli ping`
retry loop is more reliable.

**Artifact consumption gap:** The `build` job produces a `.venv/` artifact (1 hour expiry). None of
the three test jobs declare `dependencies: [build]`, so they never receive it and each runs a full
`poetry install --with=dev` independently. This wastes approximately 6-9 minutes of runner time per
pipeline.

**Coverage threshold:** `--cov-fail-under=70` conflicts with the project's documented 80% standard
and with the global agent rule in `~/.claude/rules/ecc/common/testing.md`.

**Test enforcement gap:** Both `unit-tests` and `integration-tests` append `|| true` to their pytest
invocations. Test failures will never cause these stages to fail. JUnit XML is still collected for
reporting, but the pipeline provides no enforcement gate.

**Security scan:** `allow_failure: true` means Bandit and Safety findings never block deployment.

**Missing scans:**
- No `ruff` linting (used locally per allowlist, absent in CI)
- No secret scanning (gitleaks or trufflehog)
- No `npm audit` for frontend dependencies
- No frontend SAST
- `safety check` uses legacy CLI syntax; Safety v3+ changed the interface and may produce empty
  output silently

**Deploy job issues:**
- `echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa` briefly exposes the key in shell process listing.
  Prefer `printf '%s\n' "$SSH_PRIVATE_KEY"` or `ssh-agent`.
- `rollback-production` references `jidelnicek:previous` but no pipeline step creates this tag
  before overwriting the current image. Rollback may operate on a stale or nonexistent image.

**Hardcoded test credentials:**
`SECRET_KEY: "test-secret-key-for-ci-integration-testing-32chars"` and
`SENTRY_DSN: "https://test@sentry.io/123456"` appear in three jobs. Clearly test values; no real
secret risk, but the Sentry URL has valid DSN structure and may cause confusion.

### .github/workflows/i18n-check.yml

- Uses `actions/checkout@v3`, `actions/setup-node@v3`, `actions/upload-artifact@v3`,
  `actions/github-script@v6`. Pinned to major version tags, not commit SHAs. Exposes the workflow
  to tag-mover supply chain attacks.
- No `permissions:` block on the workflow or job. Defaults to broad write token. Should scope to
  `pull-requests: write` and `contents: read` at minimum.

---

## Secret-handling hygiene (.env.example, .gitignore, .dockerignore)

### .env.example

All values are clearly placeholder strings (`your-secret-key-here`, `your-database-password`,
empty for optional keys). No real-looking tokens. Correctly whitelisted in `.gitignore` via
`!.env.example`. Clean.

### .gitignore

`.env` and `.env.*` correctly excluded with the `!.env.example` exception. `secrets/`, `*.key`,
`*.pem`, `*.cert`, `*.crt` excluded. `logs/` and `*.log` excluded. `*.swp` and `*.swo` excluded.

Gap 1: `.claude/settings.local.json` is not in `.gitignore`. Contains embedded DB credentials and
is currently staged for commit. This is the highest-priority issue in the repository.

Gap 2: `.claude/.settings.local.json.kate-swp` is staged despite `*.swp` being in `.gitignore`.
The file was staged before the gitignore rule applied.

Gap 3: `.remember/` is not in `.gitignore`. The `.remember/.gitignore` with `*` excludes contents,
but a new contributor's clone will not have `.remember/tmp/` present, causing the hook error on
every post-tool trigger.

### .dockerignore

Correctly excludes `.env`, `.git`, test files, documentation, CI configs, and `.taskmaster/`. Does
not explicitly exclude `.claude/`. If the Docker build context includes the project root (which it
does for a standard `docker build .`), `settings.local.json` with embedded credentials may be copied
into the build context and potentially into the image layer. Needs verification against
`docker/Dockerfile` (not in scope), but flagged as a risk.

---

## Hooks analysis

### Project-level hooks

None defined. No `hooks` key exists in `.claude/settings.json` or `.claude/settings.local.json`.
Given the broad allowlist, there are no PreToolUse guards against destructive patterns (`rm -rf`,
writes to `.env`, `sudo usermod`, etc.).

### remember plugin hook (global PostToolUse)

The `remember@claude-plugins-official` plugin (enabled in `~/.claude/settings.json`) installs a
PostToolUse hook. Error recorded in `.remember/logs/hook-errors.log`:

```
post-tool-hook.sh: line 93: /mnt/data/WORK/Jidelnicek_2.0/.remember/tmp/save-session.pid: No such file or directory
```

Root cause: line 93 executes `echo $! > "$PID_FILE"` where `PID_FILE` is `.remember/tmp/save-session.pid`.
The hook creates `.remember/logs/autonomous/` (line 91) before writing the PID, but does not
`mkdir -p .remember/tmp/` first. If `.remember/tmp/` is absent (fresh clone, or after `clean`), the
write fails. The save process still launches via `nohup` on line 92; only the PID recording fails.
The error is benign but logs on every post-tool save trigger when the directory is missing.

The fix belongs in the plugin. The project-level workaround is to ensure `.remember/tmp/` always
exists, but since `.remember/.gitignore` ignores all contents with `*`, a `.gitkeep` would also be
ignored and the directory would be absent after a fresh clone.

---

## Findings

### CRITICAL

**C1: DB credential embedded in settings.local.json (lines 158-159)**
Password `jidelnicek_dev_2024` hardcoded in two Bash permission rules. File is staged for commit.
If pushed, the credential enters git history permanently and cannot be expunged without a history
rewrite.

**C2: settings.local.json not in .gitignore**
File will be committed on the next `git push` unless explicitly unstaged and excluded.

### HIGH

**H1: sudo wildcard rules in settings.local.json**
`Bash(sudo usermod:*)`, `Bash(sudo docker:*)`, `Bash(sudo kill:*)`, `Bash(sudo systemctl:*)` grant
unrestricted root-equivalent execution. Any agent session with auto-approval enabled can escalate
via these rules without a confirmation prompt.

**H2: Test failures do not fail CI**
`|| true` appended to pytest in `unit-tests` and `integration-tests`. Both stages always return exit
code 0 regardless of test results.

**H3: Security scan is advisory-only**
`allow_failure: true` on `security-scan`. A critical CVE in a dependency will not block deployment.

**H4: No secret scanning in CI**
No gitleaks or trufflehog stage. Given C1, this gap is directly relevant to the current repository
state.

**H5: GitHub Actions workflow has no permissions scoping**
Default broad write token grants `contents: write` and other permissions to the i18n-check workflow.

### MEDIUM

**M1: ~28 dead permission rules (fragments + unparseable python -c blocks)**
Never match any tool call. Mislead reviewers into thinking coverage is broader than it is. The
allowlist cannot be trusted to reflect actual permissions until these are removed.

**M2: 13 duplicate permission rules**
No functional impact; indicates the file has never been curated.

**M3: Coverage threshold in CI (70%) conflicts with project standard (80%)**
10-point gap provides false confidence and conflicts with global agent rules.

**M4: Test jobs ignore the build artifact**
Three jobs each re-run full `poetry install --with=dev` independently. Wastes 6-9 minutes per
pipeline run.

**M5: sleep 15 as service readiness gate**
Fragile on slow or loaded runners.

**M6: CLAUDE.md contains no project-specific content**
417 lines of generic TaskMaster reference, duplicated across three simultaneously-loaded files
(~1200 total lines of context consumed before any project-specific information is reached).

**M7: .cursor/mcp.json committed with placeholder API keys**
Non-functional template. No security risk but confusing for Cursor users.

**M8: .kate-swp swap file staged for commit**
Editor artefact. Should not enter git history.

**M9: .dockerignore does not exclude .claude/**
`settings.local.json` with embedded credentials may be included in Docker build context.

### LOW

**L1: GitHub Actions uses major-version action refs, not SHA pins**
Low-probability supply chain risk for official actions.

**L2: `safety check` legacy CLI syntax**
Safety v3+ changed the interface. May produce misleading or empty output silently.

**L3: SSH key written via `echo` in deploy job**
`echo "$SSH_PRIVATE_KEY" > file` briefly exposes key in process arguments. Low risk in a GitLab
runner but a better pattern exists.

**L4: Rollback job references Docker tag never created by the pipeline**
`jidelnicek:previous` is assumed to exist but the pipeline never tags the current image `previous`
before overwriting it.

**L5: .taskmaster/config.json has default projectName and placeholder userId**
No functional impact.

**L6: .clinerules/self_improve.md references non-existent files**
`cursor_rules.md`, `changeset.md`, `.cline/rules/*.md` do not exist. Agents following this rule
will hit dead references at step 9 of the implementation loop.

**L7: remember plugin hook PID write fails when .remember/tmp/ is absent**
Benign functionally but produces error log noise on every post-tool save trigger after a fresh
clone or directory wipe.

---

## Recommended cleanups (ordered, safe to impactful)

1. Add `.claude/settings.local.json` and `*.kate-swp` to `.gitignore`, then run
   `git rm --cached .claude/settings.local.json .claude/.settings.local.json.kate-swp` to unstage
   both files. Resolves C1, C2, M8 with zero functional change.

2. Remove the ~28 dead rules (pipeline fragments, unparseable python -c blocks) and 13 exact
   duplicates from `settings.local.json`. Reduces 214 rules to ~170. No behaviour change since
   dead rules never match. Restores trust in the allowlist as a meaningful document.

3. Remove `|| true` from pytest invocations in `unit-tests` and `integration-tests`, and raise
   `--cov-fail-under` from 70 to 80. Makes the CI gate meaningful and aligns with the documented
   80% standard and global agent rules.

4. Set `allow_failure: false` on `security-scan`, or add a post-processing step that exits non-zero
   if Bandit finds HIGH or CRITICAL severity findings.

5. Add `permissions: pull-requests: write` and `contents: read` to `.github/workflows/i18n-check.yml`.
   Pin all action refs to commit SHAs.

6. Replace `sleep 15` with readiness loops using `pg_isready -h postgres -U test_user` and
   `redis-cli -h redis ping` in the three test jobs.

7. Add `dependencies: [build]` to `unit-tests`, `integration-tests`, and `performance-tests` to
   consume the pre-built `.venv/` artifact rather than reinstalling dependencies in each job.

8. Create a project-level `.mcp.json` with the `task-master-ai` server entry. Add a `docker` MCP
   server configuration or remove the docker MCP allow-rules and update `CLAUDE.local.md` to
   reflect the actual docker workflow.

9. Replace `CLAUDE.md` content with a concise project-specific brief covering stack, key directory
   layout, test commands, and environment setup. Reference TaskMaster docs by URL rather than
   embedding 400+ lines of CLI reference that duplicates `.clinerules/`.

10. Add a session-start script or Makefile target that runs `mkdir -p .remember/tmp` after clone to
    prevent the hook PID-write error. Document this in `DEVELOPMENT.md`.

---

## Open Questions

1. Is `settings.local.json` intentionally excluded from version control? If yes, add to `.gitignore`
   immediately. If it is meant to be committed as a shared team allowlist, the embedded credentials
   at lines 158-159 must be replaced with generic patterns before any commit.

2. Where is the `mcp__docker__*` server actually configured? `CLAUDE.local.md` says to use docker
   MCP but no server configuration exists in any scanned file. Is it in a global Cursor config not
   in scope?

3. Is the `jidelnicek:previous` Docker tag created anywhere outside this repository? The rollback
   job depends on it but the CI pipeline never creates it.

4. Is `ruff` actively used? It appears in both settings files' allowlists but is absent from CI
   quality checks. If adopted, it should replace `flake8` in CI for consistency.

5. Should performance regressions be caught on feature branches, or is `only: main` for
   `performance-tests` intentional to keep branch pipelines fast?
