# Review tool themes

The review page ships six themes — **Gyokuro Desert**, **Gyokuro Desert OG**, **Gyokuro Dark**,
**Gyokuro Light** (from the Gyokuro theme family), and a plain **Neutral Light** and **Neutral
Dark** — chosen from the theme button in the page header (or the `t` key). It starts in Gyokuro
Desert or Gyokuro Light, following the system's light/dark setting, and remembers the last choice.

## Write your own

A theme is a small JSON file: an id, a name, a built-in theme to start from, and the colours to
change. Anything you leave out comes from the base.

```json
{
  "id": "my-theme",
  "name": "My theme",
  "base": "gyokuro-dark",
  "colors": {
    "accent": "#ff1493",
    "heading": "#ffd700",
    "xref": "#00e5ff"
  }
}
```

- `id` — lower-case letters, digits, and dashes; not the id of a built-in theme.
- `base` — one of `gyokuro-desert`, `gyokuro-desert-og`, `gyokuro-dark`, `gyokuro-light`,
  `neutral-light`, `neutral-dark`. It also decides whether the theme is light or dark.
- `colors` — any of the tokens below, each a CSS colour (`#rrggbb`, `rgb(…)`, `hsl(…)`, a name).

Make it available in either of two ways:

- **Put it in the themes directory** — every `*.json` file there is offered in the picker:
  `$INTENT_REVIEW_CONFIG/themes/` if that variable is set, else
  `$XDG_CONFIG_HOME/intent-review/themes/`, else `~/.config/intent-review/themes/`. The picker shows
  the exact path on your machine.
- **Pass it when serving** — `node review.mjs serve … --theme path/to/my-theme.json` loads it and
  starts in it. `--theme <id>` starts in any theme by id.

A file that does not validate is reported when the tool starts and skipped; a theme never stops a
review. Your last choice — and whether edits show inline or before / after — is remembered in
`prefs.json` beside the themes directory, never in the repository being reviewed.

## Tokens

| Token                                                                         | Used for                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `bg`, `surface`, `sunken`, `raised`                                           | Page background; reading surfaces; insets (excerpts, code); the ruling dock |
| `ink`, `ink-2`, `muted`, `faint`                                              | Body text; secondary text; captions; line numbers and Markdown markers      |
| `line`, `line-2`                                                              | Hairlines; control borders                                                  |
| `accent`, `accent-ink`, `accent-soft`                                         | Primary buttons and active tabs; text on them; selected backgrounds         |
| `heading`, `heading-2`                                                        | Titles and top-level headings; lower headings                               |
| `xref`                                                                        | Linked identifiers — SF ids, entry numbers, decisions, file paths           |
| `accent-passage`                                                              | Passage markers (the numbered badges), their margin rule and tint           |
| `focus`, `focus-line`                                                         | A spot jumped to from a link; the selected toggle                           |
| `accept`, `amend`, `decline`, `defer`, `revise`                               | The rulings; accept with changes mixes `accept` toward `amend`              |
| `hl-comment`, `hl-question`, `hl-suggestion`, `hl-intent-here`, `hl-mismatch` | Note highlights, by kind                                                    |
| `add-bg`, `add-strong`, `del-bg`, `del-strong`                                | Diff lines, and the changed words within them                               |
| `tk-kw`, `tk-str`, `tk-com`, `tk-num`, `tk-fn`, `tk-ty`, `tk-key`             | Syntax: keywords, strings, comments, numbers, calls, types, keys            |
| `shadow`                                                                      | Popover shadow (a CSS `box-shadow` value)                                   |

Keep text readable: the built-in themes hold every text and syntax colour at a contrast of at least
4.5:1 against `surface`, `bg`, and `sunken` (WCAG AA for body text), and `accent-ink` against
`accent`. A custom theme is not checked; aim for the same.
