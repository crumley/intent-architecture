# Review tool — Tests

The **tests** leg. Holds [`../src/`](../src/) to [`../design/`](../design/) and
[`../intent/`](../intent/). Run with `mise run test` (or the whole gate, `mise run check`).

- **Design tests** — the schemas' exact field rules, the scanner's reading of the spec-feedback
  convention, the server's endpoints. These move with the design.
- **Intent tests** — durable constraints that should survive any rebuild: an invalid verdict never
  reaches the decisions file, decisions are written whole or not at all, the server listens only on
  loopback and refuses foreign hosts, an annotation is re-found after its file is edited, and the
  shipped bundle runs under plain Node with only built-in modules.

Tests follow the repository's ethos: cases first as tables, setup at the bottom.
