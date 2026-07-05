# AGENTS.md — working in this repository

The harness-neutral guide for any agent (or human) working here; **read it first**. (`CLAUDE.md` is
a symlink to this file — guidance lives once, under the neutral name.)

This repo is the canonical home of the **intent architecture**: the skill that teaches it and the
template that seeds it. It is a docs-only repo — Markdown is the artifact, and everything in it is
deliberately **agent- and model-agnostic**: nothing here may assume one harness, one vendor, or one
model.

## Layout

- [`.agents/skills/intent-architecture/`](.agents/skills/intent-architecture/SKILL.md) — the
  **skill** (`SKILL.md` + `references/`). This copy is canonical: an edit here is an edit to the
  skill everyone installs. Keep it general-purpose — no project-specific content.
- [`template/`](template/) — the **getting-started template** copied into new repositories. It must
  stay generic (placeholders, no domain content) and must stay green under its own gate:
  `mise run check` inside `template/`, or `mise run template-check` from here.

## Conventions

- `mise run fmt` as you write; `mise run check` before you push. CI runs the same commands.
- The skill's `references/templates/` are skeletons whose relative links only resolve once
  instantiated in a target repo, so lychee excludes them ([`lychee.toml`](lychee.toml)). Links
  everywhere else — including all of `template/` — are checked and must stay live.
- Placeholders use `<angle brackets>`; prose is hard-wrapped at 100 columns (dprint enforces).
- Harness-specific names appear only as symlinks to neutral targets (`CLAUDE.md` → `AGENTS.md`);
  harness-local state (`.claude/` and similar) is gitignored, never tracked.
