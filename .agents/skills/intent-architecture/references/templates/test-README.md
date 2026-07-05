# <System> Tests

The **tests** leg. Holds the code in [`../src/`](../src/) to both the realization in
[`../design/`](../design/) and the constraints in [`../intent/`](../intent/).

> **Status:** <placeholder until the first implementation pass | active>.

Two kinds of test are expected, and the distinction matters because of the four-leg model:

- **Design / implementation tests** — that the code does what _this_ design says. These move and
  change with `design` + `src`.
- **Intent tests** — that the durable constraints hold regardless of design (the invariants in
  `../intent/`). These should survive a design swap; if one has to change because a tool changed, it
  was really a design test.

`test` moves with `design` and `src`; all three reconcile back to `intent` when they diverge.
