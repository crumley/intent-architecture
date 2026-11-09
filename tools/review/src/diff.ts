// Word-level diff for rendering a proposed intent edit (before -> after).
// Tokens are runs of word characters, runs of whitespace, or single other
// characters, so a diff of hard-wrapped Markdown highlights words, not lines.

export type DiffPart = { op: 'same' | 'del' | 'ins'; text: string };

export function tokenize(s: string): string[] {
  return s.match(/\w+|\s+|[^\w\s]/gu) ?? [];
}

/** LCS diff over tokens; adjacent parts of the same op are merged. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  // Trim the common head and tail so the quadratic table covers only the change.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }
  const am = a.slice(head, a.length - tail);
  const bm = b.slice(head, b.length - tail);
  const n = am.length;
  const m = bm.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i] as Uint32Array;
    const next = dp[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) {
      row[j] =
        am[i] === bm[j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  const parts: DiffPart[] = [];
  const push = (op: DiffPart['op'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) last.text += text;
    else parts.push({ op, text });
  };
  if (head > 0) push('same', a.slice(0, head).join(''));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (am[i] === bm[j]) {
      push('same', am[i] as string);
      i++;
      j++;
    } else if (
      ((dp[i + 1] as Uint32Array)[j] as number) >= ((dp[i] as Uint32Array)[j + 1] as number)
    ) {
      push('del', am[i] as string);
      i++;
    } else {
      push('ins', bm[j] as string);
      j++;
    }
  }
  while (i < n) push('del', am[i++] as string);
  while (j < m) push('ins', bm[j++] as string);
  if (tail > 0) push('same', a.slice(a.length - tail).join(''));
  return cleanup(parts);
}

/**
 * Readability pass: a bare-whitespace "same" between two changes is folded
 * into them, so "-for|= |-resume" reads as one replaced phrase, not word soup.
 */
function cleanup(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  let del = '';
  let ins = '';
  const flush = () => {
    if (del) out.push({ op: 'del', text: del });
    if (ins) out.push({ op: 'ins', text: ins });
    del = '';
    ins = '';
  };
  parts.forEach((p, i) => {
    if (p.op === 'del') del += p.text;
    else if (p.op === 'ins') ins += p.text;
    else {
      const prev = parts[i - 1];
      const next = parts[i + 1];
      const between = prev && next && prev.op !== 'same' && next.op !== 'same';
      if (between && /^\s+$/.test(p.text)) {
        del += p.text;
        ins += p.text;
      } else {
        flush();
        out.push(p);
      }
    }
  });
  flush();
  return out;
}

/** One run of an aligned diff: the text on each side (`a` before, `b` after). */
export type AlignedPart = { op: 'same' | 'del' | 'ins'; a: string; b: string };

/**
 * A word diff that keeps both sides' own text, for prose that is hard-wrapped
 * differently on each side: whitespace compares equal unless one side has a
 * paragraph break, so a reflowed sentence is "same" — and each side's run keeps
 * its own line breaks, so a rendering can map a selection back to exact source.
 */
export function diffAligned(before: string, after: string): AlignedPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const key = (t: string) => (/^\s+$/.test(t) ? (/\n[ \t]*\n/.test(t) ? '\n\n' : ' ') : t);
  const ka = a.map(key);
  const kb = b.map(key);
  let head = 0;
  while (head < a.length && head < b.length && ka[head] === kb[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    ka[a.length - 1 - tail] === kb[b.length - 1 - tail]
  ) {
    tail++;
  }
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i] as Uint32Array;
    const next = dp[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) {
      row[j] =
        ka[head + i] === kb[head + j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  const parts: AlignedPart[] = [];
  const push = (op: AlignedPart['op'], x: string, y: string) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) {
      last.a += x;
      last.b += y;
    } else parts.push({ op, a: x, b: y });
  };
  for (let k = 0; k < head; k++) push('same', a[k] as string, b[k] as string);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ka[head + i] === kb[head + j]) {
      push('same', a[head + i] as string, b[head + j] as string);
      i++;
      j++;
    } else if (
      ((dp[i + 1] as Uint32Array)[j] as number) >= ((dp[i] as Uint32Array)[j + 1] as number)
    ) {
      push('del', a[head + i++] as string, '');
    } else {
      push('ins', '', b[head + j++] as string);
    }
  }
  while (i < n) push('del', a[head + i++] as string, '');
  while (j < m) push('ins', '', b[head + j++] as string);
  for (let k = tail; k > 0; k--) push('same', a[a.length - k] as string, b[b.length - k] as string);
  return cleanupAligned(parts);
}

/** As `cleanup`: bare whitespace between two changes joins them, so a phrase reads as replaced. */
function cleanupAligned(parts: AlignedPart[]): AlignedPart[] {
  const out: AlignedPart[] = [];
  let da = '';
  let ib = '';
  const flush = () => {
    if (da) out.push({ op: 'del', a: da, b: '' });
    if (ib) out.push({ op: 'ins', a: '', b: ib });
    da = '';
    ib = '';
  };
  parts.forEach((p, k) => {
    if (p.op === 'del') da += p.a;
    else if (p.op === 'ins') ib += p.b;
    else {
      const prev = parts[k - 1];
      const next = parts[k + 1];
      const between = prev && next && prev.op !== 'same' && next.op !== 'same';
      if (between && /^\s+$/.test(p.a) && /^\s+$/.test(p.b)) {
        da += p.a;
        ib += p.b;
      } else {
        flush();
        out.push(p);
      }
    }
  });
  flush();
  return out;
}
