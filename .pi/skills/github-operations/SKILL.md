---
name: github-operations
description: Run git and GitHub delivery for this repo — commits, pushes, branch naming, pull requests, and the CI/CD wait loop. Use when the user asks to commit or push changes, open or review a pull request, read CI or workflow results, or when a pushed run is waiting.
---

# GitHub Operations

Delivery here runs on **the loop**: commit → push → hand off → the user signals
→ read results → the **gate**. The gate is CI green: nothing counts as done
until every job on the run passes. The loop keeps the human in the loop by
design — the agent never polls; the user reports back.

## The loop

Five steps. Each step has a completion criterion — do not jump ahead of the
current step.

### 1. Commit

Inspect first: `git status`, `git diff`, `git diff --cached`, and
`git branch --show-current`. One logical change per commit; stage deliberately
(`git add -A` only after the diff is reviewed).

- Write the message by the rules in [Commit rules](#commit-rules).
- If the change set is unclear, confirm with the user what goes in before staging.

Completion: one commit exists, its message follows the rules, nothing unintended
is staged.

### 2. Push

Push the current branch (`git push origin <branch>`), then capture the run id
with `gh run list --limit 1`.

Completion: push succeeded and a run id is captured.

### 3. Hand off

Report to the user: commit hash, branch, and the run URL. Then **stop** — tell
the user the pipeline is running and to say the word when it is done. Do not
poll `gh run` yourself.

Completion: the user knows the run is running, and you have stopped working it.

### 4. Read results (only on the user's signal)

When the user says the run is done, read the conclusion with
`gh run view <id> --json conclusion` (or `gh run list --limit 1`).

Completion: you know the run's conclusion — green or red.

### 5. The gate

- **Green**: report success; if a PR is open and ready, ask about merging.
- **Red**: find the failing job (`gh run view <id> --job <job-id>`), read
  `gh run view <id> --job <job-id> --log-failed`, diagnose, fix, and start a
  new loop from step 1 with a fix commit.

Completion: every job is green, or a fix commit exists and a new run is in
flight. Never report a red run as done, and never merge over one.

## Commit rules

Conventional Commits: `type(scope): summary`. Lowercase type, imperative
summary under ~50 chars; the body explains *why* (motivation vs previous
behavior); the footer carries issue references (`Closes #N`) and
`BREAKING CHANGE:`.

- Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`, `perf`,
  `build`, `ci`, `revert`.
- Scope is the area touched: `feat(voice): add default and fallback voice
  settings`, `fix(test): correct theme test import path`.
- One concern per commit; never mix refactors with features.

Example:

```
feat(voice): add configurable default and fallback voice

Voice selection now prefers the configured default voice, then the
fallback, then the platform language. Extracted to a pure module so it
is unit-testable.

Closes #12
```

## Branch naming

Short-lived branches off `main`, one branch per change:
`feat/`, `fix/`, `docs/`, `chore/`, `ci/` + kebab-case slug.

- Good: `feat/default-voice-settings`, `fix/theme-test-import-path`
- Pushing straight to `main` is acceptable in this repo, but a pull request
  always comes from a named branch — never open a PR from `main`.

## Pull requests

Use [references/PR-TEMPLATE.md](references/PR-TEMPLATE.md) for the description.
Rules:

- Title mirrors the commit subject: imperative, conventional.
- Small, focused diff; include tests when behaviour changes.
- The gate applies to PRs too: all status checks green before merge.
- Prefer squash-merge when the branch carries many small commits.

## CI/CD handling

- Workflow: **Discourse Theme** runs on push to `main` and on pull requests.
  Jobs: `linting`, `frontend_tests` (QUnit in a Discourse container),
  `backend_tests`, `check_for_tests`.
- Local mirror: run `pnpm lint` before pushing so CI failures stay rare.
- Failure triage: read `--log-failed`; distinguish a code failure from an infra
  flake. Infra flake → `gh run rerun <id>`; code failure → fix commit → new
  loop.
- The `frontend_tests` job only activates once `test/**/*.{js,gjs}` exists —
  adding the first test file changes CI's job set, so say so explicitly in the
  PR.
- QUnit tests only execute in CI (Discourse container). Verify pure logic
  locally through Node, not by assuming CI will catch everything.

## References

- [PR template](references/PR-TEMPLATE.md)
