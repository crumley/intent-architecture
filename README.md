# Intent architecture

A repository structure where a **durable statement of intent governs everything else**. A repo
stands on four parallel trees — `intent/` (the what & why), `design/` (the how, and the
chronological record of building it), `src/` (the code), and `test/` (the tests) — with `intent`
governing the other three. The full rules live in the skill below.

This repository is the canonical home for two things:

| Piece                                                                                | What it is                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`.agents/skills/intent-architecture/`](.agents/skills/intent-architecture/SKILL.md) | The **agent skill**: establishes, bootstraps, or refactors any repository into the four-leg structure. Agent- and model-agnostic content in the portable `SKILL.md` format.                                                                                                                                                    |
| [`template/`](template/)                                                             | The **getting-started repository template**: a ready-to-copy skeleton with the four legs, per-leg READMEs, `AGENTS.md`, and a pinned, mise-driven Markdown gate (dprint formatting + lychee link checking) that is green from a cold copy. Code toolchains are deliberately left to the adopting project's first design entry. |

[`AGENTS.md`](AGENTS.md) is the guide for working in this repo itself (`CLAUDE.md` is a symlink to
it — guidance lives once, under the harness-neutral name).

## Install the skill

The skill is a plain directory in the portable `SKILL.md` format; installing it is copying (or
symlinking) it into wherever your harness loads skills from. It lives under `.agents/` — the
harness-neutral home; harness-specific directories point at it, not the other way around:

```sh
git clone https://github.com/crumley/intent-architecture
# into a workspace's harness-neutral skills dir (.claude/skills etc. symlink to that):
ln -s "$PWD/intent-architecture/.agents/skills/intent-architecture" <workspace>/.agents/skills/
# or directly into one harness's own location, e.g. Claude Code:
ln -s "$PWD/intent-architecture/.agents/skills/intent-architecture" ~/.claude/skills/
```

Then ask the agent to apply the intent architecture to a repository — the skill mines existing docs
and code rather than inventing content, so it works on empty and mature repos alike.

## Start a repo from the template

Copy [`template/`](template/) as the root of a new repository:

```sh
npx degit crumley/intent-architecture/template my-project
cd my-project && git init
mise install && mise run check   # the gate is green before you write a line
```

Then follow the checklist at the top of the template's [`README.md`](template/README.md): name the
system, write the vision, and let the intent grow from there. The
[ward repository](https://github.com/crumley/ward) is a worked example of the same structure with
its intent filled in.

## This repo's own gate

Markdown here is held to the same bar the template ships: `mise run fmt` formats (dprint),
`mise run check` verifies formatting and links (dprint + lychee), and CI additionally proves the
template's own gate is green from a cold checkout. See [`mise.toml`](mise.toml).

## License

[MIT](LICENSE) — the skill and the template are free to copy, adapt, and relicense in the repos they
seed.
