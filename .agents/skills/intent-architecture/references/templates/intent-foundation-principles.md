# Principles & Constraints

> **Layer:** intent · foundation (global). The cross-cutting invariants every slice honors (the what
> & why). **Status:** <draft | placeholder skeleton>

## Purpose

The invariants that apply everywhere and outrank local convenience. Each carries its _why_, because
the reasoning is what lets a reader apply the principle to a case it does not literally name. Slices
honor these; they do not restate them.

## Principles

<A numbered list. Each line states the invariant and its _why_. Mine these from recurring rules in
the code and docs — "we always…", "never…", validation patterns, separation rules.>

1. **<Principle>** — <why>.
2. **<Principle>** — <why>.
3. **<Principle>** — <why>. <…>

## <Cross-cutting policy (optional)>

<If one policy recurs across many slices (e.g. a default-then-own-then-reconcile upgrade policy),
give it its one canonical home here and have the slices that use it link back.>

## Open questions

- <See `open-questions.md` for tensions that span slices.>
