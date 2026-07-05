# 0000 — <entry title>

> <One line: what this entry builds and why it exists.>
>
> **Status:** proposed | in-progress | accepted | superseded by `NNNN-<slug>/` · **Started:**
> YYYY-MM-DD

Copy this directory to `NNNN-<slug>/` (next number in sequence) for each unit of build work. Every
section stays — write "none this entry" rather than deleting one. The format and the rules it serves
are in [`../README.md`](../README.md).

## Serves intent

**Required.** The intent slice(s) this entry realizes, each linked by relative path, with a phrase
on how. An entry that cannot name the intent it serves is not ready to build.

## Scope

The contract this entry works to, and its exit test. Fill this **first**.

- **In:** what this entry builds, stated tightly.
- **Deferred:** what it deliberately does not build, and _why deferring is safe_.
- **Acceptance:** the check that says this entry is done — a command, a scenario, a test.

## Design

The _how_: the decisions and the shape they produce.

- **Decisions:** link each ADR in [`../decisions/`](../decisions/) this entry rests on; record here
  any entry-local choices too small for an ADR, each with its _why_.
- **Layout:** the modules/files this entry adds or changes, and why they are shaped that way.
- **Mechanisms:** the key moving parts, at the level a next builder needs to pick the work up.

## Build log

Append-only journal; newest entry at the bottom. One entry per iteration: **goal**, **what was
done**, **what works now — with the exact command that proves it**, **decisions**, **next**. No
"works" claim without a command.

## Spec-feedback

Intent frictions found while building — or **"none this entry."** Each entry: a stable id (`SF-NNN`,
unique within this entry), the intent slice + section, the friction, the **assumption** made to keep
moving, and a concrete **proposed revision** for human review. `intent/` is never silently
rewritten.
