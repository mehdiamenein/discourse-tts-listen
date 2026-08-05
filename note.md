# Workflow — voice-selection redesign + speed dropdown + docs

This effort is executed as a **separate branch, not on `main`**, then merged
via PR after the user approves. Capture of the full plan survives the
conversation compaction via this file and the scratch plan.

## Branch & guards

- Put **branch protection / guards on `main`**: no direct pushes; PRs only.
  (Open-source repo — safe to enforce.)
- All work happens on a **feature branch**: `feat/voice-selection-redesign`
  (one branch, several small commits — squash-merge at the end).
- Never open a PR from `main`.

## Execution sequence (per the agreed skill pipeline)

1. **request-refactor-plan** → master plan + tickets (GitHub issues). ← now
2. **tdd** → implement each ticket test-first, one at a time.
3. **code-review** → Standards + Spec review of the branch.
4. **github-operations** → commit (Conventional Commits), push, capture run id.
5. **Versioning** → bump version in `about.json` (and `package.json` if present).
6. **PR** → open PR from the feature branch, CI must be green (the gate).
7. **Hand off** → report to user: commits done, push done, PR ready. **STOP.**
   Do NOT merge. Wait for the user's confirmation.
8. On user confirmation → merge (squash).

## What the PR must contain (scope)

- `migrations/settings/0002-…` — drop `fallback_voice` (migrate to `auto`).
- `javascripts/discourse/lib/tts-selection.js` — normalize lang codes,
  restructure ladder, no `list[0]`, return a "no voice" signal.
- Player (`api-initializers/tts-listen.js`) — override persistence
  (`{lang,name}` in localStorage, site-wide), grouped-by-language dropdown
  with "Default (admin)" revert, no-voice notice, `show_no_voice_notice`.
- `settings.yml` — remove `fallback_voice`; add `show_no_voice_notice`;
  align `default_rate` to `min 0.1, max 2.0`, step 0.1, default 1.0;
  speed dropdown 0.1–2.0 in 0.1 steps.
- `locales/en.yml` + `de.yml` — notice strings, relabel `default_voice`,
  remove `fallback_voice`, new `show_no_voice_notice`, "Default (admin)"
  dropdown label.
- Tests (`test/javascripts/unit/`) — TDD the full ladder, normalization,
  override persistence, revert, notice path, speed steps.
- Docs — `README.md` + `README.de.md` (install, features, new ladder,
  settings table); ADRs 0006/0007 already written (+ .de); CONTEXT.md already
  updated; mark ADR 0001 amended (done).

## Decisions of record

- See `CONTEXT.md`, `docs/adr/0006-*`, `docs/adr/0007-*` (EN + DE),
  `docs/research/0001-android-voice-selection-bug.md`.

## Gate

CI (Discourse Theme workflow) must be green on the PR before the hand-off.
Never merge over a red run. Note: adding the first `test/**` file activates the
`frontend_tests` CI job — flag this in the PR (tests already exist, so the job
is already active).