# AGENTS.md — working in this repository

The harness-neutral guide for any agent (or human) working here; **read it first**. (`CLAUDE.md` is
a symlink to this file — guidance lives once, under the neutral name.)

This repo is the canonical home of the **intent architecture**: the skill that teaches it, the
template that seeds it, and the review tool the skill ships. Markdown is the main artifact; the one
piece of code is the review tool, whose TypeScript source lives in its own subproject and whose
built, single-file bundle is committed inside the skill. Everything here is deliberately **agent-
and model-agnostic**: nothing may assume one harness, one vendor, or one model.

## Layout

- [`.agents/skills/intent-architecture/`](.agents/skills/intent-architecture/SKILL.md) — the
  **skill** (`SKILL.md` + `references/`). This copy is canonical: an edit here is an edit to the
  skill everyone installs — the repo is an installable skill package
  (`npx skills add crumley/intent-architecture` discovers it at this path). Keep it general-purpose
  — no project-specific content.
- [`tools/review/`](tools/review/README.md) — the **review tool**'s source: a subproject with its
  own four legs (`intent/`, `design/`, `src/`, `test/`), its own `AGENTS.md`, and its own gate
  (`mise run check` inside it, or `mise run review-check` from here). Its build output is one file
  in the skill, [`scripts/review.mjs`](.agents/skills/intent-architecture/scripts/review.mjs):
  generated, committed, and drift-checked — change the source and rebuild (`mise run build` in the
  subproject), never the bundle. The tool belongs to the skill, not the template, so the sync rule
  below does not reach it.
- [`template/`](template/) — the **getting-started template** copied into new repositories. It must
  stay generic (placeholders, no domain content) and must stay green under its own gate:
  `mise run check` inside `template/`, or `mise run template-check` from here. The skill's "start a
  NEW repository" section describes what the template ships — a change to one is a change to both;
  keep them in sync. In sync means **content-identical**: every rule, bullet, and section in one
  copy exists in the other — including each skill `references/templates/` skeleton and its
  `template/` counterpart — and only **register** may differ (skeletons keep angle-bracket
  placeholders, plain paths, and the gate named as a worked example; the template resolves
  placeholders, links live paths, and wires mise/dprint/lychee concretely).

## Conventions

- `mise run fmt` as you write; `mise run check` before you push. CI runs the same commands, plus the
  template's gate and the review tool's gate (bundle drift check included).
- The skill's `references/templates/` are skeletons whose relative links only resolve once
  instantiated in a target repo, so lychee excludes them ([`lychee.toml`](lychee.toml)). Links
  everywhere else — including all of `template/` — are checked and must stay live.
- Placeholders use `<angle brackets>`; prose is hard-wrapped at 100 columns (dprint enforces).
- Harness-specific names appear only as symlinks to neutral targets (`CLAUDE.md` → `AGENTS.md`);
  harness-local state (`.claude/` and similar) is gitignored, never tracked.
