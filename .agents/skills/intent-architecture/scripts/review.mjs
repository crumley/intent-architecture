#!/usr/bin/env node
// GENERATED FILE — do not edit. Built from tools/review/ in the intent-architecture
// repository (`mise run build` there); CI fails if this file differs from a fresh build.
// The intent review tool: `node review.mjs --help`. Node >= 20, built-in modules only.
// src/cli.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname2, join as join3, resolve } from "node:path";

// src/anchor.ts
function lineOf(text, offset) {
  let line = 1;
  for (let i = 0;i < offset && i < text.length; i++)
    if (text.charCodeAt(i) === 10)
      line++;
  return line;
}
function commonSuffix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n])
    n++;
  return n;
}
function commonPrefix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n])
    n++;
  return n;
}
function occurrences(text, needle) {
  const out = [];
  if (needle === "")
    return out;
  for (let i = text.indexOf(needle);i !== -1; i = text.indexOf(needle, i + 1))
    out.push(i);
  return out;
}
function locate(text, sel, hint) {
  const hits = occurrences(text, sel.exact);
  if (hits.length > 0) {
    let best = hits[0];
    let bestScore = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const at of hits) {
      const before = text.slice(Math.max(0, at - sel.prefix.length), at);
      const after = text.slice(at + sel.exact.length, at + sel.exact.length + sel.suffix.length);
      const score = commonSuffix(before, sel.prefix) + commonPrefix(after, sel.suffix);
      const dist = hint === undefined ? 0 : Math.abs(at - hint);
      if (score > bestScore || score === bestScore && dist < bestDist) {
        best = at;
        bestScore = score;
        bestDist = dist;
      }
    }
    return { status: "exact", start: best, end: best + sel.exact.length, line: lineOf(text, best) };
  }
  if (sel.prefix.length >= 8 && sel.suffix.length >= 8) {
    const window = Math.max(sel.exact.length * 4, sel.exact.length + 200);
    let best = null;
    for (const p of occurrences(text, sel.prefix)) {
      const start = p + sel.prefix.length;
      const s = text.indexOf(sel.suffix, start);
      if (s === -1 || s - start > window)
        continue;
      const dist = hint === undefined ? 0 : Math.abs(start - hint);
      if (!best || dist < best.dist)
        best = { start, end: s, dist };
    }
    if (best) {
      return {
        status: "context",
        start: best.start,
        end: best.end,
        line: lineOf(text, best.start),
        text: text.slice(best.start, best.end)
      };
    }
  }
  return { status: "orphaned" };
}

// src/scan.ts
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, posix, relative, sep } from "node:path";

// src/schema.ts
var PACKET_KIND = "intent-review-packet";
var DECISIONS_KIND = "intent-review-decisions";
var DRAFT_KIND = "intent-review-draft";
var SCHEMA_VERSION = 1;
var MODES = ["main", "branch"];
var isIntentFeedback = (kind) => kind === "if" || kind === "sf";
var IF_STATUSES = ["pending", "ruled", "adjudicated", "declined"];
var VERDICTS = ["accept", "amend", "decline", "defer", "revise"];
var OVERALL = ["approve", "request-changes", "comment"];
var ANNOTATION_KINDS = [
  "comment",
  "question",
  "suggestion",
  "intent-here",
  "mismatch"
];
var CHANGE_STATUSES = ["added", "modified", "deleted", "renamed"];
var REQUIRED_WORDS = {
  accept: null,
  amend: "wording",
  decline: "why",
  defer: null,
  revise: "request"
};

class Checker {
  errors = [];
  fail(path, message) {
    this.errors.push({ path, message });
    return false;
  }
  object(v, path) {
    if (typeof v === "object" && v !== null && !Array.isArray(v))
      return true;
    return this.fail(path, "must be an object");
  }
  array(v, path) {
    return Array.isArray(v) || this.fail(path, "must be an array");
  }
  string(v, path, opts = {}) {
    if (typeof v !== "string")
      return this.fail(path, "must be a string");
    if (opts.nonEmpty && v.trim() === "")
      return this.fail(path, "must not be empty");
    return true;
  }
  optString(v, path) {
    return v === undefined || this.string(v, path);
  }
  int(v, path, min = 0) {
    if (typeof v === "number" && Number.isInteger(v) && v >= min)
      return true;
    return this.fail(path, `must be an integer >= ${min}`);
  }
  oneOf(v, allowed, path) {
    if (typeof v === "string" && allowed.includes(v))
      return true;
    return this.fail(path, `must be one of ${allowed.map((a) => `"${a}"`).join(", ")}`);
  }
  header(v, kind) {
    if (v.kind !== kind)
      return this.fail("kind", `must be "${kind}"`);
    if (v.version !== SCHEMA_VERSION) {
      return this.fail("version", `unsupported version ${JSON.stringify(v.version)}; this tool reads ${SCHEMA_VERSION}`);
    }
    return true;
  }
}
function done(c, v) {
  return c.errors.length === 0 ? { ok: true, value: v } : { ok: false, errors: c.errors };
}
function validatePacket(v) {
  const c = new Checker;
  if (!c.object(v, "$"))
    return done(c, v);
  if (!c.header(v, PACKET_KIND))
    return done(c, v);
  const modeOk = c.oneOf(v.mode, MODES, "mode");
  c.string(v.title, "title", { nonEmpty: true });
  c.string(v.createdAt, "createdAt", { nonEmpty: true });
  if (v.iteration !== undefined)
    c.int(v.iteration, "iteration", 1);
  if (c.object(v.repo, "repo")) {
    c.string(v.repo.name, "repo.name", { nonEmpty: true });
    c.optString(v.repo.root, "repo.root");
    c.optString(v.repo.ref, "repo.ref");
  }
  c.optString(v.reviewer, "reviewer");
  c.optString(v.intro, "intro");
  c.optString(v.producer, "producer");
  if (v.omitted !== undefined && c.array(v.omitted, "omitted")) {
    v.omitted.forEach((o, i) => {
      if (!c.object(o, `omitted[${i}]`))
        return;
      c.string(o.path, `omitted[${i}].path`, { nonEmpty: true });
      c.string(o.reason, `omitted[${i}].reason`, { nonEmpty: true });
    });
  }
  if (v.change !== undefined || modeOk && v.mode === "branch") {
    if (c.object(v.change, "change")) {
      for (const side of ["base", "head"]) {
        if (c.object(v.change[side], `change.${side}`)) {
          c.string(v.change[side].ref, `change.${side}.ref`, { nonEmpty: true });
          c.string(v.change[side].sha, `change.${side}.sha`, { nonEmpty: true });
        }
      }
      c.optString(v.change.summary, "change.summary");
      const rec = v.change.recommendation;
      if (rec !== undefined && c.object(rec, "change.recommendation")) {
        c.oneOf(rec.verdict, OVERALL, "change.recommendation.verdict");
        c.string(rec.why, "change.recommendation.why", { nonEmpty: true });
      }
    }
  }
  const files = new Set;
  if (c.array(v.files, "files")) {
    v.files.forEach((f, i) => {
      const p = `files[${i}]`;
      if (!c.object(f, p))
        return;
      if (c.string(f.path, `${p}.path`, { nonEmpty: true })) {
        if (files.has(f.path))
          c.fail(`${p}.path`, `duplicate file "${f.path}"`);
        files.add(f.path);
      }
      c.string(f.text, `${p}.text`);
    });
  }
  const filePath = (x, p) => {
    if (c.string(x, p, { nonEmpty: true }) && !files.has(x)) {
      c.fail(p, `"${x}" is not in files[]`);
    }
  };
  const refs = (x, p) => {
    if (!c.array(x, p))
      return;
    x.forEach((r, j) => {
      const rp = `${p}[${j}]`;
      if (!c.object(r, rp))
        return;
      filePath(r.path, `${rp}.path`);
      c.optString(r.section, `${rp}.section`);
      c.optString(r.quote, `${rp}.quote`);
      c.optString(r.note, `${rp}.note`);
      if (r.lines !== undefined && c.object(r.lines, `${rp}.lines`)) {
        const okS = c.int(r.lines.start, `${rp}.lines.start`, 1);
        const okE = c.int(r.lines.end, `${rp}.lines.end`, 1);
        if (okS && okE && r.lines.end < r.lines.start)
          c.fail(`${rp}.lines`, "end is before start");
      }
    });
  };
  const ids = new Set;
  const relationRefs = [];
  if (c.array(v.items, "items")) {
    v.items.forEach((it, i) => {
      const p = `items[${i}]`;
      if (!c.object(it, p))
        return;
      if (c.string(it.id, `${p}.id`, { nonEmpty: true })) {
        if (ids.has(it.id))
          c.fail(`${p}.id`, `duplicate item id "${it.id}"`);
        ids.add(it.id);
      }
      const kindOk = c.string(it.kind, `${p}.kind`, { nonEmpty: true });
      c.optString(it.category, `${p}.category`);
      c.string(it.title, `${p}.title`, { nonEmpty: true });
      if (it.status !== undefined || kindOk && isIntentFeedback(it.kind)) {
        c.oneOf(it.status, IF_STATUSES, `${p}.status`);
      }
      c.optString(it.statusLine, `${p}.statusLine`);
      c.optString(it.baseStatusLine, `${p}.baseStatusLine`);
      if (it.attention !== undefined) {
        c.oneOf(it.attention, ["judgment", "routine"], `${p}.attention`);
      }
      if (it.changes !== undefined && c.array(it.changes, `${p}.changes`)) {
        it.changes.forEach((ch, j) => {
          const cp = `${p}.changes[${j}]`;
          if (!c.object(ch, cp))
            return;
          c.string(ch.path, `${cp}.path`, { nonEmpty: true });
          c.oneOf(ch.status, CHANGE_STATUSES, `${cp}.status`);
          c.optString(ch.oldPath, `${cp}.oldPath`);
          c.string(ch.patch, `${cp}.patch`);
        });
      }
      if (c.object(it.source, `${p}.source`)) {
        c.string(it.source.path, `${p}.source.path`, { nonEmpty: true });
        c.int(it.source.line, `${p}.source.line`, 1);
      }
      refs(it.evidence, `${p}.evidence`);
      if (it.context !== undefined)
        refs(it.context, `${p}.context`);
      if (c.array(it.sections, `${p}.sections`)) {
        const keys = new Set;
        it.sections.forEach((s, j) => {
          const sp = `${p}.sections[${j}]`;
          if (!c.object(s, sp))
            return;
          if (c.string(s.key, `${sp}.key`, { nonEmpty: true })) {
            if (keys.has(s.key))
              c.fail(`${sp}.key`, `duplicate section key "${s.key}"`);
            keys.add(s.key);
          }
          c.string(s.label, `${sp}.label`, { nonEmpty: true });
          c.string(s.text, `${sp}.text`);
        });
      }
      if (it.proposal !== undefined && c.object(it.proposal, `${p}.proposal`)) {
        c.optString(it.proposal.summary, `${p}.proposal.summary`);
        if (c.array(it.proposal.edits, `${p}.proposal.edits`)) {
          it.proposal.edits.forEach((e, j) => {
            const ep = `${p}.proposal.edits[${j}]`;
            if (!c.object(e, ep))
              return;
            filePath(e.path, `${ep}.path`);
            c.string(e.before, `${ep}.before`, { nonEmpty: true });
            c.string(e.after, `${ep}.after`);
          });
        }
      }
      if (it.analysis !== undefined && c.object(it.analysis, `${p}.analysis`)) {
        const a = it.analysis;
        for (const k of ["summary", "ifAccepted", "ifDeclined"]) {
          c.optString(a[k], `${p}.analysis.${k}`);
        }
        if (a.relations !== undefined && c.array(a.relations, `${p}.analysis.relations`)) {
          a.relations.forEach((r, j) => {
            const rp = `${p}.analysis.relations[${j}]`;
            if (!c.object(r, rp))
              return;
            if (c.string(r.item, `${rp}.item`, { nonEmpty: true })) {
              relationRefs.push({ id: r.item, path: `${rp}.item` });
            }
            c.string(r.note, `${rp}.note`, { nonEmpty: true });
          });
        }
        if (a.recommendation !== undefined) {
          const rp = `${p}.analysis.recommendation`;
          if (c.object(a.recommendation, rp)) {
            c.oneOf(a.recommendation.verdict, VERDICTS, `${rp}.verdict`);
            c.string(a.recommendation.why, `${rp}.why`, { nonEmpty: true });
          }
        }
      }
    });
  }
  for (const r of relationRefs) {
    if (!ids.has(r.id))
      c.fail(r.path, `"${r.id}" is not an item id`);
  }
  if (v.ledger !== undefined && c.array(v.ledger, "ledger")) {
    v.ledger.forEach((row, i) => {
      const p = `ledger[${i}]`;
      if (!c.object(row, p))
        return;
      c.string(row.id, `${p}.id`, { nonEmpty: true });
      c.string(row.entry, `${p}.entry`, { nonEmpty: true });
      c.string(row.title, `${p}.title`, { nonEmpty: true });
      c.oneOf(row.status, IF_STATUSES, `${p}.status`);
      if (c.array(row.slices, `${p}.slices`)) {
        row.slices.forEach((s, j) => {
          c.string(s, `${p}.slices[${j}]`);
        });
      }
      if (c.object(row.source, `${p}.source`)) {
        c.string(row.source.path, `${p}.source.path`, { nonEmpty: true });
        c.int(row.source.line, `${p}.source.line`, 1);
      }
      c.optString(row.statusLine, `${p}.statusLine`);
    });
  }
  return done(c, v);
}
function checkState(c, v, rules) {
  const { strict, packet } = rules;
  if (strict)
    c.string(v.reviewer, "reviewer", { nonEmpty: true });
  else
    c.string(v.reviewer, "reviewer");
  c.optString(v.comment, "comment");
  if (v.overall !== undefined && c.object(v.overall, "overall")) {
    c.oneOf(v.overall.verdict, OVERALL, "overall.verdict");
    c.optString(v.overall.note, "overall.note");
  } else if (v.overall === undefined && strict && packet?.mode === "branch") {
    c.fail("overall", "a branch review needs an overall verdict (approve, request-changes, or comment)");
  }
  const items = packet ? new Set(packet.items.map((i) => i.id)) : null;
  const sections = packet ? new Map(packet.items.map((i) => [i.id, new Set(i.sections.map((s) => s.key))])) : null;
  const files = packet ? new Set(packet.files.map((f) => f.path)) : null;
  if (c.array(v.verdicts, "verdicts")) {
    const seen = new Set;
    v.verdicts.forEach((x, i) => {
      const p = `verdicts[${i}]`;
      if (!c.object(x, p))
        return;
      if (c.string(x.item, `${p}.item`, { nonEmpty: true })) {
        if (seen.has(x.item))
          c.fail(`${p}.item`, `more than one verdict for "${x.item}"`);
        seen.add(x.item);
        if (items && !items.has(x.item))
          c.fail(`${p}.item`, `"${x.item}" is not in the packet`);
      }
      for (const k of ["wording", "why", "ruling", "request", "note"]) {
        c.optString(x[k], `${p}.${k}`);
      }
      if (c.oneOf(x.verdict, VERDICTS, `${p}.verdict`) && strict) {
        const need = REQUIRED_WORDS[x.verdict];
        if (need && (typeof x[need] !== "string" || x[need].trim() === "")) {
          c.fail(`${p}.${need}`, `a "${x.verdict}" verdict needs its ${need}`);
        }
      }
    });
  }
  if (c.array(v.annotations, "annotations")) {
    const seen = new Set;
    v.annotations.forEach((a, i) => {
      const p = `annotations[${i}]`;
      if (!c.object(a, p))
        return;
      if (c.string(a.id, `${p}.id`, { nonEmpty: true })) {
        if (seen.has(a.id))
          c.fail(`${p}.id`, `duplicate annotation id "${a.id}"`);
        seen.add(a.id);
      }
      if (c.object(a.target, `${p}.target`)) {
        const t = a.target;
        if (c.oneOf(t.kind, ["file", "item"], `${p}.target.kind`)) {
          if (t.kind === "file") {
            if (c.string(t.path, `${p}.target.path`, { nonEmpty: true }) && files) {
              if (!files.has(t.path))
                c.fail(`${p}.target.path`, `"${t.path}" is not in the packet`);
            }
          } else {
            const okItem = c.string(t.item, `${p}.target.item`, { nonEmpty: true });
            const okSec = c.string(t.section, `${p}.target.section`, { nonEmpty: true });
            if (okItem && okSec && sections) {
              const keys = sections.get(t.item);
              if (!keys)
                c.fail(`${p}.target.item`, `"${t.item}" is not in the packet`);
              else if (!keys.has(t.section)) {
                c.fail(`${p}.target.section`, `"${t.section}" is not a section of "${t.item}"`);
              }
            }
          }
        }
      }
      if (c.object(a.selector, `${p}.selector`)) {
        c.string(a.selector.exact, `${p}.selector.exact`, { nonEmpty: true });
        c.string(a.selector.prefix, `${p}.selector.prefix`);
        c.string(a.selector.suffix, `${p}.selector.suffix`);
      }
      if (a.at !== undefined && c.object(a.at, `${p}.at`)) {
        c.int(a.at.start, `${p}.at.start`);
        c.int(a.at.end, `${p}.at.end`);
        c.int(a.at.line, `${p}.at.line`, 1);
      }
      if (a.item !== undefined && c.string(a.item, `${p}.item`) && items && !items.has(a.item)) {
        c.fail(`${p}.item`, `"${a.item}" is not in the packet`);
      }
      const kindOk = c.oneOf(a.kind, ANNOTATION_KINDS, `${p}.kind`);
      if (strict)
        c.string(a.comment, `${p}.comment`, { nonEmpty: a.kind !== "suggestion" });
      else
        c.string(a.comment, `${p}.comment`);
      c.optString(a.suggestion, `${p}.suggestion`);
      if (strict && kindOk && a.kind === "suggestion" && typeof a.suggestion !== "string") {
        c.fail(`${p}.suggestion`, "a suggestion needs its replacement text");
      }
      c.string(a.createdAt, `${p}.createdAt`, { nonEmpty: true });
    });
  }
}
function checkPacketRef(c, v) {
  if (!c.object(v, "packet"))
    return;
  c.string(v.title, "packet.title", { nonEmpty: true });
  c.string(v.createdAt, "packet.createdAt", { nonEmpty: true });
  c.oneOf(v.mode, MODES, "packet.mode");
  if (v.iteration !== undefined)
    c.int(v.iteration, "packet.iteration", 1);
  if (c.string(v.digest, "packet.digest") && !/^sha256:[0-9a-f]{64}$/.test(v.digest)) {
    c.fail("packet.digest", 'must be "sha256:" followed by 64 hex digits');
  }
}
function validateSubmission(v, packet) {
  const c = new Checker;
  if (c.object(v, "$"))
    checkState(c, v, { strict: true, packet });
  return done(c, v);
}
function validateDecisions(v, packet) {
  const c = new Checker;
  if (!c.object(v, "$"))
    return done(c, v);
  if (!c.header(v, DECISIONS_KIND))
    return done(c, v);
  checkPacketRef(c, v.packet);
  c.string(v.submittedAt, "submittedAt", { nonEmpty: true });
  checkState(c, v, packet ? { strict: true, packet } : { strict: true });
  return done(c, v);
}
function validateDraft(v) {
  const c = new Checker;
  if (!c.object(v, "$"))
    return done(c, v);
  if (!c.header(v, DRAFT_KIND))
    return done(c, v);
  checkPacketRef(c, v.packet);
  checkState(c, v, { strict: false });
  return done(c, v);
}
function packetRef(packet, digest) {
  const ref = {
    title: packet.title,
    createdAt: packet.createdAt,
    mode: packet.mode,
    digest
  };
  if (packet.iteration !== undefined)
    ref.iteration = packet.iteration;
  return ref;
}
function toDecisions(state, ref, submittedAt) {
  const d = {
    kind: DECISIONS_KIND,
    version: SCHEMA_VERSION,
    packet: ref,
    reviewer: state.reviewer.trim(),
    submittedAt,
    verdicts: state.verdicts.map(cleanVerdict),
    annotations: state.annotations.map(cleanAnnotation)
  };
  if (state.comment?.trim())
    d.comment = state.comment;
  if (state.overall) {
    d.overall = { verdict: state.overall.verdict };
    if (state.overall.note?.trim())
      d.overall.note = state.overall.note;
  }
  return d;
}
function pick(v, keys) {
  const out = {};
  for (const k of keys)
    if (v[k] !== undefined)
      out[k] = v[k];
  return out;
}
function cleanVerdict(v) {
  const need = REQUIRED_WORDS[v.verdict];
  const keys = ["item", "verdict"];
  if (need)
    keys.push(need);
  if (v.verdict === "defer" && v.ruling?.trim())
    keys.push("ruling");
  if (v.note?.trim())
    keys.push("note");
  return pick(v, keys);
}
function cleanAnnotation(a) {
  const out = pick(a, ["id", "target", "item", "selector", "at", "kind", "comment", "createdAt"]);
  out.target = a.target.kind === "file" ? { kind: "file", path: a.target.path } : { kind: "item", item: a.target.item, section: a.target.section };
  out.selector = { exact: a.selector.exact, prefix: a.selector.prefix, suffix: a.selector.suffix };
  if (a.kind === "suggestion" && a.suggestion !== undefined)
    out.suggestion = a.suggestion;
  return out;
}
function formatErrors(errors) {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join(`
`);
}

// src/scan.ts
var MAX_FILE_BYTES = 1024 * 1024;
var SF_HEADING = /^#{2,3}\s+((?:IF|SF)-\d+)\s*(?:[—–:-]+\s*(.*))?$/;
var FEEDBACK_FILE = /^design\/(\d{4}-[^/]+)\/(?:intent|spec)-feedback\.md$/;
var normalizeIf = (id) => id.replace(/^SF-/, "IF-");
var BULLET = /^- \*\*([^*]+?):\*\*\s?(.*)$/;
var LINK = /\]\(([^)\s]+)\)/g;
var OPEN_QUESTIONS = "intent/00-foundation/open-questions.md";
function scanRepo(root, opts = {}) {
  return opts.base === undefined ? scanMain(root, opts) : scanBranch(root, opts.base, opts);
}
function scanMain(root, opts) {
  const warnings = [];
  const tree = opts.ref === undefined ? fsTree(root) : gitTree(root, resolveRef(root, opts.ref));
  const fileText = new Map(readIntent(tree).map((f) => [f.path, f.text]));
  const items = [];
  const ledger = [];
  for (const sf of allSfs(tree, fileText, warnings)) {
    ledger.push(sf.row);
    if (sf.row.status === "pending" || sf.row.status === "ruled")
      items.push(sf.item);
  }
  if (opts.questions !== false) {
    const text = fileText.get(OPEN_QUESTIONS);
    if (text !== undefined)
      items.push(...parseOpenQuestions(text, OPEN_QUESTIONS));
  }
  items.push(...proposedDecisions(tree));
  const { files, omitted } = snapshot(tree, opts.files === "intent" ? ["intent/"] : [""]);
  const name = basename(root);
  const ref = opts.ref === undefined ? gitRef(root, "HEAD") : gitRef(root, opts.ref);
  const packet = {
    kind: PACKET_KIND,
    version: 1,
    mode: "main",
    title: `Intent review — ${name}`,
    createdAt: (opts.now ?? new Date).toISOString(),
    iteration: 1,
    producer: "open-items",
    repo: ref ? { name, root, ref } : { name, root },
    items,
    files,
    ledger
  };
  if (omitted.length)
    packet.omitted = omitted;
  return { packet, warnings };
}
function proposedDecisions(tree) {
  const out = [];
  for (const path of tree.list("design/decisions/")) {
    if (!/\/\d{4}-[^/]+\.md$/.test(path) || /\/0000-/.test(path))
      continue;
    const text = tree.read(path) ?? "";
    const status = /\*\*Status:\*\*\s*`?([a-z-]+)/i.exec(text)?.[1]?.toLowerCase();
    if (status !== "proposed")
      continue;
    const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? path;
    out.push({
      id: path,
      kind: "decision",
      title,
      source: { path, line: 1 },
      evidence: [{ path }],
      sections: []
    });
  }
  return out;
}
function snapshot(tree, prefixes) {
  const files = [];
  const omitted = [];
  const seen = new Set;
  for (const prefix of prefixes) {
    for (const path of tree.list(prefix)) {
      if (seen.has(path))
        continue;
      seen.add(path);
      const text = tree.read(path);
      if (text === undefined)
        continue;
      if (text.includes("\x00"))
        omitted.push({ path, reason: "binary" });
      else if (text.length > MAX_FILE_BYTES) {
        omitted.push({ path, reason: `too large (${Math.round(text.length / 1024)} KiB)` });
      } else
        files.push({ path, text });
    }
  }
  return { files, omitted };
}
function allSfs(tree, intent, warnings) {
  const out = [];
  for (const path of tree.list("design/")) {
    const m = FEEDBACK_FILE.exec(path);
    if (!m || m[1].startsWith("0000-"))
      continue;
    const parsed = parseSpecFeedback(tree.read(path) ?? "", path, m[1], intent);
    warnings.push(...parsed.warnings);
    out.push(...parsed.sfs);
  }
  return out;
}
function scanBranch(root, base, opts) {
  const warnings = [];
  const headRef = opts.head ?? "HEAD";
  const headSha = resolveRef(root, headRef);
  const baseSha = git(root, ["merge-base", resolveRef(root, base), headSha]).trim();
  const head = gitTree(root, headSha);
  const baseTree = gitTree(root, baseSha);
  const changed = git(root, [
    "diff",
    "--name-status",
    "-M",
    baseSha,
    headSha,
    "--",
    "intent",
    "design"
  ]).split(`
`).filter(Boolean).map(parseNameStatus);
  const patchOf = (c) => git(root, ["diff", "-M", baseSha, headSha, "--", ...c.oldPath ? [c.oldPath] : [], c.path]);
  const change = (c) => {
    const fc = { path: c.path, status: c.status, patch: patchOf(c) };
    if (c.oldPath)
      fc.oldPath = c.oldPath;
    return fc;
  };
  const intentText = new Map(readIntent(head).map((f) => [f.path, f.text]));
  const changedDesign = changed.filter((c) => c.path.startsWith("design/") && c.status !== "deleted").map((c) => c.path);
  const { files, omitted } = opts.files === "intent" ? snapshot(head, ["intent/", ...changedDesign]) : snapshot(head, [""]);
  const inSnapshot = new Set(files.map((f) => f.path));
  const items = [];
  for (const c of changed.filter((x) => x.path.startsWith("intent/"))) {
    const fc = change(c);
    const item = {
      id: `intent-change/${c.path}`,
      kind: "intent-change",
      title: `${c.path} — ${c.status}`,
      attention: "judgment",
      source: { path: c.path, line: firstHunkLine(fc.patch) },
      evidence: inSnapshot.has(c.path) ? [{ path: c.path }] : [],
      sections: [],
      changes: [fc]
    };
    items.push(item);
  }
  const baseIntent = new Map(readIntent(baseTree).map((f) => [f.path, f.text]));
  for (const c of changed.filter((x) => FEEDBACK_FILE.test(x.path))) {
    if (c.status === "deleted")
      continue;
    const entry = c.path.split("/")[1];
    const now = parseSpecFeedback(head.read(c.path) ?? "", c.path, entry, intentText);
    const was = parseSpecFeedback(baseTree.read(c.oldPath ?? c.path) ?? "", c.path, entry, baseIntent);
    warnings.push(...now.warnings);
    const before = new Map(was.sfs.map((s) => [s.item.id, s]));
    for (const sf of now.sfs) {
      const prev = before.get(sf.item.id);
      let note = null;
      if (!prev)
        note = "Raised on this branch.";
      else if ((prev.item.statusLine ?? "") !== (sf.item.statusLine ?? "")) {
        note = `Status changed on this branch — was: ${prev.item.statusLine ?? "pending (no Status line)"}`;
        if (prev.item.statusLine)
          sf.item.baseStatusLine = prev.item.statusLine;
      } else if (prev.body !== sf.body)
        note = "Text edited on this branch.";
      if (!note)
        continue;
      sf.item.attention = "judgment";
      sf.item.sections.unshift({ key: "on-branch", label: "On this branch", text: note });
      items.push(sf.item);
    }
  }
  const groups = new Map;
  for (const c of changed.filter((x) => x.path.startsWith("design/"))) {
    const m = /^design\/(decisions\/[^/]+|\d{4}-[^/]+)\//.exec(`${c.path}/`);
    const key = m ? m[1].replace(/\/$/, "") : "(other)";
    const k = key.startsWith("decisions/") ? key : key.split("/")[0];
    groups.set(k, [...groups.get(k) ?? [], c]);
  }
  const decisionItems = [];
  const entryItems = [];
  for (const [key, cs] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const isDecision = key.startsWith("decisions/");
    const main = isDecision ? cs[0] : cs.find((c) => c.path.endsWith("/README.md")) ?? cs[0];
    const mainText = main && main.status !== "deleted" ? head.read(main.path) : undefined;
    const h1 = mainText ? /^#\s+(.+)$/m.exec(mainText)?.[1]?.trim() : undefined;
    const added = cs.every((c) => c.status === "added");
    const status = added ? "added" : cs.every((c) => c.status === "deleted") ? "deleted" : "modified";
    const item = {
      id: isDecision ? `design/${key}` : `design/${key}`,
      kind: isDecision ? "decision" : "design-entry",
      title: `${h1 ?? (key === "(other)" ? "design/ (other files)" : key)} — ${status}`,
      source: { path: main?.path ?? "design/", line: 1 },
      evidence: [],
      sections: [],
      changes: cs.map(change)
    };
    const context = mainText ? intentLinks(mainText, main?.path ?? "", intentText) : [];
    if (context.length)
      item.context = context;
    (isDecision ? decisionItems : entryItems).push(item);
  }
  items.push(...decisionItems, ...entryItems);
  const ledger = allSfs(head, intentText, []).map((s) => s.row);
  const name = basename(root);
  const packet = {
    kind: PACKET_KIND,
    version: 1,
    mode: "branch",
    title: `Branch review — ${name}: ${headRef} vs ${base}`,
    createdAt: (opts.now ?? new Date).toISOString(),
    iteration: 1,
    repo: { name, root, ref: `${headRef}@${headSha.slice(0, 12)}` },
    producer: "branch-review",
    change: { base: { ref: base, sha: baseSha }, head: { ref: headRef, sha: headSha } },
    items,
    files,
    ledger
  };
  if (omitted.length)
    packet.omitted = omitted;
  return { packet, warnings };
}
function parseNameStatus(line) {
  const [code = "", a = "", b] = line.split("\t");
  const status = code[0] === "A" ? "added" : code[0] === "D" ? "deleted" : code[0] === "R" ? "renamed" : "modified";
  return status === "renamed" && b ? { path: b, status, oldPath: a } : { path: a, status };
}
function firstHunkLine(patch) {
  const m = /^@@ -\d+(?:,\d+)? \+(\d+)/m.exec(patch);
  return Math.max(1, Number(m?.[1] ?? 1));
}
function intentLinks(text, path, intent) {
  const dir = posix.dirname(path);
  const out = [];
  for (const m of text.matchAll(LINK)) {
    const target = posix.normalize(posix.join(dir, m[1].split("#")[0]));
    if (target.startsWith("intent/") && intent.has(target) && !out.some((p) => p.path === target)) {
      out.push({ path: target });
    }
  }
  return out;
}
function parseSpecFeedback(text, path, entry, intent) {
  const lines = text.split(`
`);
  const warnings = [];
  const heads = [];
  lines.forEach((l, i) => {
    const m = SF_HEADING.exec(l);
    if (m)
      heads.push({
        i,
        id: normalizeIf(m[1]),
        title: (m[2] ?? "").trim() || m[1]
      });
  });
  const firstHead = heads[0]?.i ?? lines.length;
  const preamble = lines.slice(1, firstHead).join(`
`).trim();
  const sfs = heads.map((h, n) => {
    let end = heads[n + 1]?.i ?? lines.length;
    for (let k = h.i + 1;k < end; k++) {
      if (/^#{1,2}\s/.test(lines[k])) {
        end = k;
        break;
      }
    }
    const block = lines.slice(h.i + 1, end);
    const bullets = parseBullets(block);
    const status = bullets.find((b) => b.key === "status");
    const statusLine = status?.text.replace(/\s+/g, " ").trim();
    const sfStatus = classifyStatus(statusLine);
    const slice = bullets.find((b) => b.key === "slice");
    const evidence = slice ? slicePassages(slice.text, path, intent) : [];
    const id = `${entry}/${h.id}`;
    const source = { path, line: h.i + 1 };
    let sections = bullets.filter((b) => b.key !== "status").map((b) => ({ key: b.key, label: b.label, text: b.text }));
    if (bullets.length === 0) {
      const body = block.join(`
`).trim();
      warnings.push(`${path}:${h.i + 1}: ${h.id} has no "- **Label:**" bullets; kept as one body`);
      sections = body ? [{ key: "body", label: "Body", text: body }] : [];
    }
    if (preamble)
      sections.push({ key: "entry-context", label: "Entry context", text: preamble });
    const row = {
      id,
      entry,
      title: h.title,
      status: sfStatus,
      slices: [...new Set(evidence.map((p) => p.path))],
      source
    };
    if (statusLine)
      row.statusLine = statusLine;
    const item = {
      id,
      kind: "if",
      title: h.title,
      status: sfStatus,
      source,
      evidence,
      sections
    };
    if (statusLine)
      item.statusLine = statusLine;
    return { row, item, body: block.join(`
`).trim() };
  });
  return { sfs, warnings };
}
function parseBullets(block) {
  const out = [];
  let cur = null;
  const flush = () => {
    if (cur)
      out.push({ key: keyOf(cur.label), label: cur.label, text: cur.lines.join(`
`).trim() });
    cur = null;
  };
  for (const line of block) {
    const m = BULLET.exec(line);
    if (m) {
      flush();
      cur = { label: m[1].trim(), lines: [m[2]] };
    } else if (cur && line.trim() !== "" && !line.startsWith("- ")) {
      cur.lines.push(line.replace(/^ {2}/, ""));
    } else {
      flush();
    }
  }
  flush();
  return out;
}
function keyOf(label) {
  const l = label.toLowerCase();
  if (l.startsWith("assumption"))
    return "assumption";
  if (l.startsWith("proposed revision") || l === "revision")
    return "revision";
  return l.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function classifyStatus(line) {
  if (!line)
    return "pending";
  const s = line.replace(/`/g, "").trim().toLowerCase();
  if (s.startsWith("adjudicated"))
    return "adjudicated";
  if (s.startsWith("declined"))
    return "declined";
  if (/^pending\s*[—–-]+\s*ruled/.test(s))
    return "ruled";
  return "pending";
}
function slicePassages(text, sfPath, intent) {
  const dir = posix.dirname(sfPath);
  const out = [];
  const section = /_([^_]+)_/.exec(text.replace(/\[[^\]]*\]\([^)]*\)/g, ""))?.[1];
  const quotes = [...text.matchAll(/\("([^"]+)"/g)].map((m) => m[1]);
  for (const m of text.matchAll(LINK)) {
    const target = m[1].split("#")[0];
    const path = posix.normalize(posix.join(dir, target));
    if (!path.startsWith("intent/") || !intent.has(path))
      continue;
    if (out.some((p2) => p2.path === path))
      continue;
    const p = { path };
    if (out.length === 0) {
      if (section)
        p.section = section;
      const q = findQuote(intent.get(path), quotes);
      if (q)
        p.quote = q;
    }
    out.push(p);
  }
  return out;
}
function findQuote(file, quotes) {
  let best;
  for (const q of quotes) {
    for (const frag of [q, ...q.split("…")]) {
      const words = frag.trim().split(/\s+/).map((w) => w.replace(/[*_`]/g, "")).filter(Boolean);
      if (words.length < 3)
        continue;
      const esc = words.map((w) => `[*_\`]*${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[*_\`]*`);
      const m = new RegExp(esc.join("\\s+"), "i").exec(file);
      if (m && (!best || m[0].length > best.length))
        best = m[0];
    }
  }
  return best;
}
function parseOpenQuestions(text, path) {
  const lines = text.split(`
`);
  const items = [];
  let inSection = false;
  let pastIndex = false;
  let cur = null;
  const flush = () => {
    if (!cur)
      return;
    const raw = cur.raw.join(`
`);
    const title = /^- \*\*(.+?)\*\*/.exec(raw)?.[1]?.replace(/[.:]$/, "").trim();
    if (title && !raw.includes("<")) {
      const body = raw.replace(/^- /, "").split(`
`).map((l) => l.replace(/^ {2}/, "")).join(`
`);
      items.push({
        id: `OQ/${slug(title)}`,
        kind: "question",
        title,
        status: "pending",
        source: { path, line: cur.line },
        evidence: [{ path, quote: raw.replace(/^- /, "") }],
        sections: [{ key: "question", label: "Question", text: body }]
      });
    }
    cur = null;
  };
  lines.forEach((line, i) => {
    if (/^##\s/.test(line)) {
      flush();
      if (/^##\s+index/i.test(line))
        pastIndex = true;
      inSection = !pastIndex;
      return;
    }
    if (!inSection)
      return;
    if (line.startsWith("- ")) {
      flush();
      cur = { line: i + 1, raw: [line] };
    } else if (cur && line.startsWith("  ") && line.trim() !== "") {
      cur.raw.push(line);
    } else {
      flush();
    }
  });
  flush();
  const seen = new Map;
  for (const it of items) {
    const n = (seen.get(it.id) ?? 0) + 1;
    seen.set(it.id, n);
    if (n > 1)
      it.id = `${it.id}-${n}`;
  }
  return items;
}
function slug(s) {
  return s.toLowerCase().replace(/[`*_]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
function fsTree(root) {
  let tracked = null;
  try {
    tracked = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\x00").filter(Boolean).filter((p) => existsSync(join(root, p))).sort();
  } catch {
    tracked = null;
  }
  return {
    list(prefix) {
      if (tracked)
        return [...new Set(tracked)].filter((p) => p.startsWith(prefix));
      const out = [];
      const walk = (dir) => {
        if (!existsSync(dir))
          return;
        for (const name of readdirSync(dir).sort()) {
          if (name === ".git" || name === "node_modules")
            continue;
          const abs = join(dir, name);
          if (statSync(abs).isDirectory())
            walk(abs);
          else
            out.push(relative(root, abs).split(sep).join("/"));
        }
      };
      walk(join(root, prefix));
      return out.sort();
    },
    read(path) {
      try {
        return readFileSync(join(root, path), "utf8");
      } catch {
        return;
      }
    }
  };
}
function gitTree(root, sha) {
  return {
    list(prefix) {
      const spec = prefix === "" ? [] : ["--", prefix];
      return git(root, ["ls-tree", "-r", "--name-only", sha, ...spec]).split(`
`).filter(Boolean).sort();
    },
    read(path) {
      try {
        return git(root, ["show", `${sha}:${path}`]);
      } catch {
        return;
      }
    }
  };
}
function readIntent(tree) {
  return tree.list("intent/").filter((p) => p.endsWith(".md")).map((path) => ({ path, text: tree.read(path) ?? "" }));
}
function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}
function resolveRef(root, ref) {
  try {
    return git(root, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`cannot resolve git ref "${ref}" in ${root}`);
  }
}
function gitRef(root, ref) {
  try {
    const name = ref === "HEAD" ? git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim() : ref;
    return `${name}@${git(root, ["rev-parse", "--short=12", ref]).trim()}`;
  } catch {
    return;
  }
}

// src/server.ts
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync as readFileSync2, renameSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename as basename2, dirname, join as join2 } from "node:path";
var MAX_BODY = 16 * 1024 * 1024;
function draftPathFor(out) {
  return out.endsWith(".json") ? `${out.slice(0, -5)}.draft.json` : `${out}.draft.json`;
}
function writeFileAtomic(path, data) {
  const tmp = join2(dirname(path), `.${basename2(path)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, data, { encoding: "utf8", flag: "wx" });
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
async function serve(opts) {
  const token = opts.token ?? randomBytes(16).toString("hex");
  const now = opts.now ?? (() => new Date);
  const ref = packetRef(opts.packet, opts.digest);
  let finished = false;
  let resolveDone = () => {};
  const done2 = new Promise((r) => {
    resolveDone = r;
  });
  let port = 0;
  const finish = (outcome) => {
    finished = true;
    setImmediate(() => {
      server.close();
      server.closeAllConnections();
      resolveDone(outcome);
    });
  };
  const handle = async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const host = req.headers.host ?? "";
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      return send(res, 403, { error: "forbidden host" });
    }
    if (url.pathname === "/") {
      if (req.method !== "GET")
        return send(res, 405, { error: "method not allowed" });
      if (url.searchParams.get("token") !== token) {
        return sendText(res, 403, "Open the URL the review tool printed (it carries the token).");
      }
      return sendHtml(res, opts.html);
    }
    if (!url.pathname.startsWith("/api/"))
      return send(res, 404, { error: "not found" });
    if (req.headers["x-review-token"] !== token)
      return send(res, 403, { error: "bad token" });
    if (finished)
      return send(res, 409, { error: "this review has already ended" });
    const route = `${req.method} ${url.pathname}`;
    switch (route) {
      case "GET /api/packet":
        return send(res, 200, { packet: opts.packet, digest: opts.digest, draftPath: opts.draft });
      case "GET /api/themes":
        return send(res, 200, {
          themes: opts.themes ?? [],
          initial: opts.initialTheme ?? null,
          dir: opts.themeDir ?? null,
          prefs: readPrefs(opts.prefsPath)
        });
      case "PUT /api/prefs": {
        const body = await readJson(req);
        const theme = body.ok ? body.value.theme : undefined;
        if (typeof theme !== "string" || !/^[a-z0-9-]{1,41}$/.test(theme)) {
          return send(res, 400, { errors: [{ path: "theme", message: "a theme id" }] });
        }
        if (opts.prefsPath) {
          try {
            mkdirSync(dirname(opts.prefsPath), { recursive: true });
            writeFileAtomic(opts.prefsPath, `${JSON.stringify({ ...readPrefs(opts.prefsPath), theme }, null, 2)}
`);
          } catch {}
        }
        return send(res, 200, { theme });
      }
      case "GET /api/draft":
        return send(res, 200, readDraft(opts.draft, opts.digest));
      case "PUT /api/draft": {
        const body = await readJson(req);
        if (!body.ok)
          return send(res, 400, { errors: body.errors });
        const draft = {
          ...body.value,
          kind: DRAFT_KIND,
          version: SCHEMA_VERSION,
          packet: ref
        };
        const v = validateDraft(draft);
        if (!v.ok)
          return send(res, 400, { errors: v.errors });
        writeFileAtomic(opts.draft, `${JSON.stringify(v.value, null, 2)}
`);
        return send(res, 200, { saved: now().toISOString() });
      }
      case "POST /api/submit": {
        const body = await readJson(req);
        if (!body.ok)
          return send(res, 400, { errors: body.errors });
        const v = validateSubmission(body.value, opts.packet);
        if (!v.ok)
          return send(res, 400, { errors: v.errors });
        const decisions = toDecisions(v.value, ref, now().toISOString());
        const check = validateDecisions(decisions, opts.packet);
        if (!check.ok)
          return send(res, 400, { errors: check.errors });
        writeFileAtomic(opts.out, `${JSON.stringify(decisions, null, 2)}
`);
        rmSync(opts.draft, { force: true });
        send(res, 200, { out: opts.out });
        return finish({ kind: "submitted", out: opts.out, decisions });
      }
      case "POST /api/abandon":
        send(res, 200, { draft: opts.draft });
        return finish({ kind: "abandoned" });
      default:
        return send(res, 404, { error: `no route ${route}` });
    }
  };
  const server = createServer((req, res) => {
    handle(req, res).catch((e) => {
      send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 0, "127.0.0.1", () => resolve());
  });
  port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}/?token=${token}`,
    port,
    token,
    done: done2,
    close: () => new Promise((resolve) => {
      if (!server.listening)
        return resolve();
      server.close(() => resolve());
      server.closeAllConnections();
    })
  };
}
function readPrefs(path) {
  if (!path)
    return {};
  try {
    const v = JSON.parse(readFileSync2(path, "utf8"));
    return typeof v.theme === "string" ? { theme: v.theme } : {};
  } catch {
    return {};
  }
}
function readDraft(path, digest) {
  let raw;
  try {
    raw = readFileSync2(path, "utf8");
  } catch {
    return { draft: null, stale: false };
  }
  try {
    const v = validateDraft(JSON.parse(raw));
    if (!v.ok)
      return { draft: null, stale: false, error: `draft at ${path} is invalid; ignored` };
    return { draft: v.value, stale: v.value.packet.digest !== digest };
  } catch {
    return { draft: null, stale: false, error: `draft at ${path} is not JSON; ignored` };
  }
}
function readJson(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size <= MAX_BODY)
        chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY)
        return resolve({ ok: false, errors: [{ path: "$", message: "body too large" }] });
      try {
        resolve({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch {
        resolve({ ok: false, errors: [{ path: "$", message: "body is not JSON" }] });
      }
    });
  });
}
var BASE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
function send(res, status, body) {
  res.writeHead(status, { ...BASE_HEADERS, "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function sendText(res, status, body) {
  res.writeHead(status, { ...BASE_HEADERS, "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}
function sendHtml(res, html) {
  res.writeHead(200, {
    ...BASE_HEADERS,
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'",
    "referrer-policy": "no-referrer"
  });
  res.end(html);
}

// src/themes.ts
var TOKENS = [
  "bg",
  "surface",
  "sunken",
  "raised",
  "ink",
  "ink-2",
  "muted",
  "faint",
  "line",
  "line-2",
  "accent",
  "accent-ink",
  "accent-soft",
  "heading",
  "heading-2",
  "xref",
  "focus",
  "focus-line",
  "accept",
  "amend",
  "decline",
  "defer",
  "revise",
  "hl-comment",
  "hl-question",
  "hl-suggestion",
  "hl-intent-here",
  "hl-mismatch",
  "add-bg",
  "add-strong",
  "del-bg",
  "del-strong",
  "tk-kw",
  "tk-str",
  "tk-com",
  "tk-num",
  "tk-fn",
  "tk-ty",
  "tk-key",
  "shadow"
];
var SHADOW_DARK = "0 1px 2px rgb(0 0 0 / 0.35), 0 12px 32px rgb(0 0 0 / 0.5)";
var SHADOW_LIGHT = "0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px rgb(0 0 0 / 0.1)";
var THEMES = [
  {
    id: "gyokuro-desert",
    name: "Gyokuro Desert",
    dark: true,
    colors: {
      bg: "#232527",
      surface: "#1d1f21",
      sunken: "#17181a",
      raised: "#2a2c2f",
      ink: "#d4d4d4",
      "ink-2": "#bdbdbd",
      muted: "#a2a4a2",
      faint: "#7a7c7a",
      line: "#303336",
      "line-2": "#3c4046",
      accent: "#9acd32",
      "accent-ink": "#1d1f21",
      "accent-soft": "#2c3a1a",
      heading: "#9bf99c",
      "heading-2": "#e5db74",
      xref: "#87ceeb",
      focus: "#4a3d14",
      "focus-line": "#e5db74",
      accept: "#9bf99c",
      amend: "#87ceeb",
      decline: "#ff7b7a",
      defer: "#e5db74",
      revise: "#d4a6ff",
      "hl-comment": "#4d4614",
      "hl-question": "#173a4f",
      "hl-suggestion": "#1f4524",
      "hl-intent-here": "#3e2a57",
      "hl-mismatch": "#55201f",
      "add-bg": "#1c3320",
      "add-strong": "#2f6136",
      "del-bg": "#3a1c1c",
      "del-strong": "#723030",
      "tk-kw": "#e5db74",
      "tk-str": "#90ee90",
      "tk-com": "#7ccd7d",
      "tk-num": "#9acd32",
      "tk-fn": "#87ceeb",
      "tk-ty": "#feddaa",
      "tk-key": "#87ceeb",
      shadow: SHADOW_DARK
    }
  },
  {
    id: "gyokuro-desert-og",
    name: "Gyokuro Desert OG",
    dark: true,
    colors: {
      bg: "#232527",
      surface: "#1d1f21",
      sunken: "#17181a",
      raised: "#2a2c2f",
      ink: "#d4d4d4",
      "ink-2": "#bdbdbd",
      muted: "#a2a4a2",
      faint: "#7a7c7a",
      line: "#303336",
      "line-2": "#3c4046",
      accent: "#ffa54f",
      "accent-ink": "#1d1f21",
      "accent-soft": "#3d2b17",
      heading: "#ffa54f",
      "heading-2": "#fa8072",
      xref: "#87ceeb",
      focus: "#4a3216",
      "focus-line": "#ffa54f",
      accept: "#9bf99c",
      amend: "#87ceeb",
      decline: "#ff7b7a",
      defer: "#ffd27a",
      revise: "#d4a6ff",
      "hl-comment": "#4d4614",
      "hl-question": "#173a4f",
      "hl-suggestion": "#1f4524",
      "hl-intent-here": "#3e2a57",
      "hl-mismatch": "#55201f",
      "add-bg": "#1c3320",
      "add-strong": "#2f6136",
      "del-bg": "#3a1c1c",
      "del-strong": "#723030",
      "tk-kw": "#e5db74",
      "tk-str": "#fa8072",
      "tk-com": "#7ccd7d",
      "tk-num": "#ffa54f",
      "tk-fn": "#87ceeb",
      "tk-ty": "#feddaa",
      "tk-key": "#87ceeb",
      shadow: SHADOW_DARK
    }
  },
  {
    id: "gyokuro-dark",
    name: "Gyokuro Dark",
    dark: true,
    colors: {
      bg: "#0f1d16",
      surface: "#1a2920",
      sunken: "#13221a",
      raised: "#213428",
      ink: "#d3ddd7",
      "ink-2": "#b3c4b8",
      muted: "#93ab9a",
      faint: "#6f8a76",
      line: "#26392c",
      "line-2": "#33493a",
      accent: "#5fe08a",
      "accent-ink": "#0f1d16",
      "accent-soft": "#22432e",
      heading: "#b8f28f",
      "heading-2": "#9fd3a7",
      xref: "#ffb86b",
      focus: "#4a3d14",
      "focus-line": "#ffd700",
      accept: "#5fe08a",
      amend: "#5ce1ff",
      decline: "#ff6b8b",
      defer: "#ffd75e",
      revise: "#d29bff",
      "hl-comment": "#4a4416",
      "hl-question": "#173d4d",
      "hl-suggestion": "#1f4a2a",
      "hl-intent-here": "#3d2a55",
      "hl-mismatch": "#55212a",
      "add-bg": "#1d3a26",
      "add-strong": "#2f6a40",
      "del-bg": "#3a1d22",
      "del-strong": "#71303b",
      "tk-kw": "#8fbc8f",
      "tk-str": "#a8d1a3",
      "tk-com": "#7d9a82",
      "tk-num": "#b8d4a3",
      "tk-fn": "#7db87f",
      "tk-ty": "#9fd3a7",
      "tk-key": "#9fd3a7",
      shadow: SHADOW_DARK
    }
  },
  {
    id: "gyokuro-light",
    name: "Gyokuro Light",
    dark: false,
    colors: {
      bg: "#e8f2e8",
      surface: "#f7f9f7",
      sunken: "#edf4ed",
      raised: "#ffffff",
      ink: "#24352a",
      "ink-2": "#3d5940",
      muted: "#52695a",
      faint: "#8aa08e",
      line: "#d7e5d7",
      "line-2": "#c3d6c3",
      accent: "#1a6b1a",
      "accent-ink": "#ffffff",
      "accent-soft": "#dcecdc",
      heading: "#0d5016",
      "heading-2": "#2d5a30",
      xref: "#a14400",
      focus: "#ffe9a8",
      "focus-line": "#d99a00",
      accept: "#176c28",
      amend: "#0b6e99",
      decline: "#c0263d",
      defer: "#8f5c00",
      revise: "#7a2fc4",
      "hl-comment": "#fff0a0",
      "hl-question": "#d4eaff",
      "hl-suggestion": "#d3f2cf",
      "hl-intent-here": "#eadcff",
      "hl-mismatch": "#ffd9dc",
      "add-bg": "#e0f3df",
      "add-strong": "#b4e2b0",
      "del-bg": "#fde8ea",
      "del-strong": "#f5bcc3",
      "tk-kw": "#1a6b1a",
      "tk-str": "#0d5016",
      "tk-com": "#4d6852",
      "tk-num": "#1a6b1a",
      "tk-fn": "#2d5a30",
      "tk-ty": "#0d5016",
      "tk-key": "#0d5016",
      shadow: SHADOW_LIGHT
    }
  },
  {
    id: "neutral-light",
    name: "Neutral Light",
    dark: false,
    colors: {
      bg: "#f6f6f3",
      surface: "#ffffff",
      sunken: "#efefeb",
      raised: "#ffffff",
      ink: "#1c1e22",
      "ink-2": "#3d4149",
      muted: "#62676f",
      faint: "#a4a8ae",
      line: "#e4e3de",
      "line-2": "#d6d5cf",
      accent: "#3657c8",
      "accent-ink": "#ffffff",
      "accent-soft": "#e9eefc",
      heading: "#1c1e22",
      "heading-2": "#3d4149",
      xref: "#3657c8",
      focus: "#fde9c6",
      "focus-line": "#f0b45a",
      accept: "#1a7046",
      amend: "#3657c8",
      decline: "#b4362c",
      defer: "#8f5c00",
      revise: "#7442c8",
      "hl-comment": "#fff0a6",
      "hl-question": "#d7e9ff",
      "hl-suggestion": "#d9f3df",
      "hl-intent-here": "#ece0ff",
      "hl-mismatch": "#ffdcd8",
      "add-bg": "#e7f6ea",
      "add-strong": "#b5e6c0",
      "del-bg": "#fdecea",
      "del-strong": "#f6c2bc",
      "tk-kw": "#8a3fbf",
      "tk-str": "#1f6e32",
      "tk-com": "#5b6068",
      "tk-num": "#a65400",
      "tk-fn": "#2f5fc4",
      "tk-ty": "#096a75",
      "tk-key": "#2f5fc4",
      shadow: SHADOW_LIGHT
    }
  },
  {
    id: "neutral-dark",
    name: "Neutral Dark",
    dark: true,
    colors: {
      bg: "#111215",
      surface: "#17191d",
      sunken: "#0d0e10",
      raised: "#1d2025",
      ink: "#e6e7ea",
      "ink-2": "#c5c8ce",
      muted: "#959aa3",
      faint: "#5b6068",
      line: "#262a30",
      "line-2": "#323740",
      accent: "#7d9cff",
      "accent-ink": "#0b1020",
      "accent-soft": "#1d2640",
      heading: "#e6e7ea",
      "heading-2": "#c5c8ce",
      xref: "#7d9cff",
      focus: "#4a3516",
      "focus-line": "#c98b2e",
      accept: "#4cc38a",
      amend: "#7d9cff",
      decline: "#ff7b72",
      defer: "#e3b341",
      revise: "#b392f0",
      "hl-comment": "#4b4415",
      "hl-question": "#193553",
      "hl-suggestion": "#173d27",
      "hl-intent-here": "#35254f",
      "hl-mismatch": "#4f1f1c",
      "add-bg": "#10291b",
      "add-strong": "#1d5a35",
      "del-bg": "#2f1517",
      "del-strong": "#6b2a2a",
      "tk-kw": "#c792ea",
      "tk-str": "#8fd18f",
      "tk-com": "#7d838d",
      "tk-num": "#f2a65a",
      "tk-fn": "#82aaff",
      "tk-ty": "#5fd4d0",
      "tk-key": "#82aaff",
      shadow: SHADOW_DARK
    }
  }
];
function resolveTheme(c, builtins = THEMES) {
  const base = builtins.find((b) => b.id === c.base);
  if (!base)
    return null;
  return { id: c.id, name: c.name, dark: base.dark, colors: { ...base.colors, ...c.colors } };
}
var VALUE = /^[#a-zA-Z0-9(),.%\s/+-]{1,120}$/;
function validateTheme(v) {
  const errors = [];
  if (typeof v !== "object" || v === null || Array.isArray(v))
    return { ok: false, errors: ["must be a JSON object"] };
  const o = v;
  if (typeof o.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(o.id)) {
    errors.push("id: lower-case letters, digits and dashes");
  } else if (THEMES.some((t) => t.id === o.id))
    errors.push(`id: "${o.id}" is a built-in theme`);
  if (typeof o.name !== "string" || !o.name.trim())
    errors.push("name: required");
  if (typeof o.base !== "string" || !THEMES.some((t) => t.id === o.base)) {
    errors.push(`base: one of ${THEMES.map((t) => t.id).join(", ")}`);
  }
  const colors = {};
  if (o.colors !== undefined) {
    if (typeof o.colors !== "object" || o.colors === null)
      errors.push("colors: must be an object");
    else {
      for (const [k, val] of Object.entries(o.colors)) {
        if (!TOKENS.includes(k))
          errors.push(`colors.${k}: not a theme token`);
        else if (typeof val !== "string" || !VALUE.test(val))
          errors.push(`colors.${k}: not a CSS colour value`);
        else
          colors[k] = val;
      }
    }
  }
  if (errors.length)
    return { ok: false, errors };
  return {
    ok: true,
    theme: { id: o.id, name: o.name, base: o.base, colors }
  };
}

// src/cli.ts
var THEME_DOCS = "https://github.com/crumley/intent-architecture/blob/main/.agents/skills/intent-architecture/references/review-themes.md";
var TOOL_VERSION = "1.0.0";
var USAGE = `intent review tool ${TOOL_VERSION} — review a repository's intent and open intent feedback

usage:
  review.mjs scan     --repo <dir> [--out <packet.json>] [--ref <ref>] [--no-questions]
  review.mjs scan     --repo <dir> --base <ref> [--head <ref>] [--out <packet.json>]
  review.mjs validate (--packet <file> | --decisions <file>)
  review.mjs serve    --packet <file> --out <decisions.json> [--port <n>] [--open] [--theme <id|file.json>]
  review.mjs locate   --decisions <file> --repo <dir> [--packet <file>]

exit codes: 0 done · 2 usage error or invalid input · 3 review abandoned · 1 unexpected

themes: built-in ${THEMES.map((t) => t.id).join(", ")}; custom themes are JSON files in
  <config>/themes/ (config: $INTENT_REVIEW_CONFIG, else $XDG_CONFIG_HOME/intent-review, else
  ~/.config/intent-review) or passed with --theme. Format: ${THEME_DOCS}`;

class UsageError extends Error {
}

class InputError extends Error {
  errors;
  constructor(message, errors = []) {
    super(message);
    this.errors = errors;
  }
}
var KNOWN = {
  scan: { values: ["repo", "out", "ref", "base", "head"], switches: ["no-questions"] },
  validate: { values: ["packet", "decisions"], switches: [] },
  serve: { values: ["packet", "out", "port", "theme"], switches: ["open"] },
  locate: { values: ["decisions", "repo", "packet"], switches: [] }
};
function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    return { command: "help", flags: {} };
  }
  if (command === "--version" || command === "-v")
    return { command: "version", flags: {} };
  const spec = KNOWN[command];
  if (!spec)
    throw new UsageError(`unknown command "${command}"`);
  const flags = {};
  for (let i = 0;i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--"))
      throw new UsageError(`unexpected argument "${arg}"`);
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (spec.switches.includes(name)) {
      flags[name] = true;
    } else if (spec.values.includes(name)) {
      const value = eq === -1 ? rest[++i] : arg.slice(eq + 1);
      if (value === undefined || value === "")
        throw new UsageError(`--${name} needs a value`);
      flags[name] = value;
    } else {
      throw new UsageError(`unknown option --${name} for ${command}`);
    }
  }
  return { command, flags };
}
function need(flags, name) {
  const v = flags[name];
  if (typeof v !== "string")
    throw new UsageError(`--${name} is required`);
  return v;
}
function digestOf(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
function readJsonFile(path) {
  let bytes;
  try {
    bytes = readFileSync3(path);
  } catch {
    throw new InputError(`cannot read ${path}`);
  }
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    throw new InputError(`${path} is not JSON`);
  }
}
function loadPacket(path) {
  const { bytes, value } = readJsonFile(path);
  const v = validatePacket(value);
  if (!v.ok)
    throw new InputError(`${path} is not a valid packet`, v.errors);
  return { packet: v.value, digest: digestOf(bytes) };
}
async function run(argv, io) {
  try {
    const { command, flags } = parseArgs(argv);
    switch (command) {
      case "help":
        io.out(USAGE);
        return 0;
      case "version":
        io.out(TOOL_VERSION);
        return 0;
      case "scan":
        return cmdScan(flags, io);
      case "validate":
        return cmdValidate(flags, io);
      case "serve":
        return await cmdServe(flags, io);
      case "locate":
        return cmdLocate(flags, io);
      default:
        throw new UsageError(`unknown command "${command}"`);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`review: ${e.message}

${USAGE}`);
      return 2;
    }
    if (e instanceof InputError) {
      io.err(`review: ${e.message}${e.errors.length ? `
${formatErrors(e.errors)}` : ""}`);
      return 2;
    }
    io.err(`review: unexpected error: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    return 1;
  }
}
function cmdScan(flags, io) {
  const root = resolve(need(flags, "repo"));
  if (!existsSync2(join3(root, "intent")))
    throw new InputError(`${root} has no intent/ directory`);
  const str = (k) => typeof flags[k] === "string" ? flags[k] : undefined;
  const base = str("base");
  const ref = str("ref");
  const head = str("head");
  if (base === undefined && head !== undefined)
    throw new UsageError("--head needs --base");
  if (base !== undefined && ref !== undefined)
    throw new UsageError("--ref is for main mode; use --head");
  const opts = { questions: flags["no-questions"] !== true };
  if (base !== undefined)
    opts.base = base;
  if (head !== undefined)
    opts.head = head;
  if (ref !== undefined)
    opts.ref = ref;
  let result;
  try {
    result = scanRepo(root, opts);
  } catch (e) {
    throw new InputError(e instanceof Error ? e.message : String(e));
  }
  const { packet, warnings } = result;
  for (const w of warnings)
    io.err(`review: warning: ${w}`);
  const json = `${JSON.stringify(packet, null, 2)}
`;
  const out = flags.out;
  if (typeof out === "string") {
    writeFileSync2(out, json);
    const count = new Map;
    for (const i of packet.items)
      count.set(i.kind, (count.get(i.kind) ?? 0) + 1);
    const kinds = [...count.entries()].map(([k, n]) => `${n} ${k}`).join(", ") || "no items";
    io.out(`review: wrote ${out} — ${packet.mode} mode: ${kinds}; ` + `${packet.ledger?.length ?? 0} IFs in the ledger, ${packet.files.length} files`);
  } else {
    io.out(json.trimEnd());
  }
  return 0;
}
function cmdValidate(flags, io) {
  const p = flags.packet;
  const d = flags.decisions;
  if (typeof p === "string" === (typeof d === "string")) {
    throw new UsageError("give exactly one of --packet or --decisions");
  }
  if (typeof p === "string") {
    const { packet } = loadPacket(p);
    io.out(`review: ${p} is a valid packet (${packet.items.length} items, ${packet.files.length} files)`);
    return 0;
  }
  const { value } = readJsonFile(d);
  const v = validateDecisions(value);
  if (!v.ok)
    throw new InputError(`${d} is not a valid decisions file`, v.errors);
  io.out(`review: ${d} is a valid decisions file (${v.value.verdicts.length} verdicts, ${v.value.annotations.length} annotations)`);
  return 0;
}
async function cmdServe(flags, io) {
  const { packet, digest } = loadPacket(need(flags, "packet"));
  const out = resolve(need(flags, "out"));
  let port;
  if (typeof flags.port === "string") {
    port = Number(flags.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw new UsageError("--port must be 0–65535");
  }
  mkdirSync2(dirname2(out), { recursive: true });
  const draft = draftPathFor(out);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Intent review</title>
<style>/* The review page. Quiet surfaces, a readable measure, one accent; colour is
   reserved for meaning (verdicts, note kinds, diffs). Light and dark share
   every rule through the tokens below. */

:root {
  /* Colours come from the active theme (src/themes.ts, injected as CSS); these
     are the type and shape tokens every theme shares. */
  --sans:
    "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
    sans-serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace;
  --radius: 8px;
}

/* ---------------------------------------------------------------- base */

* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--ink);
  font: 15px / 1.6 var(--sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
#app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
h1,
h2,
h3 {
  margin: 0;
  font-weight: 650;
  letter-spacing: -0.01em;
}
h2,
.h2 {
  font-size: 12px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
}
h3 {
  font-size: 13px;
  margin: 20px 0 8px;
  color: var(--ink-2);
}
p {
  margin: 0 0 0.8em;
}
.mono {
  font-family: var(--mono);
  font-size: 0.88em;
}
.small {
  font-size: 12.5px;
}
.muted {
  color: var(--muted);
}
.pad {
  padding: 16px;
}
.grow {
  flex: 1;
}
.nowrap {
  white-space: nowrap;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.warn {
  color: var(--defer);
}
.lead {
  font-size: 15.5px;
  color: var(--ink-2);
  max-width: 70ch;
}
kbd {
  display: inline-block;
  font: 500 10.5px / 1 var(--mono);
  padding: 3px 5px;
  margin-left: 6px;
  min-width: 18px;
  text-align: center;
  border: 1px solid var(--line-2);
  border-bottom-width: 2px;
  border-radius: 5px;
  color: var(--muted);
  background: var(--surface);
  vertical-align: 1px;
}

/* ---------------------------------------------------------------- controls */

.btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 7px 14px;
  border-radius: 7px;
  border: 1px solid var(--line-2);
  background: var(--surface);
  font-weight: 550;
  font-size: 14px;
  white-space: nowrap;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.btn:hover {
  border-color: var(--faint);
}
.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.btn.primary kbd {
  background: transparent;
  color: inherit;
  border-color: rgb(255 255 255 / 0.4);
}
.btn.primary:hover {
  filter: brightness(1.06);
}
.btn.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--ink-2);
}
.btn.ghost:hover,
.btn.ghost.on {
  background: var(--sunken);
}
.btn.danger {
  color: var(--decline);
}
.btn.sm {
  padding: 4px 8px;
  font-size: 13px;
}
.btn.big {
  padding: 11px 20px;
  font-size: 15px;
}
.btn.block {
  width: 100%;
  justify-content: center;
}
.icon-btn {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  border-radius: 7px;
  color: var(--muted);
  font-size: 16px;
}
.icon-btn:hover {
  background: var(--sunken);
  color: var(--ink);
}
.icon-btn.sm {
  width: 24px;
  height: 24px;
  font-size: 14px;
}
.field {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--line-2);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  line-height: 1.5;
  resize: vertical;
}
.field.mono {
  font: 13px / 1.55 var(--mono);
}
.field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.lbl {
  display: block;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--muted);
  margin: 14px 0 6px;
}
.seg {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 550;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--sunken);
  color: var(--muted);
  white-space: nowrap;
}
.tag.strong {
  background: var(--accent-soft);
  color: var(--accent);
}
.tag.st-ruled,
.tag.ruled {
  background: color-mix(in srgb, var(--defer) 14%, transparent);
  color: var(--defer);
}
.tag.st-adjudicated {
  color: var(--accept);
}
.tag.at-judgment {
  background: color-mix(in srgb, var(--decline) 12%, transparent);
  color: var(--decline);
}
.tag.ch-added {
  color: var(--accept);
  background: color-mix(in srgb, var(--accept) 12%, transparent);
}
.tag.ch-deleted {
  color: var(--decline);
  background: color-mix(in srgb, var(--decline) 12%, transparent);
}
.tag.ch-modified,
.tag.ch-renamed {
  color: var(--amend);
  background: color-mix(in srgb, var(--amend) 12%, transparent);
}

.vchip {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--line-2);
  color: var(--muted);
  white-space: nowrap;
  text-transform: lowercase;
}
.vchip.big {
  font-size: 13px;
  padding: 3px 12px;
  text-transform: none;
}
.v-accept,
.o-approve {
  --vc: var(--accept);
}
.v-amend {
  --vc: var(--amend);
}
.v-decline,
.o-request-changes {
  --vc: var(--decline);
}
.v-defer {
  --vc: var(--defer);
}
.v-revise {
  --vc: var(--revise);
}
.o-comment {
  --vc: var(--muted);
}
.vchip[class*="v-"],
.vchip[class*="o-"] {
  color: var(--vc);
  border-color: color-mix(in srgb, var(--vc) 45%, transparent);
  background: color-mix(in srgb, var(--vc) 9%, transparent);
}

.pill {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.k-comment {
  --kc: var(--hl-comment);
}
.k-question {
  --kc: var(--hl-question);
}
.k-suggestion {
  --kc: var(--hl-suggestion);
}
.k-intent-here {
  --kc: var(--hl-intent-here);
}
.k-mismatch {
  --kc: var(--hl-mismatch);
}
.pill[class*="k-"] {
  background: var(--kc);
  color: var(--ink);
}
.seg .pill {
  background: transparent;
  border-color: var(--line-2);
  color: var(--ink-2);
  padding: 5px 12px;
  font-size: 13px;
}
.seg .pill.on {
  background: var(--kc);
  border-color: transparent;
  color: var(--ink);
}

.badge {
  font-size: 11px;
  font-weight: 650;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--hl-comment);
  color: var(--ink);
  text-align: center;
  line-height: 18px;
}

.ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 12.5px var(--mono);
  color: var(--accent);
  padding: 1px 2px;
  border-radius: 4px;
}
.ref:hover {
  background: var(--accent-soft);
}
.ref.quiet {
  color: var(--muted);
}

.ic {
  display: inline-block;
  flex: none;
}
.ic-chev {
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  margin: 0 8px 1px 2px;
  transition: transform 0.15s;
  color: var(--faint);
}
details[open] > summary > .ic-chev,
.tn.dir.open > .ic-chev {
  transform: rotate(45deg);
}
.ic-ext::before {
  content: "↗";
  font-size: 10px;
  opacity: 0.6;
}

/* ---------------------------------------------------------------- header */

.top {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  flex: none;
}
.brand {
  min-width: 0;
  flex: 1;
}
.brand .title {
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand .sub {
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mode {
  font-size: 11px;
  font-weight: 650;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--sunken);
}
.mode.m-branch {
  background: color-mix(in srgb, var(--revise) 14%, transparent);
  color: var(--revise);
}
.tabs {
  display: flex;
  gap: 2px;
  background: var(--sunken);
  padding: 3px;
  border-radius: 9px;
}
.tab {
  padding: 5px 12px;
  border-radius: 7px;
  color: var(--muted);
  font-size: 13.5px;
  font-weight: 550;
  white-space: nowrap;
}
.tab.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}
.status {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
}
.meter {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.meter .track {
  width: 64px;
  height: 5px;
  background: var(--sunken);
  border-radius: 999px;
  overflow: hidden;
}
.meter .bar {
  height: 100%;
  background: var(--accept);
  border-radius: 999px;
  transition: width 0.25s;
}
.save {
  color: var(--muted);
  min-width: 110px;
  text-align: right;
}
.save.saved {
  color: var(--accept);
}
.save.error {
  color: var(--decline);
  font-weight: 650;
}
.count {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 650;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  line-height: 18px;
}
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 20px;
  background: var(--accent-soft);
  color: var(--ink-2);
  font-size: 13.5px;
}

/* ---------------------------------------------------------------- layout */

.main {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}
.layout {
  flex: 1;
  display: grid;
  min-height: 0;
  min-width: 0;
}
.layout.queue {
  grid-template-columns: 300px minmax(0, 1fr) minmax(340px, 40%);
}
.layout.files {
  grid-template-columns: 280px minmax(0, 1fr) 320px;
}
.nav {
  overflow: auto;
  background: var(--sunken);
  border-right: 1px solid var(--line);
  padding: 12px 10px 40px;
}
.center {
  overflow: auto;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.doc {
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  padding: 28px 40px 32px;
  flex: 1;
}
.side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-left: 1px solid var(--line);
  background: var(--bg);
}
.page {
  flex: 1;
  overflow: auto;
  background: var(--surface);
}
.page-inner {
  max-width: 1040px;
  margin: 0 auto;
  padding: 36px 40px 80px;
}
.page-inner.narrow {
  max-width: 820px;
}
.page h1 {
  font-size: 26px;
  margin-bottom: 8px;
}
.page h2 {
  margin: 32px 0 12px;
}

/* ---------------------------------------------------------------- queue nav */

.overview {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin: 0 2px 14px;
  font-size: 13.5px;
}
.overview summary {
  cursor: pointer;
  list-style: none;
}
.overview .prose {
  font-size: 13.5px;
  margin-top: 6px;
}
.eyebrow {
  font-size: 11.5px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
}
.nav-group {
  font-size: 11.5px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--ink-2);
  margin: 16px 10px 6px;
}
.qi {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  gap: 10px;
  width: 100%;
  padding: 10px 10px;
  border-radius: 8px;
  align-items: start;
  margin-bottom: 2px;
}
.qi:hover {
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}
.qi.on {
  background: var(--surface);
  box-shadow:
    0 0 0 1px var(--line),
    0 1px 3px rgb(0 0 0 / 0.05);
}
.qi .dot {
  width: 9px;
  height: 9px;
  margin-top: 6px;
  border-radius: 50%;
  border: 1.5px solid var(--faint);
}
.qi .dot[class*="v-"]:not(.v-none) {
  background: var(--vc);
  border-color: var(--vc);
}
.qbody {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.qmeta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11.5px;
  color: var(--muted);
}
.qt {
  font-size: 13.5px;
  line-height: 1.4;
  color: var(--ink);
}
.qi.done .qt {
  color: var(--muted);
}
.qside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

/* ---------------------------------------------------------------- item */

.eyebrow-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.item-title {
  color: var(--heading);
  font-size: 25px;
  line-height: 1.25;
  margin-bottom: 18px;
  max-width: 34ch;
  text-wrap: balance;
}
.callout {
  font-size: 13.5px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: var(--sunken);
  margin-bottom: 12px;
  color: var(--ink-2);
}
.callout.warn {
  background: color-mix(in srgb, var(--defer) 10%, transparent);
}
.callout.info {
  background: var(--accent-soft);
}
.rec-card {
  --vc: var(--accent);
  border: 1px solid var(--line);
  border-left: 4px solid var(--vc);
  border-radius: var(--radius);
  padding: 14px 18px;
  margin: 6px 0 26px;
  background: color-mix(in srgb, var(--vc) 5%, var(--surface));
}
.rec-card.r-accept {
  --vc: var(--accept);
}
.rec-card.r-amend {
  --vc: var(--amend);
}
.rec-card.r-decline {
  --vc: var(--decline);
}
.rec-card.r-defer {
  --vc: var(--defer);
}
.rec-card.r-revise {
  --vc: var(--revise);
}
.rec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.rec-why {
  font-weight: 550;
  max-width: 70ch;
}
.sec {
  margin: 0 0 22px;
}
section.sec > h2 {
  margin-bottom: 10px;
}
details.fold > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  list-style: none;
  padding: 4px 0;
  margin-bottom: 6px;
  user-select: none;
}
details.fold > summary::-webkit-details-marker {
  display: none;
}
details.fold > summary:hover .h2 {
  color: var(--ink-2);
}
details.fold > .prose,
details.fold > .patch,
details.fold > table {
  margin-left: 22px;
}
.evidence {
  margin-bottom: 14px;
}
.ev-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.excerpt {
  border-left: 3px solid var(--focus-line);
  background: var(--sunken);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 10px 16px;
}
.excerpt .prose {
  font-size: 14.5px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.card {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 12px 16px;
  background: var(--surface);
}
.card .eyebrow {
  margin-bottom: 6px;
}
.card .prose {
  font-size: 14px;
}
.rel {
  list-style: none;
  padding: 0;
  margin: 0;
}
.rel li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}
.rel li:last-child {
  border-bottom: 0;
}
.hint {
  font-size: 13px;
  color: var(--muted);
  padding: 12px 0;
  border-top: 1px dashed var(--line-2);
  margin-top: 8px;
}
.edit {
  margin-bottom: 14px;
}
.wdiff {
  font-size: 14.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  max-width: 76ch;
}
.w-del {
  background: var(--del-bg);
  color: var(--decline);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--decline) 60%, transparent);
}
.w-ins {
  background: var(--add-bg);
  color: var(--accept);
}

/* the ruling bar */
.ruling {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--line);
  padding: 12px 40px 14px;
}
.ruling > * {
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}
.ruling-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ruling .field {
  margin-top: 4px;
}
.ruling .note-field {
  margin-top: 8px;
}
.ruling .lbl {
  margin-top: 10px;
}
.vbtn {
  padding: 6px 12px;
  border: 1px solid var(--line-2);
  border-radius: 7px;
  background: var(--surface);
  font-size: 13.5px;
  font-weight: 550;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.vbtn:hover {
  border-color: var(--vc);
}
.vbtn.on {
  background: var(--vc);
  border-color: var(--vc);
  color: var(--surface);
}
.vbtn.on kbd {
  background: transparent;
  color: inherit;
  border-color: rgb(255 255 255 / 0.4);
}

/* notes */
.notes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.note {
  border: 1px solid var(--line);
  border-left: 3px solid var(--kc);
  border-radius: var(--radius);
  padding: 10px 14px;
  background: var(--surface);
  font-size: 14px;
}
.note p {
  margin: 6px 0 0;
}
.note-quote {
  margin-top: 6px;
  font-size: 13px;
  color: var(--muted);
  border-left: 2px solid var(--line-2);
  padding-left: 10px;
  white-space: pre-wrap;
}
.note .wdiff {
  margin-top: 8px;
  font-size: 13.5px;
  padding: 8px 12px;
}

/* ---------------------------------------------------------------- prose */

.prose {
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--ink);
  max-width: 70ch;
}
.prose.compact {
  font-size: 15px;
  line-height: 1.65;
}
.prose .blk {
  margin: 0 0 0.75em;
  position: relative;
}
.prose .blk:last-child {
  margin-bottom: 0;
}
.prose .mk {
  display: none;
}
.prose .b-h1 {
  font-size: 1.6em;
  font-weight: 700;
  line-height: 1.25;
  margin: 0.4em 0 0.6em;
}
.prose .b-h2 {
  font-size: 1.25em;
  font-weight: 650;
  margin: 1.6em 0 0.5em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--line);
}
.prose .b-h3,
.prose .b-h4,
.prose .b-h5,
.prose .b-h6 {
  font-size: 1.05em;
  font-weight: 650;
  margin: 1.3em 0 0.4em;
}
.prose .b-li {
  padding-left: 1.3em;
  margin-left: calc(var(--depth, 0) * 1.3em);
  margin-bottom: 0.45em;
}
.prose .b-li::before {
  content: "";
  position: absolute;
  left: 0.35em;
  top: 0.72em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--faint);
}
.prose .b-li.ol::before {
  display: none;
}
.prose .b-li.ol .mk.ol {
  display: inline;
  position: absolute;
  left: 0;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.prose .b-bq {
  border-left: 3px solid var(--line-2);
  padding-left: 1em;
  color: var(--ink-2);
}
.prose .b-code,
.prose .b-table {
  font: 13px / 1.55 var(--mono);
  white-space: pre;
  overflow-x: auto;
  background: var(--sunken);
  border-radius: 6px;
  padding: 10px 14px;
  max-width: none;
}
.prose .b-code .mk,
.prose .b-table .mk {
  display: inline;
}
.prose .b-hr {
  border-top: 1px solid var(--line);
  height: 0;
  overflow: hidden;
  margin: 1.4em 0;
}
.prose .b {
  font-weight: 650;
}
.prose .i {
  font-style: italic;
}
.prose .code {
  font-family: var(--mono);
  font-size: 0.86em;
  background: var(--sunken);
  border-radius: 4px;
  padding: 0.1em 0.3em;
}
.prose .a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 35%, transparent);
  text-underline-offset: 2px;
}
.file-doc .prose {
  margin: 0 auto;
}
.side .prose {
  font-size: 14.5px;
}

/* ---------------------------------------------------------------- code */

.codeview {
  font: 12.5px / 1.65 var(--mono);
  color: var(--ink);
  padding: 8px 0;
}
.codeview .ln {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 0 16px 0 58px;
  position: relative;
  min-height: 1.65em;
}
.codeview .ln::before {
  content: attr(data-line);
  position: absolute;
  left: 0;
  width: 42px;
  text-align: right;
  color: var(--faint);
  user-select: none;
  font-size: 11px;
}
.codeview.compact {
  padding: 0;
}
.codeview.compact .ln {
  padding-left: 44px;
}
.codeview.compact .ln::before {
  width: 32px;
}
.codeview .mk {
  color: var(--faint);
}
.codeview .ln.h {
  font-weight: 700;
  color: var(--ink);
}
.codeview .b {
  font-weight: 650;
}
.codeview .i {
  font-style: italic;
}
.codeview .a {
  color: var(--accent);
}
.codeview .ln.code-line {
  color: var(--ink-2);
}
.tk-kw {
  color: var(--tk-kw);
}
.tk-str {
  color: var(--tk-str);
}
.tk-com {
  color: var(--tk-com);
  font-style: italic;
}
.tk-num {
  color: var(--tk-num);
}
.tk-fn {
  color: var(--tk-fn);
}
.tk-ty {
  color: var(--tk-ty);
}
.tk-key {
  color: var(--tk-key);
}

/* highlights: notes and the focused passage */
.hl {
  border-radius: 3px;
  cursor: pointer;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.hl-comment {
  background: var(--hl-comment);
}
.hl-question {
  background: var(--hl-question);
}
.hl-suggestion {
  background: var(--hl-suggestion);
}
.hl-intent-here {
  background: var(--hl-intent-here);
}
.hl-mismatch {
  background: var(--hl-mismatch);
}
.focus {
  background: var(--focus);
  box-shadow: 0 1px 0 var(--focus-line);
}
.anno ::selection {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}

/* ---------------------------------------------------------------- patch */

.patch {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  font: 12.5px / 1.6 var(--mono);
  margin-bottom: 12px;
  background: var(--surface);
}
.pl {
  display: grid;
  grid-template-columns: 40px 40px 18px minmax(0, 1fr);
}
.pl .gut {
  color: var(--faint);
  text-align: right;
  padding-right: 8px;
  font-size: 11px;
  user-select: none;
}
.pl .sign {
  color: var(--faint);
  user-select: none;
}
.pl .pc {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding-right: 12px;
}
.pl.add {
  background: var(--add-bg);
}
.pl.add .sign {
  color: var(--accept);
}
.pl.del {
  background: var(--del-bg);
}
.pl.del .sign {
  color: var(--decline);
}
.pl.add .wd {
  background: var(--add-strong);
  border-radius: 2px;
}
.pl.del .wd {
  background: var(--del-strong);
  border-radius: 2px;
}
.pl.hunk {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 2px 0;
}
.pl.meta {
  display: block;
  color: var(--muted);
  padding-left: 98px;
}

/* ---------------------------------------------------------------- side pane */

.side-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 12px 0;
  flex-wrap: wrap;
}
.stab {
  font: 12.5px var(--mono);
  padding: 5px 10px;
  border-radius: 7px 7px 0 0;
  color: var(--muted);
}
.stab:hover {
  color: var(--ink);
}
.stab.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow:
    0 -1px 0 var(--line) inset,
    0 2px 0 var(--accent) inset;
}
.side-path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}
.side-body {
  flex: 1;
  overflow: auto;
  background: var(--surface);
  padding: 18px 24px 60px;
}
.side-body .codeview {
  margin: 0 -24px;
}
.side-notes .side-body {
  padding: 14px 16px;
}

/* ---------------------------------------------------------------- files */

.filter-wrap {
  position: sticky;
  top: -12px;
  background: var(--sunken);
  padding: 0 4px 8px;
  z-index: 1;
}
.filter {
  margin-bottom: 4px;
}
.tree {
  display: flex;
  flex-direction: column;
}
.tn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 3px 8px 3px calc(8px + var(--d, 0) * 14px);
  border-radius: 6px;
  font-size: 13px;
  color: var(--ink-2);
  min-height: 26px;
}
.tn:hover {
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}
.tn.on {
  background: var(--surface);
  color: var(--ink);
  font-weight: 550;
  box-shadow: 0 0 0 1px var(--line);
}
.tn.dir {
  color: var(--ink);
  font-weight: 550;
}
.tn-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tn .ic-chev {
  margin-right: 4px;
}
.lang-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--faint);
  flex: none;
  margin-left: 2px;
  margin-right: 4px;
}
.l-markdown {
  background: #6f86c9;
}
.l-ts {
  background: #3178c6;
}
.l-json,
.l-yaml,
.l-toml {
  background: #b0883b;
}
.l-shell {
  background: #4d9e61;
}
.cite {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex: none;
}
.omitted {
  margin: 14px 8px;
}
.file-center {
  background: var(--surface);
}
.file-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
  font-size: 13.5px;
}
.file-code {
  padding: 8px 0 60px;
}

/* ---------------------------------------------------------------- dashboard + submit */

.cards {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 20px 0 8px;
}
.stat {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 18px;
  min-width: 130px;
  background: var(--surface);
}
.stat .n {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--vc, var(--ink));
}
.stat .l {
  font-size: 12.5px;
  color: var(--muted);
  text-transform: capitalize;
}
.stat.st-pending .n {
  color: var(--accent);
}
.stat.st-ruled .n {
  color: var(--defer);
}
.stat.st-adjudicated .n {
  color: var(--accept);
}
.stat.st-declined .n {
  color: var(--muted);
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
}
td,
th {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
th {
  font-size: 12px;
  font-weight: 650;
  color: var(--muted);
  text-transform: capitalize;
}
.matrix .num,
.matrix th:not(:first-child) {
  text-align: center;
  width: 100px;
  font-variant-numeric: tabular-nums;
}
td.st-pending {
  color: var(--accent);
  font-weight: 650;
}
td.st-ruled {
  color: var(--defer);
  font-weight: 650;
}
td.st-adjudicated {
  color: var(--accept);
}
.rows {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.srow {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 4px 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  align-items: baseline;
}
.srow:last-child {
  border-bottom: 0;
}
.srow:hover {
  background: var(--sunken);
}
.srow.todo .srow-title {
  color: var(--muted);
}
.srow-words {
  grid-column: 2;
  font-size: 13px;
  color: var(--muted);
}
.choices {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.choice {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
  background: var(--surface);
}
.choice.on {
  border-color: var(--vc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vc) 18%, transparent);
}
.submit-row {
  margin: 22px 0 10px;
}
.errors {
  border: 1px solid var(--decline);
  color: var(--decline);
  border-radius: var(--radius);
  padding: 10px 16px;
  margin: 18px 0;
  font-size: 14px;
}
.errors ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
.ended {
  max-width: 560px;
  margin: 18vh auto;
  padding: 0 20px;
  text-align: center;
}
.ended h1 {
  margin: 12px 0;
}
.ended-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: var(--accept);
  background: color-mix(in srgb, var(--accept) 12%, transparent);
}

/* ---------------------------------------------------------------- overlays */

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: 92vw;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--line);
  box-shadow: var(--shadow);
  z-index: 5;
}
.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--line);
}
.drawer-head .title {
  font-weight: 650;
  font-size: 16px;
}
.drawer-head .sub {
  font-size: 12.5px;
  color: var(--muted);
}
.drawer-body {
  flex: 1;
  overflow: auto;
  padding: 4px 14px 20px;
}
.drawer-body h3 {
  margin: 18px 4px 8px;
}
.drawer-foot {
  padding: 12px 16px;
  border-top: 1px solid var(--line);
}
.group {
  margin-bottom: 12px;
}
.group-head {
  font-size: 11.5px;
  color: var(--muted);
  margin: 6px 4px;
}
.entry {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  border-radius: 7px;
}
.entry:hover {
  background: var(--sunken);
}
.entry-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: baseline;
  padding: 7px 8px;
}
.entry-title {
  font-size: 13.5px;
  flex: 1;
  min-width: 0;
}
.entry-quote {
  font-size: 12.5px;
  color: var(--muted);
  font-style: italic;
  flex: 1;
  min-width: 0;
}
.entry-words {
  flex-basis: 100%;
  font-size: 13px;
  color: var(--ink-2);
}
.modal {
  position: fixed;
  inset: 0;
  background: rgb(10 12 16 / 0.42);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 9vh;
  z-index: 20;
}
.modal-box {
  width: min(720px, 94vw);
  max-height: 82vh;
  overflow: auto;
  background: var(--surface);
  border-radius: 12px;
  padding: 20px 22px;
  box-shadow: var(--shadow);
}
.modal-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.quote {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-left: 3px solid var(--focus-line);
  background: var(--sunken);
  border-radius: 0 6px 6px 0;
  white-space: pre-wrap;
  font-size: 13.5px;
  color: var(--ink-2);
  max-height: 180px;
  overflow: auto;
}
.modal-box > .row:last-child {
  margin-top: 16px;
}
.keys td {
  border: 0;
  padding: 5px 8px;
}
.keys kbd {
  margin: 0 3px 0 0;
}
.toolbar {
  position: fixed;
  z-index: 15;
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  background: var(--ink);
  box-shadow: var(--shadow);
}
.toolbar .tb {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px 10px;
  border-radius: 7px;
  color: var(--bg);
  font-size: 13px;
  font-weight: 550;
  white-space: nowrap;
}
.toolbar .tb::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--kc);
  margin-right: 6px;
}
.toolbar .tb:hover {
  background: color-mix(in srgb, var(--bg) 16%, transparent);
}
.toolbar kbd {
  background: transparent;
  color: color-mix(in srgb, var(--bg) 70%, transparent);
  border-color: color-mix(in srgb, var(--bg) 30%, transparent);
}
.peek {
  position: fixed;
  z-index: 12;
  width: 640px;
  max-width: 94vw;
  max-height: 300px;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: var(--shadow);
}
.peek-head {
  position: sticky;
  top: 0;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--muted);
  background: var(--sunken);
  border-bottom: 1px solid var(--line);
}
.peek .codeview {
  padding: 6px 0;
}
.toast {
  position: fixed;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--bg);
  padding: 9px 16px;
  border-radius: 9px;
  z-index: 30;
  font-size: 14px;
  box-shadow: var(--shadow);
}

/* ---------------------------------------------------------------- narrow screens */

@media (max-width: 1180px) {
  .layout.queue {
    grid-template-columns: 260px minmax(0, 1fr);
  }
  .layout.queue .side {
    display: none;
  }
  .layout.files {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  .layout.files .side {
    display: none;
  }
  .tabs .tab kbd,
  .save {
    display: none;
  }
}
@media (max-width: 760px) {
  .layout.queue,
  .layout.files {
    grid-template-columns: 1fr;
  }
  .nav {
    display: none;
  }
  .doc {
    padding: 20px;
  }
  .two,
  .choices {
    grid-template-columns: 1fr;
  }
}

.note > .row {
  flex-wrap: nowrap;
}
.note > .row .ref {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.srow .vchip {
  justify-self: start;
}
.added-doc {
  margin-left: 22px;
  padding: 14px 18px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--accept);
  border-radius: var(--radius);
  max-height: 520px;
  overflow: auto;
}

/* ---------------------------------------------------------------- colour in reading surfaces */

.prose .b-h1,
.prose .b-h2,
.page h1 {
  color: var(--heading);
}
.prose .b-h3,
.prose .b-h4,
.prose .b-h5,
.prose .b-h6 {
  color: var(--heading-2);
}
.prose .code {
  color: var(--tk-ty);
}
.prose .b {
  color: var(--ink);
}
.codeview .ln.h {
  color: var(--heading);
}
.xref {
  color: var(--xref);
  text-decoration: underline dotted;
  text-decoration-color: color-mix(in srgb, var(--xref) 55%, transparent);
  text-underline-offset: 3px;
  cursor: pointer;
  border-radius: 3px;
}
.xref:hover,
.xref:focus-visible {
  background: color-mix(in srgb, var(--xref) 14%, transparent);
  text-decoration-style: solid;
}
.prose .a.xref {
  color: var(--xref);
}

/* ---------------------------------------------------------------- tooltips + peeks */

.tip {
  position: fixed;
  z-index: 40;
  max-width: 360px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--surface);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--shadow);
  pointer-events: none;
}
.card-peek {
  width: 380px;
  padding: 12px 14px;
}
.cp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--xref);
  font-size: 12.5px;
}
.cp-title {
  font-weight: 650;
  color: var(--heading);
  margin: 4px 0;
  line-height: 1.35;
}
.cp-sum {
  font-size: 13.5px;
  color: var(--ink-2);
  line-height: 1.5;
}
.cp-hint {
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--muted);
}

/* ---------------------------------------------------------------- theme picker */

.swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--line-2);
  margin-right: 6px;
  flex: none;
}
.swatch.big {
  width: 22px;
  height: 22px;
  margin: 0;
}
.picker {
  position: fixed;
  top: 54px;
  right: 16px;
  z-index: 30;
  width: 320px;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.picker .eyebrow {
  margin: 6px 6px 2px;
}
.theme-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 8px;
}
.theme-opt:hover {
  background: var(--sunken);
}
.theme-opt.on {
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}
.theme-name {
  flex: 1;
  font-weight: 550;
}
.picker-foot {
  border-top: 1px solid var(--line);
  margin-top: 6px;
  padding: 10px 6px 2px;
  color: var(--muted);
  line-height: 1.5;
}
.picker-foot a {
  color: var(--xref);
}

/* ---------------------------------------------------------------- home */

.home-title {
  font-size: 30px;
  line-height: 1.2;
  margin: 6px 0 12px;
  text-wrap: balance;
}
.asks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ask {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
  transition:
    border-color 0.12s,
    background 0.12s;
}
.ask:hover {
  background: var(--accent-soft);
}
.ask-n {
  font-size: 28px;
  font-weight: 700;
  color: var(--heading);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.ask-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cta {
  margin: 22px 0 6px;
  gap: 16px;
}
.steps {
  padding-left: 22px;
  max-width: 70ch;
}
.steps li {
  margin-bottom: 10px;
  line-height: 1.6;
}
.steps li::marker {
  color: var(--heading);
  font-weight: 700;
}
.cards3 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.view-card {
  text-align: left;
}
.view-card:hover {
  border-color: var(--accent);
}
.view-card p {
  margin: 6px 0 0;
}
.defs {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 10px 18px;
  margin: 0;
  max-width: 76ch;
}
.defs dt {
  display: flex;
  align-items: center;
  gap: 4px;
}
.defs dd {
  margin: 0;
  color: var(--ink-2);
  font-size: 14.5px;
}
.nav-home {
  display: block;
  width: 100%;
  padding: 6px 10px 12px;
  color: var(--muted);
}
.nav-home:hover {
  color: var(--xref);
}
.supporting {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px dashed var(--line-2);
}
.supporting > .eyebrow {
  margin-bottom: 8px;
}

/* ---------------------------------------------------------------- the ruling dock */

.ruling {
  flex: none; /* a flex item with overflow would otherwise shrink to nothing */
  border-top: 2px solid var(--accent);
  background: color-mix(in srgb, var(--raised) 94%, transparent);
  box-shadow: 0 -10px 28px rgb(0 0 0 / 0.12);
  padding: 10px 40px 14px;
  max-height: 58vh;
  overflow: auto;
}
.ruling.ruled {
  border-top-color: var(--vc);
}
.ruling > details.fold {
  margin: 0 auto 6px;
}
.ruling > details.fold > summary {
  margin-bottom: 4px;
}
.conseqs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.conseq {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink-2);
}
.conseq.c-yes {
  border-left: 3px solid var(--accept);
}
.conseq.c-no {
  border-left: 3px solid var(--decline);
}
.conseq.picked {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--vc) 40%, transparent);
}
.conseq-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.conseq.full .conseq-text {
  display: block;
}
.ruling-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 6px auto 8px;
}
.ruling-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--heading);
}
.verdicts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.verdicts .vbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px;
  font-size: 14.5px;
  font-weight: 650;
  border: 1.5px solid color-mix(in srgb, var(--vc) 55%, var(--line-2));
  color: var(--vc);
  background: color-mix(in srgb, var(--vc) 7%, var(--surface));
  border-radius: 9px;
}
.verdicts .vbtn:hover {
  background: color-mix(in srgb, var(--vc) 16%, var(--surface));
  border-color: var(--vc);
}
.verdicts .vbtn.on {
  background: var(--vc);
  border-color: var(--vc);
  color: var(--surface);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vc) 28%, transparent);
}
.verdicts .vbtn.rec:not(.on) {
  border-style: dashed;
}
.vb-mark {
  width: 1em;
  text-align: center;
}
.verdicts .vbtn.on kbd {
  background: transparent;
  color: inherit;
  border-color: color-mix(in srgb, var(--surface) 50%, transparent);
}
.ruling > * {
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
}

@media (max-width: 900px) {
  .ruling {
    padding: 8px 16px 12px;
  }
  .verdicts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .conseqs {
    grid-template-columns: 1fr;
  }
  .ask {
    grid-template-columns: 44px minmax(0, 1fr);
  }
  .ask-done {
    display: none;
  }
}

.wdiff .mk {
  color: var(--faint);
}
.wdiff .b {
  font-weight: 650;
}
.wdiff .i {
  font-style: italic;
}
.wdiff .code {
  font-family: var(--mono);
  font-size: 0.88em;
  color: var(--tk-ty);
}
.picker-foot .mono {
  overflow-wrap: anywhere;
}
@media (max-height: 860px) {
  .conseq-text {
    -webkit-line-clamp: 2;
  }
  .verdicts .vbtn {
    padding: 7px 6px;
  }
}
</style>
</head>
<body>
<div id="app"><p style="padding:2rem;font-family:system-ui">Loading the review…</p></div>
<script>(() => {
  // src/anchor.ts
  var CONTEXT = 32;
  function createSelector(text, start, end) {
    return {
      exact: text.slice(start, end),
      prefix: text.slice(Math.max(0, start - CONTEXT), start),
      suffix: text.slice(end, end + CONTEXT)
    };
  }
  function lineOf(text, offset) {
    let line = 1;
    for (let i = 0;i < offset && i < text.length; i++)
      if (text.charCodeAt(i) === 10)
        line++;
    return line;
  }
  function commonSuffix(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n])
      n++;
    return n;
  }
  function commonPrefix(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n])
      n++;
    return n;
  }
  function occurrences(text, needle) {
    const out = [];
    if (needle === "")
      return out;
    for (let i = text.indexOf(needle);i !== -1; i = text.indexOf(needle, i + 1))
      out.push(i);
    return out;
  }
  function locate(text, sel, hint) {
    const hits = occurrences(text, sel.exact);
    if (hits.length > 0) {
      let best = hits[0];
      let bestScore = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const at of hits) {
        const before = text.slice(Math.max(0, at - sel.prefix.length), at);
        const after = text.slice(at + sel.exact.length, at + sel.exact.length + sel.suffix.length);
        const score = commonSuffix(before, sel.prefix) + commonPrefix(after, sel.suffix);
        const dist = hint === undefined ? 0 : Math.abs(at - hint);
        if (score > bestScore || score === bestScore && dist < bestDist) {
          best = at;
          bestScore = score;
          bestDist = dist;
        }
      }
      return { status: "exact", start: best, end: best + sel.exact.length, line: lineOf(text, best) };
    }
    if (sel.prefix.length >= 8 && sel.suffix.length >= 8) {
      const window2 = Math.max(sel.exact.length * 4, sel.exact.length + 200);
      let best = null;
      for (const p of occurrences(text, sel.prefix)) {
        const start = p + sel.prefix.length;
        const s = text.indexOf(sel.suffix, start);
        if (s === -1 || s - start > window2)
          continue;
        const dist = hint === undefined ? 0 : Math.abs(start - hint);
        if (!best || dist < best.dist)
          best = { start, end: s, dist };
      }
      if (best) {
        return {
          status: "context",
          start: best.start,
          end: best.end,
          line: lineOf(text, best.start),
          text: text.slice(best.start, best.end)
        };
      }
    }
    return { status: "orphaned" };
  }

  // src/diff.ts
  function tokenize(s) {
    return s.match(/\\w+|\\s+|[^\\w\\s]/gu) ?? [];
  }
  function diffWords(before, after) {
    const a = tokenize(before);
    const b = tokenize(after);
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head])
      head++;
    let tail = 0;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
      tail++;
    }
    const am = a.slice(head, a.length - tail);
    const bm = b.slice(head, b.length - tail);
    const n = am.length;
    const m = bm.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i2 = n - 1;i2 >= 0; i2--) {
      const row = dp[i2];
      const next = dp[i2 + 1];
      for (let j2 = m - 1;j2 >= 0; j2--) {
        row[j2] = am[i2] === bm[j2] ? next[j2 + 1] + 1 : Math.max(next[j2], row[j2 + 1]);
      }
    }
    const parts = [];
    const push = (op, text) => {
      const last = parts[parts.length - 1];
      if (last && last.op === op)
        last.text += text;
      else
        parts.push({ op, text });
    };
    if (head > 0)
      push("same", a.slice(0, head).join(""));
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (am[i] === bm[j]) {
        push("same", am[i]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        push("del", am[i]);
        i++;
      } else {
        push("ins", bm[j]);
        j++;
      }
    }
    while (i < n)
      push("del", am[i++]);
    while (j < m)
      push("ins", bm[j++]);
    if (tail > 0)
      push("same", a.slice(a.length - tail).join(""));
    return cleanup(parts);
  }
  function cleanup(parts) {
    const out = [];
    let del = "";
    let ins = "";
    const flush = () => {
      if (del)
        out.push({ op: "del", text: del });
      if (ins)
        out.push({ op: "ins", text: ins });
      del = "";
      ins = "";
    };
    parts.forEach((p, i) => {
      if (p.op === "del")
        del += p.text;
      else if (p.op === "ins")
        ins += p.text;
      else {
        const prev = parts[i - 1];
        const next = parts[i + 1];
        const between = prev && next && prev.op !== "same" && next.op !== "same";
        if (between && /^\\s+$/.test(p.text)) {
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

  // src/schema.ts
  var isIntentFeedback = (kind) => kind === "if" || kind === "sf";
  var OVERALL = ["approve", "request-changes", "comment"];
  var REQUIRED_WORDS = {
    accept: null,
    amend: "wording",
    decline: "why",
    defer: null,
    revise: "request"
  };

  // src/themes.ts
  var TOKENS = [
    "bg",
    "surface",
    "sunken",
    "raised",
    "ink",
    "ink-2",
    "muted",
    "faint",
    "line",
    "line-2",
    "accent",
    "accent-ink",
    "accent-soft",
    "heading",
    "heading-2",
    "xref",
    "focus",
    "focus-line",
    "accept",
    "amend",
    "decline",
    "defer",
    "revise",
    "hl-comment",
    "hl-question",
    "hl-suggestion",
    "hl-intent-here",
    "hl-mismatch",
    "add-bg",
    "add-strong",
    "del-bg",
    "del-strong",
    "tk-kw",
    "tk-str",
    "tk-com",
    "tk-num",
    "tk-fn",
    "tk-ty",
    "tk-key",
    "shadow"
  ];
  var SHADOW_DARK = "0 1px 2px rgb(0 0 0 / 0.35), 0 12px 32px rgb(0 0 0 / 0.5)";
  var SHADOW_LIGHT = "0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px rgb(0 0 0 / 0.1)";
  var THEMES = [
    {
      id: "gyokuro-desert",
      name: "Gyokuro Desert",
      dark: true,
      colors: {
        bg: "#232527",
        surface: "#1d1f21",
        sunken: "#17181a",
        raised: "#2a2c2f",
        ink: "#d4d4d4",
        "ink-2": "#bdbdbd",
        muted: "#a2a4a2",
        faint: "#7a7c7a",
        line: "#303336",
        "line-2": "#3c4046",
        accent: "#9acd32",
        "accent-ink": "#1d1f21",
        "accent-soft": "#2c3a1a",
        heading: "#9bf99c",
        "heading-2": "#e5db74",
        xref: "#87ceeb",
        focus: "#4a3d14",
        "focus-line": "#e5db74",
        accept: "#9bf99c",
        amend: "#87ceeb",
        decline: "#ff7b7a",
        defer: "#e5db74",
        revise: "#d4a6ff",
        "hl-comment": "#4d4614",
        "hl-question": "#173a4f",
        "hl-suggestion": "#1f4524",
        "hl-intent-here": "#3e2a57",
        "hl-mismatch": "#55201f",
        "add-bg": "#1c3320",
        "add-strong": "#2f6136",
        "del-bg": "#3a1c1c",
        "del-strong": "#723030",
        "tk-kw": "#e5db74",
        "tk-str": "#90ee90",
        "tk-com": "#7ccd7d",
        "tk-num": "#9acd32",
        "tk-fn": "#87ceeb",
        "tk-ty": "#feddaa",
        "tk-key": "#87ceeb",
        shadow: SHADOW_DARK
      }
    },
    {
      id: "gyokuro-desert-og",
      name: "Gyokuro Desert OG",
      dark: true,
      colors: {
        bg: "#232527",
        surface: "#1d1f21",
        sunken: "#17181a",
        raised: "#2a2c2f",
        ink: "#d4d4d4",
        "ink-2": "#bdbdbd",
        muted: "#a2a4a2",
        faint: "#7a7c7a",
        line: "#303336",
        "line-2": "#3c4046",
        accent: "#ffa54f",
        "accent-ink": "#1d1f21",
        "accent-soft": "#3d2b17",
        heading: "#ffa54f",
        "heading-2": "#fa8072",
        xref: "#87ceeb",
        focus: "#4a3216",
        "focus-line": "#ffa54f",
        accept: "#9bf99c",
        amend: "#87ceeb",
        decline: "#ff7b7a",
        defer: "#ffd27a",
        revise: "#d4a6ff",
        "hl-comment": "#4d4614",
        "hl-question": "#173a4f",
        "hl-suggestion": "#1f4524",
        "hl-intent-here": "#3e2a57",
        "hl-mismatch": "#55201f",
        "add-bg": "#1c3320",
        "add-strong": "#2f6136",
        "del-bg": "#3a1c1c",
        "del-strong": "#723030",
        "tk-kw": "#e5db74",
        "tk-str": "#fa8072",
        "tk-com": "#7ccd7d",
        "tk-num": "#ffa54f",
        "tk-fn": "#87ceeb",
        "tk-ty": "#feddaa",
        "tk-key": "#87ceeb",
        shadow: SHADOW_DARK
      }
    },
    {
      id: "gyokuro-dark",
      name: "Gyokuro Dark",
      dark: true,
      colors: {
        bg: "#0f1d16",
        surface: "#1a2920",
        sunken: "#13221a",
        raised: "#213428",
        ink: "#d3ddd7",
        "ink-2": "#b3c4b8",
        muted: "#93ab9a",
        faint: "#6f8a76",
        line: "#26392c",
        "line-2": "#33493a",
        accent: "#5fe08a",
        "accent-ink": "#0f1d16",
        "accent-soft": "#22432e",
        heading: "#b8f28f",
        "heading-2": "#9fd3a7",
        xref: "#ffb86b",
        focus: "#4a3d14",
        "focus-line": "#ffd700",
        accept: "#5fe08a",
        amend: "#5ce1ff",
        decline: "#ff6b8b",
        defer: "#ffd75e",
        revise: "#d29bff",
        "hl-comment": "#4a4416",
        "hl-question": "#173d4d",
        "hl-suggestion": "#1f4a2a",
        "hl-intent-here": "#3d2a55",
        "hl-mismatch": "#55212a",
        "add-bg": "#1d3a26",
        "add-strong": "#2f6a40",
        "del-bg": "#3a1d22",
        "del-strong": "#71303b",
        "tk-kw": "#8fbc8f",
        "tk-str": "#a8d1a3",
        "tk-com": "#7d9a82",
        "tk-num": "#b8d4a3",
        "tk-fn": "#7db87f",
        "tk-ty": "#9fd3a7",
        "tk-key": "#9fd3a7",
        shadow: SHADOW_DARK
      }
    },
    {
      id: "gyokuro-light",
      name: "Gyokuro Light",
      dark: false,
      colors: {
        bg: "#e8f2e8",
        surface: "#f7f9f7",
        sunken: "#edf4ed",
        raised: "#ffffff",
        ink: "#24352a",
        "ink-2": "#3d5940",
        muted: "#52695a",
        faint: "#8aa08e",
        line: "#d7e5d7",
        "line-2": "#c3d6c3",
        accent: "#1a6b1a",
        "accent-ink": "#ffffff",
        "accent-soft": "#dcecdc",
        heading: "#0d5016",
        "heading-2": "#2d5a30",
        xref: "#a14400",
        focus: "#ffe9a8",
        "focus-line": "#d99a00",
        accept: "#176c28",
        amend: "#0b6e99",
        decline: "#c0263d",
        defer: "#8f5c00",
        revise: "#7a2fc4",
        "hl-comment": "#fff0a0",
        "hl-question": "#d4eaff",
        "hl-suggestion": "#d3f2cf",
        "hl-intent-here": "#eadcff",
        "hl-mismatch": "#ffd9dc",
        "add-bg": "#e0f3df",
        "add-strong": "#b4e2b0",
        "del-bg": "#fde8ea",
        "del-strong": "#f5bcc3",
        "tk-kw": "#1a6b1a",
        "tk-str": "#0d5016",
        "tk-com": "#4d6852",
        "tk-num": "#1a6b1a",
        "tk-fn": "#2d5a30",
        "tk-ty": "#0d5016",
        "tk-key": "#0d5016",
        shadow: SHADOW_LIGHT
      }
    },
    {
      id: "neutral-light",
      name: "Neutral Light",
      dark: false,
      colors: {
        bg: "#f6f6f3",
        surface: "#ffffff",
        sunken: "#efefeb",
        raised: "#ffffff",
        ink: "#1c1e22",
        "ink-2": "#3d4149",
        muted: "#62676f",
        faint: "#a4a8ae",
        line: "#e4e3de",
        "line-2": "#d6d5cf",
        accent: "#3657c8",
        "accent-ink": "#ffffff",
        "accent-soft": "#e9eefc",
        heading: "#1c1e22",
        "heading-2": "#3d4149",
        xref: "#3657c8",
        focus: "#fde9c6",
        "focus-line": "#f0b45a",
        accept: "#1a7046",
        amend: "#3657c8",
        decline: "#b4362c",
        defer: "#8f5c00",
        revise: "#7442c8",
        "hl-comment": "#fff0a6",
        "hl-question": "#d7e9ff",
        "hl-suggestion": "#d9f3df",
        "hl-intent-here": "#ece0ff",
        "hl-mismatch": "#ffdcd8",
        "add-bg": "#e7f6ea",
        "add-strong": "#b5e6c0",
        "del-bg": "#fdecea",
        "del-strong": "#f6c2bc",
        "tk-kw": "#8a3fbf",
        "tk-str": "#1f6e32",
        "tk-com": "#5b6068",
        "tk-num": "#a65400",
        "tk-fn": "#2f5fc4",
        "tk-ty": "#096a75",
        "tk-key": "#2f5fc4",
        shadow: SHADOW_LIGHT
      }
    },
    {
      id: "neutral-dark",
      name: "Neutral Dark",
      dark: true,
      colors: {
        bg: "#111215",
        surface: "#17191d",
        sunken: "#0d0e10",
        raised: "#1d2025",
        ink: "#e6e7ea",
        "ink-2": "#c5c8ce",
        muted: "#959aa3",
        faint: "#5b6068",
        line: "#262a30",
        "line-2": "#323740",
        accent: "#7d9cff",
        "accent-ink": "#0b1020",
        "accent-soft": "#1d2640",
        heading: "#e6e7ea",
        "heading-2": "#c5c8ce",
        xref: "#7d9cff",
        focus: "#4a3516",
        "focus-line": "#c98b2e",
        accept: "#4cc38a",
        amend: "#7d9cff",
        decline: "#ff7b72",
        defer: "#e3b341",
        revise: "#b392f0",
        "hl-comment": "#4b4415",
        "hl-question": "#193553",
        "hl-suggestion": "#173d27",
        "hl-intent-here": "#35254f",
        "hl-mismatch": "#4f1f1c",
        "add-bg": "#10291b",
        "add-strong": "#1d5a35",
        "del-bg": "#2f1517",
        "del-strong": "#6b2a2a",
        "tk-kw": "#c792ea",
        "tk-str": "#8fd18f",
        "tk-com": "#7d838d",
        "tk-num": "#f2a65a",
        "tk-fn": "#82aaff",
        "tk-ty": "#5fd4d0",
        "tk-key": "#82aaff",
        shadow: SHADOW_DARK
      }
    }
  ];
  var DEFAULT_DARK = "gyokuro-desert";
  var DEFAULT_LIGHT = "gyokuro-light";
  function themeCss(t) {
    const vars = TOKENS.map((k) => \`--\${k}:\${t.colors[k]};\`).join("");
    return \`:root[data-theme="\${t.id}"]{\${vars}color-scheme:\${t.dark ? "dark" : "light"};}\`;
  }

  // src/ui/highlight.ts
  var EXT = {
    md: "markdown",
    markdown: "markdown",
    ts: "ts",
    tsx: "ts",
    mts: "ts",
    cts: "ts",
    js: "ts",
    jsx: "ts",
    mjs: "ts",
    cjs: "ts",
    json: "json",
    jsonc: "json",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    css: "css",
    scss: "css",
    html: "html",
    htm: "html",
    svg: "html",
    xml: "html",
    py: "python",
    go: "go",
    rs: "rust"
  };
  function langOf(path) {
    const base = path.split("/").pop() ?? path;
    if (/^(\\.envrc|\\.?[a-z]*rc|Dockerfile|Makefile)$/i.test(base) && !base.includes(".json")) {
      return base === "Makefile" || base === "Dockerfile" ? "shell" : "shell";
    }
    const ext = base.includes(".") ? (base.split(".").pop() ?? "").toLowerCase() : "";
    return EXT[ext] ?? "plain";
  }
  var KEYWORDS = {
    ts: new Set("abstract as async await break case catch class const continue debugger declare default delete do else enum export extends false finally for from function get if implements import in instanceof interface is keyof let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while with yield".split(" ")),
    json: new Set(["true", "false", "null"]),
    yaml: new Set(["true", "false", "null", "yes", "no", "on", "off"]),
    toml: new Set(["true", "false"]),
    shell: new Set("if then else elif fi for in do done while until case esac function return local export set unset echo exit source alias".split(" ")),
    python: new Set("and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield".split(" ")),
    go: new Set("break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false".split(" ")),
    rust: new Set("as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while".split(" ")),
    css: new Set(["important", "inherit", "initial", "unset", "none", "auto"])
  };
  var SLASH_COMMENTS = new Set(["ts", "go", "rust", "css"]);
  var HASH_COMMENTS = new Set(["shell", "yaml", "toml", "python"]);
  function highlightLine(lang, text, state) {
    const ranges = [];
    if (lang === "plain" || lang === "markdown")
      return { ranges, state };
    const kw = KEYWORDS[lang];
    let inBlock = state.inBlockComment;
    let i = 0;
    const n = text.length;
    const push = (start, end, cls) => {
      if (end > start)
        ranges.push({ start, end, cls });
    };
    if (!inBlock && (lang === "yaml" || lang === "toml")) {
      const m = /^(\\s*-?\\s*)([\\w.@/-]+|"[^"]*")(\\s*[:=])/.exec(text);
      if (m) {
        push(m[1]?.length ?? 0, (m[1]?.length ?? 0) + (m[2]?.length ?? 0), "tk-key");
        i = m[0].length;
      } else if (lang === "toml" && /^\\s*\\[/.test(text)) {
        push(0, n, "tk-kw");
        return { ranges, state: { inBlockComment: false } };
      }
    }
    while (i < n) {
      if (inBlock) {
        const close = text.indexOf(lang === "html" ? "-->" : "*/", i);
        const end = close === -1 ? n : close + (lang === "html" ? 3 : 2);
        push(i, end, "tk-com");
        i = end;
        inBlock = close === -1;
        continue;
      }
      const ch = text[i];
      const rest = text.slice(i);
      if (SLASH_COMMENTS.has(lang) && rest.startsWith("/*")) {
        inBlock = true;
        continue;
      }
      if (lang === "html" && rest.startsWith("<!--")) {
        inBlock = true;
        continue;
      }
      if (SLASH_COMMENTS.has(lang) && lang !== "css" && rest.startsWith("//") || HASH_COMMENTS.has(lang) && ch === "#") {
        push(i, n, "tk-com");
        break;
      }
      if (ch === '"' || ch === "'" || ch === "\`" && (lang === "ts" || lang === "go" || lang === "shell")) {
        let j = i + 1;
        while (j < n && text[j] !== ch)
          j += text[j] === "\\\\" ? 2 : 1;
        const end = Math.min(n, j + 1);
        const isKey = lang === "json" && /^\\s*:/.test(text.slice(end));
        push(i, end, isKey ? "tk-key" : "tk-str");
        i = end;
        continue;
      }
      if (/[0-9]/.test(ch) && !/[\\w$]/.test(text[i - 1] ?? "")) {
        const m = /^(0x[0-9a-f_]+|\\d[\\d_]*(\\.\\d+)?(e[+-]?\\d+)?)/i.exec(rest);
        if (m) {
          push(i, i + m[0].length, "tk-num");
          i += m[0].length;
          continue;
        }
      }
      if (/[A-Za-z_$@]/.test(ch)) {
        const m = /^[A-Za-z_$@][\\w$-]*/.exec(rest);
        let word = m[0];
        if (lang !== "css" && lang !== "html" && lang !== "shell")
          word = word.replace(/-.*$/, "");
        const end = i + word.length;
        if (kw?.has(word))
          push(i, end, "tk-kw");
        else if (lang === "html" && text[i - 1] === "<")
          push(i, end, "tk-kw");
        else if (/^\\s*\\(/.test(text.slice(end)) && lang !== "css")
          push(i, end, "tk-fn");
        else if (/^[A-Z][a-z0-9]/.test(word) && lang !== "shell")
          push(i, end, "tk-ty");
        i = end;
        continue;
      }
      i++;
    }
    return { ranges, state: { inBlockComment: inBlock } };
  }

  // src/ui/source.ts
  var SPAN = (not) => \`(?:[^\${not}\\\\n]|\\\\n(?![ \\\\t]*\\\\n))\`;
  var INLINE = [
    {
      re: /\`[^\`\\n]+\`/g,
      parts: (m) => [
        [0, 1, "mk"],
        [1, m[0].length - 1, "code"],
        [m[0].length - 1, m[0].length, "mk"]
      ]
    },
    {
      re: new RegExp(\`\\\\[(\${SPAN("\\\\]")}+)\\\\]\\\\(([^)\\\\s]+)\\\\)\`, "g"),
      parts: (m) => {
        const t = m[1].length;
        return [
          [0, 1, "mk"],
          [1, 1 + t, "a"],
          [1 + t, m[0].length, "mk url"]
        ];
      }
    },
    {
      re: new RegExp(\`\\\\*\\\\*(?=\\\\S)((?:\${SPAN("*")}|\\\\*(?!\\\\*))+?)\\\\*\\\\*\`, "g"),
      parts: (m) => [
        [0, 2, "mk"],
        [2, m[0].length - 2, "b"],
        [m[0].length - 2, m[0].length, "mk"]
      ]
    },
    {
      re: new RegExp(\`(?<![\\\\w*])_(?=\\\\S)(\${SPAN("_")}+?)_(?!\\\\w)|(?<![\\\\w*])\\\\*(?=[^\\\\s*])(\${SPAN("*")}+?)\\\\*(?![\\\\w*])\`, "g"),
      parts: (m) => [
        [0, 1, "mk"],
        [1, m[0].length - 1, "i"],
        [m[0].length - 1, m[0].length, "mk"]
      ]
    }
  ];
  function inlineRanges(text) {
    const fences = [];
    const fence = /^[ \\t]*\`\`\`.*$/gm;
    for (let open = fence.exec(text);open; open = fence.exec(text)) {
      const close = fence.exec(text);
      fences.push([open.index, close ? close.index + close[0].length : text.length]);
      if (!close)
        break;
    }
    const inFence = (a, b) => fences.some(([s, e]) => a < e && b > s);
    const out = [];
    for (const { re, parts } of INLINE) {
      re.lastIndex = 0;
      for (let m = re.exec(text);m; m = re.exec(text)) {
        if (inFence(m.index, m.index + m[0].length))
          continue;
        for (const [s, e, c] of parts(m))
          out.push({ start: m.index + s, end: m.index + e, cls: c });
      }
    }
    return out;
  }
  function lineStyle(text, inFence) {
    const ranges = [];
    if (inFence || /^\\s*\`\`\`/.test(text))
      return { cls: "code-line", ranges };
    let cls = "";
    const heading = /^(#{1,6})\\s/.exec(text);
    if (heading) {
      cls = \`h h\${heading[1].length}\`;
      ranges.push({ start: 0, end: heading[0].length, cls: "mk" });
    } else if (/^\\s*>/.test(text)) {
      const m = /^\\s*>\\s?/.exec(text);
      cls = "bq";
      ranges.push({ start: 0, end: m[0].length, cls: "mk" });
    } else if (/^\\s*\\|/.test(text)) {
      cls = "tbl";
    } else {
      const li = /^(\\s*)([-*+]|\\d+\\.)\\s/.exec(text);
      if (li) {
        const ordered = /\\d/.test(li[2]);
        ranges.push({
          start: li[1].length,
          end: li[0].length,
          cls: ordered ? "mk li ol" : "mk li"
        });
      }
    }
    return { cls, ranges };
  }
  function segment(text, start, end, ranges) {
    const cuts = new Set([start, end]);
    for (const r of ranges) {
      if (r.start > start && r.start < end)
        cuts.add(r.start);
      if (r.end > start && r.end < end)
        cuts.add(r.end);
    }
    const points = [...cuts].sort((a, b) => a - b);
    const out = [];
    for (let i = 0;i < points.length - 1; i++) {
      const s = points[i];
      const e = points[i + 1];
      const cover = ranges.filter((r) => r.start <= s && r.end >= e);
      out.push({
        start: s,
        end: e,
        text: text.slice(s, e),
        cls: [...new Set(cover.flatMap((r) => r.cls.split(" ").filter(Boolean)))],
        ids: [...new Set(cover.flatMap((r) => r.id === undefined ? [] : [r.id]))],
        links: [...new Set(cover.flatMap((r) => r.link === undefined ? [] : [r.link]))]
      });
    }
    return out;
  }
  function renderLines(text, lang = "markdown", marks = []) {
    const lines = [];
    let offset = 0;
    let inFence = false;
    let hl = { inBlockComment: false };
    const clipped = lang === "markdown" ? [...inlineRanges(text), ...marks] : marks;
    text.split(\`
\`).forEach((lineText, idx) => {
      const start = offset;
      const end = start + lineText.length;
      offset = end + 1;
      let cls = "";
      let ranges;
      if (lang === "markdown") {
        const fenceMarker = /^\\s*\`\`\`/.test(lineText);
        const st = lineStyle(lineText, inFence);
        if (fenceMarker)
          inFence = !inFence;
        cls = st.cls;
        ranges = st.ranges;
      } else {
        const r = highlightLine(lang, lineText, hl);
        hl = r.state;
        ranges = r.ranges;
      }
      const all = ranges.map((r) => ({ ...r, start: r.start + start, end: r.end + start }));
      for (const m of clipped) {
        if (m.end > start && m.start < end) {
          const r = { start: Math.max(m.start, start), end: Math.min(m.end, end), cls: m.cls };
          if (m.id !== undefined)
            r.id = m.id;
          if (m.link !== undefined)
            r.link = m.link;
          all.push(r);
        }
      }
      lines.push({ n: idx + 1, start, end, cls, segments: segment(text, start, end, all) });
    });
    return lines;
  }
  function blocks(lines, text) {
    const out = [];
    let cur = null;
    let fence = false;
    const close = () => {
      cur = null;
    };
    const open = (kind, line, depth = 0, ordered = false) => {
      cur = { kind, depth, ordered, lines: [line] };
      out.push(cur);
    };
    for (const line of lines) {
      const t = text.slice(line.start, line.end);
      if (fence) {
        cur?.lines.push(line);
        if (/^\\s*\`\`\`/.test(t)) {
          fence = false;
          close();
        }
        continue;
      }
      if (/^\\s*\`\`\`/.test(t)) {
        open("code", line);
        fence = true;
        continue;
      }
      if (t.trim() === "") {
        close();
        continue;
      }
      const h = /^(#{1,6})\\s/.exec(t);
      if (h) {
        open(\`h\${h[1].length}\`, line);
        close();
        continue;
      }
      if (/^\\s*([-*_])(\\s*\\1){2,}\\s*$/.test(t)) {
        open("hr", line);
        close();
        continue;
      }
      if (/^\\s*\\|/.test(t)) {
        if (cur?.kind === "table")
          cur.lines.push(line);
        else
          open("table", line);
        continue;
      }
      if (/^\\s*>/.test(t)) {
        if (cur?.kind === "bq")
          cur.lines.push(line);
        else
          open("bq", line);
        continue;
      }
      const li = /^(\\s*)([-*+]|\\d+\\.)\\s/.exec(t);
      if (li) {
        open("li", line, Math.floor(li[1].length / 2), /\\d/.test(li[2]));
        continue;
      }
      if (cur)
        cur.lines.push(line);
      else
        open("p", line);
    }
    return out;
  }
  function headingText(line) {
    const m = /^#{1,6}\\s+(.*)$/.exec(line);
    if (!m)
      return null;
    return m[1].replace(/[\`*_]/g, "").trim();
  }
  function findSection(text, section) {
    const want = section.replace(/[\`*_]/g, "").trim().toLowerCase();
    if (!want)
      return null;
    let offset = 0;
    for (const line of text.split(\`
\`)) {
      const h = headingText(line);
      if (h?.toLowerCase().includes(want))
        return offset;
      offset += line.length + 1;
    }
    return null;
  }

  // src/ui/xref.ts
  function buildIndex(paths, sfIds, preferred = []) {
    const files = new Set(paths);
    const entries = new Map;
    const adrs = new Map;
    const basenames = new Map;
    for (const p of paths) {
      const e = /^design\\/((\\d{4})-[^/]+)\\//.exec(p);
      if (e && !entries.has(e[2]))
        entries.set(e[2], \`design/\${e[1]}\`);
      const a = /^design\\/decisions\\/(\\d{4})-[^/]+\\.md$/.exec(p);
      if (a)
        adrs.set(a[1], p);
      const b = p.split("/").pop();
      basenames.set(b, [...basenames.get(b) ?? [], p]);
    }
    return { files, entries, adrs, sfs: new Set(sfIds), basenames, preferred };
  }
  function entryOf(pathOrId) {
    return /(?:^|\\/)(\\d{4}-[a-z0-9-]+)(?:\\/|$)/.exec(pathOrId)?.[1];
  }
  function normalize(dir, target) {
    const parts = (target.startsWith("/") || !dir ? [] : dir.split("/")).filter(Boolean);
    for (const seg of target.replace(/^\\//, "").split("/")) {
      if (seg === "..")
        parts.pop();
      else if (seg !== "." && seg !== "")
        parts.push(seg);
    }
    return parts.join("/");
  }
  function resolvePath(idx, ctx, raw) {
    const target = raw.split("#")[0]?.replace(/[.,;:)]+$/, "") ?? "";
    if (!target || /^[a-z]+:/i.test(target))
      return null;
    for (const cand of [normalize(ctx.dir, target), normalize(undefined, target)]) {
      if (idx.files.has(cand))
        return cand;
      if (idx.files.has(\`\${cand}/README.md\`))
        return \`\${cand}/README.md\`;
    }
    return null;
  }
  function findRefs(text, idx, ctx = {}) {
    const out = [];
    const taken = [];
    const free = (s, e) => !out.some((r) => s < r.end && e > r.start) && !taken.some(([a, b]) => s < b && e > a);
    const add = (s, e, link) => {
      if (e > s && free(s, e))
        out.push({ start: s, end: e, cls: "xref", link });
    };
    for (const m of text.matchAll(/\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)/g)) {
      const path = resolvePath(idx, ctx, m[2]);
      const at = m.index;
      const textEnd = at + 1 + m[1].length;
      if (path)
        add(at + 1, textEnd, \`file:\${path}\`);
      taken.push([textEnd, at + m[0].length]);
    }
    for (const m of text.matchAll(/\\b(?:(\\d{4})(?:-[a-z0-9-]+)?(?:['’]s)?[ /])?(?:IF|SF)-(\\d{3})\\b/g)) {
      const num = m[1];
      const sf = \`IF-\${m[2]}\`;
      let entryDir = num ? idx.entries.get(num)?.replace(/^design\\//, "") : ctx.entry;
      if (!entryDir && !num) {
        const hits = idx.preferred.filter((p) => p.endsWith(\`/\${sf}\`));
        if (hits.length === 1)
          entryDir = hits[0].slice(0, -sf.length - 1);
      }
      if (!entryDir)
        continue;
      const id = \`\${entryDir}/\${sf}\`;
      if (idx.sfs.has(id))
        add(m.index, m.index + m[0].length, \`if:\${id}\`);
    }
    for (const m of text.matchAll(/\\bADR[ -]?(\\d{4})\\b/g)) {
      if (idx.adrs.has(m[1]))
        add(m.index, m.index + m[0].length, \`adr:\${m[1]}\`);
    }
    for (const m of text.matchAll(/(?<![\\w/.-])((?:\\.\\.?\\/)*(?:intent|design|src|test|tools|template)\\/[\\w./-]*[\\w/])/g)) {
      const path = resolvePath(idx, ctx, m[1]);
      if (path)
        add(m.index, m.index + m[1].length, \`file:\${path}\`);
    }
    for (const m of text.matchAll(/(?<![\\w/.-])((?:\\.\\.?\\/)*[\\w.-]+\\.md)\\b/g)) {
      const raw = m[1];
      const path = resolvePath(idx, ctx, raw) ?? uniqueBase(idx, raw);
      if (path)
        add(m.index, m.index + raw.length, \`file:\${path}\`);
    }
    for (const m of text.matchAll(/(?<![\\w/.-])(0\\d{3})(?![\\w-])/g)) {
      const n = m[1];
      const link = idx.entries.has(n) ? \`entry:\${n}\` : idx.adrs.has(n) ? \`adr:\${n}\` : null;
      if (link)
        add(m.index, m.index + n.length, link);
    }
    return out.sort((a, b) => a.start - b.start);
  }
  function uniqueBase(idx, raw) {
    const hits = idx.basenames.get(raw.split("/").pop()) ?? [];
    return hits.length === 1 ? hits[0] : null;
  }

  // src/ui/main.ts
  var token = new URLSearchParams(location.search).get("token") ?? "";
  var root = document.getElementById("app");
  var S;
  var FILES = new Map;
  var IDX = buildIndex([], []);
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false)
        continue;
      if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2), v);
      } else if (k === "class")
        el.className = String(v);
      else if (k === "tip") {
        el.dataset.tip = String(v);
        el.setAttribute("aria-description", String(v));
      } else if (k === "value")
        el.value = String(v);
      else
        el.setAttribute(k, v === true ? "" : String(v));
    }
    const add = (c) => {
      if (c === null || c === undefined || c === false)
        return;
      if (Array.isArray(c))
        c.forEach(add);
      else
        el.append(typeof c === "string" ? document.createTextNode(c) : c);
    };
    children.forEach(add);
    return el;
  }
  var icon = (name) => h("span", { class: \`ic ic-\${name}\`, "aria-hidden": "true" });
  async function api(method, path, body) {
    const init = {
      method,
      headers: { "x-review-token": token, "content-type": "application/json" }
    };
    if (body !== undefined)
      init.body = JSON.stringify(body);
    const res = await fetch(path, init);
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  var saveTimer;
  function changed() {
    if (S.ended)
      return;
    S.saved = "saving";
    paintChrome();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        S.saved = (await api("PUT", "/api/draft", S.review)).status === 200 ? "saved" : "error";
      } catch {
        S.saved = "error";
      }
      paintChrome();
    }, 400);
  }
  function paintChrome() {
    const el = document.getElementById("save-state");
    if (el) {
      el.textContent = {
        idle: "Nothing to save yet",
        saving: "Saving…",
        saved: "Draft saved",
        error: "Draft NOT saved"
      }[S.saved];
      el.className = \`save \${S.saved}\`;
    }
    const n = document.getElementById("session-count");
    if (n)
      n.textContent = String(S.review.verdicts.length + S.review.annotations.length);
  }
  var items = () => S.packet.items;
  var currentItem = () => items()[S.current];
  var fileText = (path) => FILES.get(path);
  var verdictOf = (id) => S.review.verdicts.find((v) => v.item === id);
  var itemById = (id) => items().find((i) => i.id === id);
  var KIND_LABEL = {
    if: "Intent feedback",
    sf: "Intent feedback",
    question: "Open question",
    "intent-change": "Intent change",
    "design-entry": "Design entry",
    decision: "Decision",
    finding: "Finding"
  };
  var kindLabel = (it) => KIND_LABEL[it.kind] ?? it.kind;
  var isChange = (it) => it.kind === "intent-change" || it.kind === "design-entry" || it.kind === "decision";
  var capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  function verdictLabel(it, v) {
    if (isChange(it) && v === "accept")
      return "approve";
    if (isChange(it) && v === "decline")
      return "reject";
    return v;
  }
  function shortId(id) {
    const m = /^(\\d{4})-[^/]*\\/(?:IF|SF)-(\\d+)$/.exec(id);
    if (m)
      return \`\${m[1]} IF-\${m[2]}\`;
    const adr = /(?:^|\\/)decisions\\/(\\d{4})-/.exec(id);
    if (adr)
      return \`ADR \${adr[1]}\`;
    const entry = /^design\\/(\\d{4})-[^/]+$/.exec(id);
    if (entry)
      return \`entry \${entry[1]}\`;
    if (id.startsWith("intent-change/"))
      return id.split("/").pop();
    return id.length > 40 ? \`…\${id.slice(-38)}\` : id;
  }
  function setVerdict(id, verdict) {
    const i = S.review.verdicts.findIndex((v) => v.item === id);
    if (verdict === null) {
      if (i !== -1)
        S.review.verdicts.splice(i, 1);
    } else {
      const next = { ...i === -1 ? {} : S.review.verdicts[i], item: id, verdict };
      if (verdict === "amend" && !next.wording)
        next.wording = amendSeed(id);
      if (i === -1)
        S.review.verdicts.push(next);
      else
        S.review.verdicts[i] = next;
    }
    changed();
  }
  function amendSeed(id) {
    const it = itemById(id);
    return it?.proposal?.edits[0]?.after ?? it?.sections.find((s) => s.key === "revision")?.text ?? "";
  }
  function targetText(t) {
    if (t.kind === "file")
      return fileText(t.path);
    return itemById(t.item)?.sections.find((s) => s.key === t.section)?.text;
  }
  var sameTarget = (a, b) => a.kind === "file" ? b.kind === "file" && a.path === b.path : b.kind === "item" && a.item === b.item && a.section === b.section;
  var annotationsOn = (t) => S.review.annotations.filter((a) => sameTarget(a.target, t));
  var annotationsForItem = (id) => S.review.annotations.filter((a) => a.target.kind === "item" && a.target.item === id || a.item === id);
  var annotationsInFile = (path) => S.review.annotations.filter((a) => a.target.kind === "file" && a.target.path === path);
  function marksFor(t, text) {
    const out = [];
    for (const a of annotationsOn(t)) {
      const at = locate(text, a.selector, a.at?.start);
      if (at.status !== "orphaned") {
        out.push({ start: at.start, end: at.end, cls: \`hl hl-\${a.kind}\`, id: a.id });
      }
    }
    return out;
  }
  function targetLabel(a) {
    const t = a.target;
    if (t.kind === "file")
      return \`\${t.path}\${a.at ? \`:\${a.at.line}\` : ""}\`;
    const it = itemById(t.item);
    const label = it?.sections.find((s) => s.key === t.section)?.label ?? t.section;
    return \`\${shortId(t.item)} · \${label}\`;
  }
  function refRange(r, text) {
    if (r.quote) {
      const at = text.indexOf(r.quote);
      if (at >= 0)
        return { start: at, end: at + r.quote.length };
    }
    if (r.lines) {
      const lines = text.split(\`
\`);
      let start = 0;
      for (let i = 0;i < r.lines.start - 1 && i < lines.length; i++) {
        start += lines[i].length + 1;
      }
      let end = start;
      for (let i = r.lines.start - 1;i < r.lines.end && i < lines.length; i++) {
        end += lines[i].length + 1;
      }
      return { start, end: Math.max(start, end - 1) };
    }
    return null;
  }
  function refLabel(r) {
    if (r.lines) {
      const span = r.lines.end !== r.lines.start ? \`–\${r.lines.end}\` : "";
      return \`\${r.path}:\${r.lines.start}\${span}\`;
    }
    const text = fileText(r.path) ?? "";
    const range = refRange(r, text);
    return range ? \`\${r.path}:\${lineOf(text, range.start)}\` : r.path;
  }
  function spanFor(s) {
    const span = h("span", { "data-o": s.start, class: s.cls.join(" ") || undefined }, s.text);
    const link = s.links[0];
    if (link) {
      span.dataset.link = link;
      span.tabIndex = 0;
      span.addEventListener("click", (e) => {
        if (window.getSelection()?.isCollapsed) {
          e.stopPropagation();
          followLink(link);
        }
      });
      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          followLink(link);
      });
      hoverPeek(span, () => linkCard(link));
    }
    if (s.ids.length) {
      span.dataset.ann = s.ids.join(" ");
      span.title = s.ids.map((id) => S.review.annotations.find((a) => a.id === id)?.comment ?? "").filter(Boolean).join(\`
—
\`);
      if (!link) {
        span.addEventListener("click", (e) => {
          if (window.getSelection()?.isCollapsed) {
            e.stopPropagation();
            editAnnotation(s.ids[0]);
          }
        });
      }
    }
    return span;
  }
  function viewMarks(text, o) {
    return [
      ...o.target ? marksFor(o.target, text) : [],
      ...o.extra ?? [],
      ...o.ctx ? findRefs(text, IDX, o.ctx) : []
    ];
  }
  var fileCtx = (path) => {
    const c = { dir: path.split("/").slice(0, -1).join("/") };
    const e = entryOf(path);
    if (e)
      c.entry = e;
    return c;
  };
  var itemCtx = (it) => {
    if (!it)
      return {};
    const c = fileCtx(it.source.path);
    const e = entryOf(it.id) ?? c.entry;
    if (e)
      c.entry = e;
    return c;
  };
  function annotatable(el, t) {
    if (!t)
      return el;
    el.classList.add("anno");
    el.dataset.kind = t.kind;
    if (t.kind === "file")
      el.dataset.path = t.path;
    else {
      el.dataset.item = t.item;
      el.dataset.section = t.section;
    }
    return el;
  }
  function proseView(text, o = {}) {
    const marks = viewMarks(text, o);
    const lines = renderLines(text, "markdown", marks);
    const view = h("div", { class: \`prose\${o.compact ? " compact" : ""}\` });
    for (const b of blocks(lines, text)) {
      const first = b.lines[0];
      const last = b.lines[b.lines.length - 1];
      if (!first || !last)
        continue;
      if (o.window && (last.end < o.window.start || first.start > o.window.end))
        continue;
      const el = h("div", {
        class: \`blk b-\${b.kind}\${b.ordered ? " ol" : ""}\`,
        "data-line": first.n,
        "data-start": first.start,
        "data-end": last.end,
        style: b.depth ? \`--depth:\${b.depth}\` : undefined
      });
      b.lines.forEach((line, i) => {
        for (const s of line.segments)
          el.append(spanFor(s));
        if (i < b.lines.length - 1)
          el.append(h("span", { class: "nl", "data-o": line.end }, \`
\`));
      });
      view.append(el);
    }
    return annotatable(view, o.target);
  }
  function codeView(text, lang, o = {}) {
    const marks = viewMarks(text, o);
    const lines = renderLines(text, lang, marks);
    const view = h("div", { class: \`codeview lang-\${lang}\${o.compact ? " compact" : ""}\` });
    for (const line of lines) {
      if (o.lines && (line.n < o.lines.start || line.n > o.lines.end))
        continue;
      const el = h("div", {
        class: \`ln \${line.cls}\`,
        "data-line": line.n,
        "data-start": line.start,
        "data-end": line.end
      });
      for (const s of line.segments)
        el.append(spanFor(s));
      view.append(el);
    }
    return annotatable(view, o.target);
  }
  function fileView(path, o = {}) {
    const text = fileText(path) ?? "";
    const lang = langOf(path);
    const target = { kind: "file", path };
    const ctx = fileCtx(path);
    if (lang === "markdown" && !S.raw)
      return proseView(text, { ...o, target, ctx });
    return codeView(text, lang, { ...o, target, ctx });
  }
  function excerpt(r) {
    const text = fileText(r.path);
    if (text === undefined)
      return null;
    const range = refRange(r, text);
    if (!range)
      return null;
    const target = { kind: "file", path: r.path };
    const focus = { ...range, cls: "focus" };
    const lang = langOf(r.path);
    if (lang === "markdown") {
      return h("div", { class: "excerpt" }, proseView(text, {
        target,
        extra: [focus],
        window: range,
        compact: true,
        ctx: fileCtx(r.path)
      }));
    }
    const a = lineOf(text, range.start);
    const b = lineOf(text, range.end);
    return h("div", { class: "excerpt" }, codeView(text, lang, {
      target,
      ctx: fileCtx(r.path),
      extra: [focus],
      lines: { start: Math.max(1, a - 2), end: b + 2 },
      compact: true
    }));
  }
  function itemText(it, key, text) {
    return proseView(text, {
      target: { kind: "item", item: it.id, section: key },
      compact: true,
      ctx: itemCtx(it)
    });
  }
  var plainProse = (text, ctx = itemCtx(currentItem())) => proseView(text, { compact: true, ctx });
  function linked(text, ctx = itemCtx(currentItem())) {
    const refs = findRefs(text, IDX, ctx);
    return h("span", {}, segment(text, 0, text.length, refs).map((sg) => spanFor(sg)));
  }
  function wordDiff(before, after) {
    const parts = diffWords(before, after);
    const ops = [];
    let text = "";
    for (const d of parts) {
      ops.push({ start: text.length, end: text.length + d.text.length, cls: \`w-\${d.op}\` });
      text += d.text;
    }
    const segs = segment(text, 0, text.length, [...ops, ...inlineRanges(text)]);
    return h("div", { class: "wdiff" }, segs.map((sg) => h("span", { class: sg.cls.join(" ") || undefined }, sg.text)));
  }
  function patchView(change) {
    const lang = langOf(change.path);
    const out = h("div", { class: "patch" });
    const lines = change.patch.split(\`
\`);
    let oldN = 0;
    let newN = 0;
    const row = (sign, content, cls, words, o, n) => {
      const hl = lang === "markdown" || lang === "plain" ? [] : highlightLine(lang, content, { inBlockComment: false }).ranges;
      const segs = segment(content, 0, content.length, [...hl, ...words]);
      return h("div", { class: \`pl \${cls}\` }, h("span", { class: "gut" }, String(o)), h("span", { class: "gut" }, String(n)), h("span", { class: "sign" }, sign), h("span", { class: "pc" }, segs.map((s) => h("span", { class: s.cls.join(" ") || undefined }, s.text))));
    };
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^(diff --git|index |--- |\\+\\+\\+ |similarity |rename |new file|deleted file|old mode|new mode)/.test(l)) {
        i++;
        continue;
      }
      const hunk = /^@@ -(\\d+)(?:,\\d+)? \\+(\\d+)(?:,\\d+)? @@(.*)$/.exec(l);
      if (hunk) {
        oldN = Number(hunk[1]);
        newN = Number(hunk[2]);
        out.append(h("div", { class: "pl hunk" }, h("span", { class: "gut" }, "⋯"), h("span", { class: "gut" }, "⋯"), h("span", { class: "sign" }, ""), h("span", { class: "pc" }, (hunk[3] ?? "").trim() || \`line \${newN}\`)));
        i++;
        continue;
      }
      if (l.startsWith("-")) {
        let j = i;
        while (j < lines.length && lines[j].startsWith("-"))
          j++;
        let k = j;
        while (k < lines.length && lines[k].startsWith("+"))
          k++;
        const dels = lines.slice(i, j).map((x) => x.slice(1));
        const adds = lines.slice(j, k).map((x) => x.slice(1));
        const pair = dels.length === adds.length;
        dels.forEach((d, n) => {
          out.append(row("−", d, "del", pair ? wordRanges(d, adds[n], "del") : [], oldN++, ""));
        });
        adds.forEach((a, n) => {
          out.append(row("+", a, "add", pair ? wordRanges(dels[n], a, "ins") : [], "", newN++));
        });
        i = k;
        continue;
      }
      if (l.startsWith("+"))
        out.append(row("+", l.slice(1), "add", [], "", newN++));
      else if (l.startsWith("\\\\"))
        out.append(h("div", { class: "pl meta" }, l));
      else if (l.startsWith(" "))
        out.append(row("", l.slice(1), "ctx", [], oldN++, newN++));
      i++;
    }
    return out;
  }
  function wordRanges(before, after, side) {
    const out = [];
    let pos = 0;
    for (const d of diffWords(before, after)) {
      if (d.op === "same" || d.op === side) {
        if (d.op === side)
          out.push({ start: pos, end: pos + d.text.length, cls: "wd" });
        pos += d.text.length;
      }
    }
    return out;
  }
  function offsetOf(node, offset) {
    if (node.nodeType === Node.TEXT_NODE) {
      const span = node.parentElement?.closest("[data-o]");
      return span ? Number(span.dataset.o) + Math.min(offset, node.textContent?.length ?? 0) : null;
    }
    const el = node;
    if (el.dataset?.o !== undefined) {
      return Number(el.dataset.o) + (offset > 0 ? el.textContent?.length ?? 0 : 0);
    }
    const row = el.closest?.(".blk, .ln");
    if (row) {
      const child = row.children[offset];
      return child?.dataset.o !== undefined ? Number(child.dataset.o) : Number(row.dataset.end);
    }
    if (el.classList?.contains("anno")) {
      const child = el.children[offset];
      if (child?.dataset.start)
        return Number(child.dataset.start);
      const last = el.lastElementChild;
      return last ? Number(last.dataset.end) : null;
    }
    return null;
  }
  function selectionTarget() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed)
      return null;
    const r = sel.getRangeAt(0);
    const host = (n) => (n.nodeType === Node.TEXT_NODE ? n.parentElement : n)?.closest(".anno");
    const a = host(r.startContainer);
    if (!a || a !== host(r.endContainer))
      return null;
    const start = offsetOf(r.startContainer, r.startOffset);
    const end = offsetOf(r.endContainer, r.endOffset);
    if (start === null || end === null || end <= start)
      return null;
    const target = a.dataset.kind === "file" ? { kind: "file", path: a.dataset.path } : { kind: "item", item: a.dataset.item, section: a.dataset.section };
    const text = targetText(target) ?? "";
    let s = start;
    let e = end;
    while (s < e && /\\s/.test(text[s]))
      s++;
    while (e > s && /\\s/.test(text[e - 1]))
      e--;
    if (e <= s)
      return null;
    const p = { target, start: s, end: e };
    const it = currentItem();
    if (S.view === "queue" && it && target.kind === "file")
      p.item = it.id;
    return p;
  }
  var ANN_KEYS = [
    ["comment", "c", "Comment"],
    ["question", "q", "Question"],
    ["suggestion", "s", "Suggest edit"],
    ["intent-here", "i", "Intent here"],
    ["mismatch", "x", "Mismatch"]
  ];
  var ANN_HINT = {
    comment: "Your comment…",
    question: "Your question — the agent answers it next iteration…",
    suggestion: "Why (optional)…",
    "intent-here": "The intent this expresses is… (the agent adds it to intent/, or strengthens the passage that owns it)",
    mismatch: "How this diverges from the intent… (the agent reconciles the code or the intent)"
  };
  var ANN_TIP = {
    comment: "Comment — a remark for the agent to weigh. It may act on it or simply take note; no reply is owed. Use a question when you want an answer.",
    question: "Question — something you want answered. The agent replies (in its report, or as a new item next pass) before acting on it.",
    suggestion: "Suggest edit — replace the selected text with your own wording. The agent applies it through the normal review path.",
    "intent-here": "Intent here — say, in your words, what this passage is for: the purpose behind it that is written nowhere else (often code). The agent records it in intent/, or strengthens the slice that should already say it.",
    mismatch: "Mismatch — this does not do what the intent says. The agent works out whether the code or the intent should change, and brings that choice back to you."
  };
  var VERDICT_TIP = {
    accept: "Accept — the proposal is right. The agent makes the intent edit as proposed, in its own change for review.",
    amend: "Amend — right direction, your words. You write the wording; the agent makes the intent edit with it.",
    decline: "Decline — no change to the intent. Give a one-line why; it is recorded on the item as its disposition.",
    defer: "Defer — not now. Optionally record your ruling to apply later; otherwise the item simply stays open.",
    revise: "Revise — send it back. The agent reworks the proposal or analysis as you ask and shows it again next pass."
  };
  var CHANGE_TIP = {
    accept: "Approve — this change is right as it stands.",
    amend: "Amend — keep the change, in your wording. The agent applies it on the branch.",
    decline: "Reject — this change should not go in. Say why; the agent reverts or reworks it on the branch.",
    defer: "Defer — no ruling on this change yet.",
    revise: "Revise — the agent reworks this change as you ask and brings it back for another look."
  };
  var VIEW_TIP = {
    home: "Home — what this review is, what you are asked to do, how to work through it, and the keys.",
    queue: "Queue — the items needing your ruling, one at a time, with the intent they touch beside them.",
    files: "Files — every file in the snapshot (intent, design, code), to read and to note anywhere.",
    dashboard: "Dashboard — every intent-feedback item (IF) in the repository, by status and by the intent slice it questions.",
    submit: "Review & submit — look over every ruling and note from this session, then hand them back to the agent."
  };
  var editor = null;
  function openEditor(kind) {
    const p = selectionTarget();
    if (!p) {
      toast("Select some text first — in an item, an intent passage, or any file.");
      return;
    }
    const text = targetText(p.target) ?? "";
    const selector = createSelector(text, p.start, p.end);
    const annotation = {
      id: nextAnnotationId(),
      target: p.target,
      selector,
      at: { start: p.start, end: p.end, line: lineOf(text, p.start) },
      kind,
      comment: "",
      createdAt: new Date().toISOString()
    };
    if (p.item)
      annotation.item = p.item;
    if (kind === "suggestion")
      annotation.suggestion = selector.exact;
    editor = { annotation, isNew: true };
    window.getSelection()?.removeAllRanges();
    hideToolbar();
    render();
  }
  function editAnnotation(id) {
    const a = S.review.annotations.find((x) => x.id === id);
    if (!a)
      return;
    editor = { annotation: structuredClone(a), isNew: false };
    render();
  }
  function nextAnnotationId() {
    let n = S.review.annotations.length + 1;
    while (S.review.annotations.some((a) => a.id === \`a\${n}\`))
      n++;
    return \`a\${n}\`;
  }
  function saveEditor() {
    if (!editor)
      return;
    const a = editor.annotation;
    if (a.kind !== "suggestion" && !a.comment.trim()) {
      toast("Write the note first, or press Esc to cancel.");
      return;
    }
    if (a.kind === "suggestion" && a.suggestion === undefined)
      a.suggestion = a.selector.exact;
    if (a.kind !== "suggestion")
      delete a.suggestion;
    const i = S.review.annotations.findIndex((x) => x.id === a.id);
    if (i === -1)
      S.review.annotations.push(a);
    else
      S.review.annotations[i] = a;
    editor = null;
    changed();
    render();
  }
  function deleteAnnotation(id) {
    S.review.annotations = S.review.annotations.filter((a) => a.id !== id);
    editor = null;
    changed();
    render();
  }
  function closeEditor() {
    editor = null;
    render();
  }
  function fieldKeys(confirm2, cancel) {
    return (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        confirm2();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
  }
  function editorModal() {
    if (!editor)
      return null;
    const a = editor.annotation;
    const keys = fieldKeys(saveEditor, closeEditor);
    const comment = h("textarea", {
      class: "field",
      rows: 4,
      placeholder: ANN_HINT[a.kind],
      oninput: (e) => {
        a.comment = e.target.value;
      },
      onkeydown: keys
    });
    comment.value = a.comment;
    let suggestion = null;
    if (a.kind === "suggestion") {
      suggestion = h("textarea", {
        class: "field mono",
        rows: Math.min(12, Math.max(3, (a.suggestion ?? "").split(\`
\`).length + 1)),
        oninput: (e) => {
          a.suggestion = e.target.value;
        },
        onkeydown: keys
      });
      suggestion.value = a.suggestion ?? "";
    }
    const focusEl = suggestion ?? comment;
    setTimeout(() => focusEl.focus(), 0);
    const quote = a.selector.exact;
    return h("div", {
      class: "modal",
      onmousedown: (e) => {
        if (e.target === e.currentTarget)
          closeEditor();
      }
    }, h("div", { class: "modal-box", role: "dialog", "aria-label": "Note" }, h("div", { class: "modal-head" }, h("strong", {}, editor.isNew ? "New note" : \`Note \${a.id}\`), h("span", { class: "muted mono small" }, targetLabel(a))), h("blockquote", { class: "quote" }, quote.length > 600 ? \`\${quote.slice(0, 600)}…\` : quote), h("div", { class: "seg" }, ANN_KEYS.map(([k, , label]) => h("button", {
      class: \`pill k-\${k} \${a.kind === k ? "on" : ""}\`,
      tip: ANN_TIP[k],
      onclick: () => {
        a.kind = k;
        if (k === "suggestion" && a.suggestion === undefined)
          a.suggestion = quote;
        render();
      }
    }, label))), suggestion ? [h("label", { class: "lbl" }, "Replace the quoted text with"), suggestion] : null, h("label", { class: "lbl" }, a.kind === "suggestion" ? "Note" : "Note to the agent"), comment, h("div", { class: "row" }, editor.isNew ? null : h("button", { class: "btn ghost danger", onclick: () => deleteAnnotation(a.id) }, "Delete"), h("span", { class: "grow" }), h("button", { class: "btn ghost", onclick: closeEditor }, "Cancel", h("kbd", {}, "Esc")), h("button", { class: "btn primary", onclick: saveEditor }, "Save note", h("kbd", {}, "⌘↵")))));
  }
  function placeNear(el, anchor, prefer) {
    el.style.visibility = "hidden";
    el.style.top = "0px";
    el.style.left = "0px";
    document.body.append(el);
    const w = el.offsetWidth;
    const ht = el.offsetHeight;
    const m = 8;
    const above = anchor.top - ht - 6;
    const below = anchor.bottom + 6;
    let top = prefer === "above" ? above : below;
    if (prefer === "above" && above < m)
      top = below;
    if (prefer === "below" && below + ht > window.innerHeight - m)
      top = above >= m ? above : below;
    top = Math.max(m, Math.min(top, window.innerHeight - ht - m));
    const left = Math.max(m, Math.min(anchor.left, window.innerWidth - w - m));
    el.style.top = \`\${top}px\`;
    el.style.left = \`\${left}px\`;
    el.style.visibility = "";
  }
  var toolbarEl = null;
  function hideToolbar() {
    toolbarEl?.remove();
    toolbarEl = null;
  }
  function showToolbar() {
    hideToolbar();
    if (editor || S.ended)
      return;
    const p = selectionTarget();
    const sel = window.getSelection();
    if (!p || !sel || sel.rangeCount === 0)
      return;
    const rects = sel.getRangeAt(0).getClientRects();
    const rect = rects[0] ?? sel.getRangeAt(0).getBoundingClientRect();
    toolbarEl = h("div", { class: "toolbar", role: "toolbar", "aria-label": "Add a note" }, ANN_KEYS.map(([k, key, label]) => h("button", {
      class: \`tb k-\${k}\`,
      tip: ANN_TIP[k],
      onmousedown: (e) => e.preventDefault(),
      onclick: () => openEditor(k)
    }, label, h("kbd", {}, key))));
    placeNear(toolbarEl, rect, "above");
  }
  var peekEl = null;
  var peekTimer;
  function hoverPeek(el, build) {
    const show = (delay) => {
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => {
        const body = build();
        if (!body)
          return;
        hidePeek();
        peekEl = body;
        peekEl.addEventListener("mouseenter", () => clearTimeout(peekTimer));
        peekEl.addEventListener("mouseleave", hidePeek);
        placeNear(peekEl, el.getBoundingClientRect(), "below");
      }, delay);
    };
    const hide = () => {
      clearTimeout(peekTimer);
      peekTimer = setTimeout(hidePeek, 200);
    };
    el.addEventListener("mouseenter", () => show(350));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("focus", () => show(150));
    el.addEventListener("blur", hide);
  }
  function refLink(r, label, cls = "") {
    const el = h("button", { class: \`ref \${cls}\`, onclick: () => showBeside(r) }, label, icon("ext"));
    hoverPeek(el, () => filePeek(r));
    return el;
  }
  function hidePeek() {
    peekEl?.remove();
    peekEl = null;
  }
  function filePeek(r) {
    const text = fileText(r.path);
    if (text === undefined)
      return null;
    const range = refRange(r, text);
    const at = range ? lineOf(text, range.start) : 1;
    const to = range ? lineOf(text, range.end) : 14;
    const body = codeView(text, langOf(r.path), {
      extra: range ? [{ ...range, cls: "focus" }] : [],
      lines: { start: Math.max(1, at - 3), end: Math.min(to + 3, at + 30) },
      compact: true
    });
    return h("div", { class: "peek" }, h("div", { class: "peek-head mono" }, r.path), body);
  }
  function mdSummary(text) {
    const out = {};
    const h1 = /^#{1,3}\\s+(.+)$/m.exec(text);
    if (h1)
      out.title = clean(h1[1]);
    const st = /\\*\\*Status:\\*\\*\\s*\`?([^·\\n\`*]+)/.exec(text);
    if (st)
      out.status = st[1].trim().replace(/[.,]$/, "");
    for (const para of text.split(/\\n\\s*\\n/)) {
      const t = para.trim();
      if (!t || /^#|^\\||^\`\`\`|^\\s*>?\\s*\\*\\*Status/.test(t))
        continue;
      const plain = clean(t.replace(/^>\\s?/gm, "").replace(/^-\\s+\\*\\*[^*]+:\\*\\*\\s*/, ""));
      if (plain.length < 12)
        continue;
      const sentence = /^(.{20,}?[.!?])(\\s|$)/.exec(plain)?.[1] ?? plain;
      out.summary = sentence.length > 240 ? \`\${sentence.slice(0, 237)}…\` : sentence;
      break;
    }
    return out;
  }
  function clean(t) {
    return t.replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, "$1").replace(/[\`*_]/g, "").replace(/\\s+/g, " ").trim();
  }
  function sfBlock(path, sfId) {
    const text = fileText(path) ?? "";
    const n = sfId.replace(/^(?:IF|SF)-/, "");
    const at = text.search(new RegExp(\`^#{2,3}\\\\s+(?:IF|SF)-\${n}\\\\b\`, "m"));
    if (at < 0)
      return "";
    const rest = text.slice(at);
    const next = rest.slice(3).search(/^#{1,3}\\s/m);
    return next < 0 ? rest : rest.slice(0, next + 3);
  }
  function resolveLink(link) {
    const [kind, rest = ""] = [link.slice(0, link.indexOf(":")), link.slice(link.indexOf(":") + 1)];
    if (kind === "if") {
      const row = (S.packet.ledger ?? []).find((r) => r.id === rest);
      const i = items().findIndex((x) => x.id === rest);
      const it = items()[i];
      const sfId = rest.split("/").pop();
      const path2 = row?.source.path ?? it?.source.path;
      const friction = it?.sections.find((x) => x.key === "friction")?.text;
      const block = path2 ? sfBlock(path2, sfId) : "";
      const t2 = { label: shortId(rest), title: row?.title ?? it?.title ?? sfId };
      const status = row?.status ?? it?.status;
      if (status)
        t2.status = status;
      const sum2 = mdSummary(friction ?? block.replace(/^#.*\\n/, ""));
      if (sum2.summary)
        t2.summary = sum2.summary;
      if (i >= 0)
        t2.item = i;
      if (path2)
        t2.focus = {
          path: path2,
          lines: {
            start: row?.source.line ?? it?.source.line ?? 1,
            end: row?.source.line ?? it?.source.line ?? 1
          }
        };
      return t2;
    }
    const path = kind === "entry" ? \`\${IDX.entries.get(rest)}/README.md\` : kind === "adr" ? IDX.adrs.get(rest) : kind === "file" ? rest : undefined;
    if (!path || fileText(path) === undefined)
      return null;
    const sum = mdSummary(fileText(path) ?? "");
    const t = {
      label: kind === "adr" ? \`ADR \${rest}\` : kind === "entry" ? \`Design entry \${rest}\` : path,
      focus: { path }
    };
    if (sum.title)
      t.title = sum.title;
    if (sum.status)
      t.status = sum.status;
    if (sum.summary)
      t.summary = sum.summary;
    return t;
  }
  function linkCard(link) {
    const t = resolveLink(link);
    if (!t)
      return null;
    return h("div", { class: "peek card-peek" }, h("div", { class: "cp-head" }, h("span", { class: "mono" }, t.label), t.status ? h("span", { class: \`tag st-\${t.status.split(" ")[0]}\` }, t.status) : null), t.title ? h("div", { class: "cp-title" }, t.title) : null, t.summary ? h("div", { class: "cp-sum" }, t.summary) : null, h("div", { class: "cp-hint" }, t.item !== undefined ? "Click to open this item" : "Click to open"));
  }
  function followLink(link) {
    const t = resolveLink(link);
    if (!t)
      return;
    hidePeek();
    if (t.item !== undefined)
      select(t.item);
    else if (t.focus)
      showBeside(t.focus);
  }
  var tipEl = null;
  var tipTimer;
  var tipFor = null;
  function hideTip() {
    clearTimeout(tipTimer);
    tipEl?.remove();
    tipEl = null;
    tipFor = null;
  }
  function initTips() {
    const showFor = (el, delay) => {
      if (tipFor === el)
        return;
      hideTip();
      tipFor = el;
      tipTimer = setTimeout(() => {
        if (!el.isConnected)
          return;
        tipEl = h("div", { class: "tip", role: "tooltip", id: "tip" }, el.dataset.tip ?? "");
        el.setAttribute("aria-describedby", "tip");
        placeNear(tipEl, el.getBoundingClientRect(), "below");
      }, delay);
    };
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest?.("[data-tip]");
      if (el)
        showFor(el, 700);
    });
    document.addEventListener("mouseout", (e) => {
      const el = e.target.closest?.("[data-tip]");
      if (el && !el.contains(e.relatedTarget))
        hideTip();
    });
    document.addEventListener("focusin", (e) => {
      const el = e.target.closest?.("[data-tip]");
      if (el?.matches(":focus-visible"))
        showFor(el, 150);
    });
    for (const ev of ["focusout", "mousedown", "keydown", "scroll"]) {
      document.addEventListener(ev, hideTip, true);
    }
  }
  function showBeside(r) {
    hidePeek();
    if (S.view === "queue") {
      S.side = r.path;
      S.focus = r;
    } else {
      S.view = "files";
      S.file = r.path;
      S.focus = r;
      revealDir(r.path);
    }
    scrollWanted = true;
    render();
  }
  var TABS = [
    ["home", "Home", "1"],
    ["queue", "Queue", "2"],
    ["files", "Files", "3"],
    ["dashboard", "Dashboard", "4"],
    ["submit", "Review & submit", "5"]
  ];
  function header() {
    const p = S.packet;
    const ruled = S.review.verdicts.length;
    const total = items().length;
    const sub = p.mode === "branch" && p.change ? \`\${p.change.head.ref} → \${p.change.base.ref} · \${p.change.head.sha.slice(0, 7)}\` : p.repo.ref ?? p.repo.name;
    const theme = allThemes().find((t) => t.id === S.theme);
    return h("header", { class: "top" }, h("button", { class: "brand", onclick: () => go("home"), tip: "Back to the home page (1)" }, h("div", { class: "title" }, p.title), h("div", { class: "sub" }, h("span", { class: \`mode m-\${p.mode}\` }, p.mode === "branch" ? "Branch review" : "Main"), " ", sub, p.iteration && p.iteration > 1 ? \` · iteration \${p.iteration}\` : "")), h("nav", { class: "tabs", "aria-label": "Views" }, TABS.map(([v, label, key]) => h("button", { class: \`tab \${S.view === v ? "on" : ""}\`, onclick: () => go(v), tip: VIEW_TIP[v] }, label, h("kbd", {}, key)))), h("div", { class: "status" }, h("div", { class: "meter", tip: \`\${ruled} of \${total} items have your ruling\` }, h("div", { class: "track" }, h("div", { class: "bar", style: \`width:\${total ? 100 * ruled / total : 0}%\` })), h("span", {}, \`\${ruled}/\${total}\`)), h("span", { id: "save-state", class: \`save \${S.saved}\` }), h("button", {
      class: \`btn ghost sm \${S.drawer ? "on" : ""}\`,
      tip: "This session — every ruling and note so far; jump back to any of them, edit or remove them (p)",
      onclick: toggleDrawer
    }, "Session", h("span", { id: "session-count", class: "count" }, "0")), h("button", {
      class: \`btn ghost sm theme-btn \${S.picker ? "on" : ""}\`,
      tip: "Theme — choose the colours, or add your own (t)",
      onclick: () => {
        S.picker = !S.picker;
        render();
      }
    }, h("span", { class: "swatch", style: theme ? swatchStyle(theme) : "" }), theme?.name ?? "Theme")));
  }
  var THEME_DOCS = "https://github.com/crumley/intent-architecture/blob/main/.agents/skills/intent-architecture/references/review-themes.md";
  var allThemes = () => [...THEMES, ...S?.customThemes ?? []];
  function swatchStyle(t) {
    const c = t.colors;
    return \`background:conic-gradient(\${c.accent} 0 25%, \${c.heading} 0 50%, \${c.xref} 0 75%, \${c.surface} 0)\`;
  }
  function injectThemes(list) {
    let el = document.getElementById("theme-css");
    if (!el) {
      el = document.createElement("style");
      el.id = "theme-css";
      document.head.append(el);
    }
    el.textContent = list.map(themeCss).join(\`
\`);
  }
  function applyTheme(id, save = true) {
    document.documentElement.dataset.theme = id;
    if (S)
      S.theme = id;
    if (save)
      api("PUT", "/api/prefs", { theme: id }).catch(() => {
        return;
      });
  }
  function themePicker() {
    if (!S.picker)
      return null;
    const option = (t) => h("button", {
      class: \`theme-opt \${t.id === S.theme ? "on" : ""}\`,
      role: "menuitemradio",
      "aria-checked": t.id === S.theme ? "true" : "false",
      onclick: () => {
        applyTheme(t.id);
        render();
      }
    }, h("span", { class: "swatch big", style: swatchStyle(t) }), h("span", { class: "theme-name" }, t.name), h("span", { class: "muted small" }, t.dark ? "dark" : "light"));
    return h("div", { class: "picker", role: "menu", "aria-label": "Themes" }, h("div", { class: "eyebrow" }, "Themes"), THEMES.map(option), S.customThemes.length ? [h("div", { class: "eyebrow" }, "Yours"), S.customThemes.map(option)] : null, h("div", { class: "picker-foot small" }, "Make your own: a small JSON file naming a base theme and the colours to change, placed in ", h("span", { class: "mono" }, S.themeDir ?? "~/.config/intent-review/themes"), " or passed with ", h("span", { class: "mono" }, "--theme"), ". ", h("a", { href: THEME_DOCS, target: "_blank", rel: "noopener noreferrer" }, "How to write a theme ↗")));
  }
  function loadFolds() {
    try {
      return JSON.parse(sessionStorage.getItem("intent-review-folds") ?? "{}");
    } catch {
      return {};
    }
  }
  function saveFolds() {
    try {
      sessionStorage.setItem("intent-review-folds", JSON.stringify(S.folds));
    } catch {}
  }
  function homeView() {
    const p = S.packet;
    const its = items();
    const count = (f) => its.filter(f).length;
    const firstOf = (f) => {
      const order = displayOrder();
      const i = order.find((n) => f(its[n]) && !verdictOf(its[n].id)) ?? order.find((n) => f(its[n]));
      return i;
    };
    const asks = [
      [
        "Intent feedback to rule on",
        "IFs — intent-feedback items: frictions a build found in the intent, each with a proposed revision.",
        (i) => isIntentFeedback(i.kind) && i.status !== "ruled"
      ],
      [
        "Rulings awaiting their wording",
        "Already ruled; confirm the words that land the ruling in the intent.",
        (i) => isIntentFeedback(i.kind) && i.status === "ruled"
      ],
      [
        "Open questions",
        "Cross-cutting questions the intent tracks as unresolved.",
        (i) => i.kind === "question"
      ],
      [
        "Decisions still proposed",
        "Design decisions (ADRs) nobody has taken yet.",
        (i) => i.kind === "decision"
      ],
      [
        "Intent changes",
        "Edits this branch makes to the intent itself.",
        (i) => i.kind === "intent-change"
      ],
      [
        "Design entries",
        "Design entries this branch adds or changes.",
        (i) => i.kind === "design-entry"
      ],
      [
        "Findings",
        "Things an agent noticed that need your judgment.",
        (i) => !isIntentFeedback(i.kind) && !["question", "decision", "intent-change", "design-entry"].includes(i.kind)
      ]
    ];
    const ruled = S.review.verdicts.length;
    const next = displayOrder().find((n) => !verdictOf(its[n].id));
    const intro = p.mode === "branch" && p.change ? p.change.summary : p.intro;
    return h("main", { class: "page home", "data-scroll": "home" }, h("div", { class: "page-inner narrow" }, h("div", { class: "eyebrow" }, p.mode === "branch" ? "Branch review" : "Review of the main line"), h("h1", { class: "home-title" }, p.title), h("p", { class: "lead" }, p.mode === "branch" && p.change ? \`What \${p.change.head.ref} does to the intent and design, measured against \${p.change.base.ref} — so you can decide before it merges. Rule on each change, then give the branch an overall verdict.\` : "Everything in this repository that is waiting on a human decision: rule on each item, note anything you see along the way, then hand it back. An agent prepared this and carries out what you decide."), intro || p.change?.recommendation ? h("div", { class: "rec-card" }, h("div", { class: "rec-head" }, h("span", { class: "eyebrow" }, "The agent’s overview"), p.change?.recommendation ? h("span", { class: \`vchip big o-\${p.change.recommendation.verdict}\` }, p.change.recommendation.verdict) : null), intro ? plainProse(intro, {}) : null, p.change?.recommendation ? h("p", { class: "rec-why" }, p.change.recommendation.why) : null) : null, h("h2", {}, "What you are asked to do"), h("div", { class: "asks" }, asks.filter(([, , f]) => count(f) > 0).map(([label, desc, f]) => {
      const n = count(f);
      const done = its.filter((i) => f(i) && verdictOf(i.id)).length;
      const first = firstOf(f);
      return h("button", { class: "ask", onclick: () => first !== undefined && select(first) }, h("span", { class: "ask-n" }, String(n)), h("span", { class: "ask-body" }, h("strong", {}, label), h("span", { class: "muted small" }, desc)), h("span", { class: "ask-done small muted" }, done ? \`\${done} ruled\` : ""));
    }), p.mode === "branch" ? h("button", { class: "ask", onclick: () => go("submit") }, h("span", { class: "ask-n" }, "1"), h("span", { class: "ask-body" }, h("strong", {}, "Overall verdict"), h("span", { class: "muted small" }, "Approve, request changes, or comment — given on Review & submit.")), h("span", { class: "ask-done small muted" }, S.review.overall ? S.review.overall.verdict : "")) : null), h("div", { class: "row cta" }, h("button", {
      class: "btn primary big",
      onclick: () => next !== undefined ? select(next) : go("submit")
    }, ruled === 0 ? "Start reviewing →" : next !== undefined ? "Continue reviewing →" : "Review & submit →"), h("span", { class: "muted small" }, \`\${ruled} of \${its.length} ruled · \${S.review.annotations.length} notes · your work saves as you go\`)), h("h2", {}, "How to go through it"), h("ol", { class: "steps" }, h("li", {}, h("strong", {}, "Work the queue. "), "Each item opens with the agent’s recommendation and summary, then the proposed change. Supporting detail — the friction, the assumption, the slice — is folded away until you want it. The intent the item touches is shown beside it."), h("li", {}, h("strong", {}, "Rule at the foot of the item. "), "The consequences of each choice sit above the five rulings. Hover any ruling to see exactly what it asks of the agent."), h("li", {}, h("strong", {}, "Note anything, anywhere. "), "Select text — in an item, in the intent, in code — and a small toolbar offers five kinds of note."), h("li", {}, h("strong", {}, "Follow the identifiers. "), "IF numbers (and older SF numbers), entry numbers like 0031, ADRs, and file paths are links: hover to peek, click to go."), h("li", {}, h("strong", {}, "Hand it back. "), "On Review & submit, check the list and submit. The agent carries everything out and may come back with a smaller packet.")), h("h2", {}, "The views"), h("div", { class: "cards3" }, TABS.filter(([v]) => v !== "home").map(([v, label, key]) => h("button", { class: "card view-card", onclick: () => go(v) }, h("div", { class: "row" }, h("strong", {}, label), h("kbd", {}, key)), h("p", { class: "small muted" }, VIEW_TIP[v].replace(/^[^—]+— /, ""))))), h("h2", {}, "Your rulings"), h("dl", { class: "defs" }, VERDICT_KEYS.map(([k, key]) => [
      h("dt", {}, h("span", { class: \`vchip v-\${k}\` }, k), h("kbd", {}, key)),
      h("dd", {}, VERDICT_TIP[k].replace(/^[^—]+— /, ""))
    ])), h("h2", {}, "Kinds of note"), h("dl", { class: "defs" }, ANN_KEYS.map(([k, key, label]) => [
      h("dt", {}, h("span", { class: \`pill k-\${k}\` }, label), h("kbd", {}, key)),
      h("dd", {}, ANN_TIP[k].replace(/^[^—]+— /, ""))
    ])), h("h2", {}, "Keyboard"), keysTable()));
  }
  function keysTable() {
    const rows = [
      ["1 2 3 4 5", "Home · queue · files · dashboard · review & submit"],
      ["j k", "Next / previous item (or file)"],
      ["n", "Next unreviewed item"],
      ["a m d f r", "Accept · amend · decline · defer · revise"],
      ["u", "Clear the ruling"],
      ["c q s i x", "Comment · question · suggest · intent here · mismatch — on selected text"],
      ["p", "This session: every ruling and note"],
      ["v", "Markdown as prose / as source"],
      ["/", "Filter files"],
      ["t", "Themes"],
      ["?", "This list"],
      ["⌘↵ Esc", "Confirm / leave a text field"]
    ];
    return h("table", { class: "keys" }, h("tbody", {}, rows.map(([k, d]) => h("tr", {}, h("td", {}, k.split(" ").map((x) => h("kbd", {}, x))), h("td", {}, d)))));
  }
  function toggleDrawer() {
    S.drawer = !S.drawer;
    render();
  }
  function drawer() {
    if (!S.drawer)
      return null;
    const rulings = S.review.verdicts;
    const groups = new Map;
    for (const a of S.review.annotations) {
      const key = a.target.kind === "file" ? a.target.path : \`item:\${a.target.item}\`;
      groups.set(key, [...groups.get(key) ?? [], a]);
    }
    const clip = (s, n) => s.length > n ? \`\${s.slice(0, n)}…\` : s;
    return h("aside", { class: "drawer", "aria-label": "This session" }, h("div", { class: "drawer-head" }, h("div", {}, h("div", { class: "title" }, "This session"), h("div", { class: "sub" }, \`\${rulings.length} rulings · \${S.review.annotations.length} notes\`)), h("button", { class: "icon-btn", title: "Close (p)", onclick: toggleDrawer }, "×")), h("div", { class: "drawer-body", "data-scroll": "drawer" }, h("h3", {}, "Rulings"), rulings.length === 0 ? h("p", { class: "muted small" }, "None yet. Rule on an item with a, m, d, f, or r.") : null, rulings.map((v) => {
      const it = itemById(v.item);
      const words = v.wording ?? v.why ?? v.ruling ?? v.request ?? "";
      return h("div", { class: "entry" }, h("button", {
        class: "entry-main",
        onclick: () => select(items().findIndex((x) => x.id === v.item))
      }, h("span", { class: \`vchip v-\${v.verdict}\` }, it ? verdictLabel(it, v.verdict) : v.verdict), h("span", { class: "entry-title" }, it?.title ?? v.item), words ? h("span", { class: "entry-words" }, clip(words, 120)) : null), h("button", {
        class: "icon-btn sm",
        title: "Remove this ruling",
        onclick: () => {
          setVerdict(v.item, null);
          render();
        }
      }, "×"));
    }), h("h3", {}, "Notes"), S.review.annotations.length === 0 ? h("p", { class: "muted small" }, "Select text anywhere and press c, q, s, i, or x.") : null, [...groups.entries()].map(([key, list]) => h("div", { class: "group" }, h("div", { class: "group-head mono" }, key.startsWith("item:") ? shortId(key.slice(5)) : key), list.map((a) => h("div", { class: "entry" }, h("button", { class: "entry-main", onclick: () => jumpTo(a) }, h("span", { class: \`pill k-\${a.kind}\` }, a.kind), h("span", { class: "entry-quote" }, clip(a.selector.exact, 90)), a.comment ? h("span", { class: "entry-words" }, a.comment) : null), h("button", { class: "icon-btn sm", title: "Edit", onclick: () => editAnnotation(a.id) }, "✎"), h("button", { class: "icon-btn sm", title: "Delete", onclick: () => deleteAnnotation(a.id) }, "×")))))), h("div", { class: "drawer-foot" }, h("button", { class: "btn primary block", onclick: () => go("submit") }, "Review & submit →")));
  }
  function jumpTo(a) {
    if (a.target.kind === "file") {
      const path = a.target.path;
      if (a.item && itemById(a.item)) {
        S.view = "queue";
        S.current = items().findIndex((i) => i.id === a.item);
        S.side = path;
      } else {
        S.view = "files";
        S.file = path;
        revealDir(path);
      }
      S.focus = { path, quote: a.selector.exact };
    } else {
      const target = a.target;
      S.view = "queue";
      S.current = Math.max(0, items().findIndex((i) => i.id === target.item));
    }
    scrollWanted = true;
    render();
  }
  var GROUPS = [
    ["judgment", "Needs your judgment"],
    ["none", "To review"],
    ["routine", "Routine"]
  ];
  function displayOrder() {
    const idx = items().map((_, i) => i);
    if (S.packet.mode !== "branch")
      return idx;
    return GROUPS.flatMap(([g]) => idx.filter((i) => (items()[i]?.attention ?? "none") === g));
  }
  function step(d) {
    const order = displayOrder();
    const next = order[Math.min(Math.max(order.indexOf(S.current) + d, 0), order.length - 1)];
    if (next !== undefined)
      select(next);
  }
  function queueRow(it, i) {
    const v = verdictOf(it.id);
    const notes = annotationsForItem(it.id).length;
    return h("button", { class: \`qi \${i === S.current ? "on" : ""} \${v ? "done" : ""}\`, onclick: () => select(i) }, h("span", { class: \`dot v-\${v?.verdict ?? "none"}\` }), h("span", { class: "qbody" }, h("span", { class: "qmeta" }, h("span", { class: "mono" }, shortId(it.id)), it.status === "ruled" ? h("span", { class: "tag ruled" }, "ruled") : null, !isIntentFeedback(it.kind) ? h("span", { class: "tag" }, kindLabel(it)) : null), h("span", { class: "qt" }, it.title)), h("span", { class: "qside" }, v ? h("span", { class: \`vchip v-\${v.verdict}\` }, verdictLabel(it, v.verdict)) : null, notes ? h("span", { class: "badge", title: \`\${notes} notes\` }, String(notes)) : null));
  }
  function queueNav() {
    const order = displayOrder();
    const list = S.packet.mode === "branch" ? GROUPS.map(([g, label]) => {
      const m = order.filter((i) => (items()[i]?.attention ?? "none") === g);
      if (!m.length)
        return null;
      return [
        h("div", { class: "nav-group" }, label, h("span", { class: "muted" }, \` · \${m.length}\`)),
        m.map((i) => queueRow(items()[i], i))
      ];
    }) : order.map((i) => queueRow(items()[i], i));
    return h("aside", { class: "nav", "data-scroll": "nav", "aria-label": "Items" }, h("button", { class: "nav-home small", onclick: () => go("home"), tip: VIEW_TIP.home }, "← What this review is about"), items().length === 0 ? h("p", { class: "muted pad" }, "Nothing to review in this packet.") : null, list);
  }
  function queueView() {
    const it = currentItem();
    return h("div", { class: "layout queue" }, queueNav(), it ? itemDetail(it) : h("main", { class: "center" }, h("div", { class: "doc muted" }, "No item selected.")), it ? sidePane(it) : null);
  }
  var FOLDED_BY_DEFAULT = new Set([
    "slice",
    "friction",
    "assumption",
    "revision",
    "entry-context",
    "notes"
  ]);
  function itemDetail(it) {
    const v = verdictOf(it.id);
    const a = it.analysis;
    const rec = a?.recommendation;
    const sections = it.sections.filter((s) => s.key !== "on-branch");
    const onBranch = it.sections.find((s) => s.key === "on-branch");
    const notes = annotationsForItem(it.id);
    const ctx = itemCtx(it);
    const sourceRef = { path: it.source.path, lines: { start: it.source.line, end: it.source.line } };
    const doc = h("div", { class: "doc" }, h("div", { class: "eyebrow-row" }, h("span", { class: "tag strong" }, kindLabel(it)), it.category ? h("span", { class: "tag" }, it.category) : null, it.status ? h("span", { class: \`tag st-\${it.status}\` }, it.status) : null, it.attention ? h("span", { class: \`tag at-\${it.attention}\` }, it.attention === "judgment" ? "needs judgment" : "routine") : null, h("span", { class: "grow" }), fileText(it.source.path) !== undefined ? refLink(sourceRef, \`\${it.source.path}:\${it.source.line}\`, "quiet") : h("span", { class: "mono small muted" }, \`\${it.source.path}:\${it.source.line}\`)), h("h1", { class: "item-title" }, linked(it.title, ctx)), onBranch ? h("div", { class: "callout info" }, linked(onBranch.text, ctx)) : null, it.statusLine && (it.status === "ruled" || it.baseStatusLine !== undefined) ? h("div", { class: "callout warn" }, h("strong", {}, "Status "), linked(it.statusLine, ctx)) : null, it.baseStatusLine ? h("div", { class: "callout" }, h("strong", {}, "At base "), linked(it.baseStatusLine, ctx)) : null, rec || a?.summary ? h("div", { class: \`rec-card \${rec ? \`r-\${rec.verdict}\` : ""}\` }, h("div", { class: "rec-head" }, h("span", { class: "eyebrow" }, rec ? "Agent recommends" : "Agent’s summary"), rec ? h("span", {
      class: \`vchip big v-\${rec.verdict}\`,
      tip: (isChange(it) ? CHANGE_TIP : VERDICT_TIP)[rec.verdict]
    }, capitalize(verdictLabel(it, rec.verdict))) : null), rec ? h("p", { class: "rec-why" }, linked(rec.why, ctx)) : null, a?.summary ? plainProse(a.summary, ctx) : null) : null, it.proposal ? proposalSection(it) : null, it.changes?.length ? h("section", { class: "sec" }, h("h2", {}, "Changes on this branch"), it.changes.map((c) => collapsible(h("span", { class: "row" }, h("span", { class: \`tag ch-\${c.status}\` }, c.status), h("span", { class: "mono small" }, c.oldPath ? \`\${c.oldPath} → \${c.path}\` : c.path)), c.status === "added" && langOf(c.path) === "markdown" && fileText(c.path) !== undefined ? h("div", { class: "added-doc" }, fileView(c.path)) : patchView(c), c.patch.split(\`
\`).length < 160, 0, \`change:\${c.path}\`))) : null, a?.relations?.length ? h("section", { class: "sec" }, h("h2", {}, "Related items"), h("ul", { class: "rel" }, a.relations.map((r) => h("li", {}, h("button", {
      class: "ref",
      onclick: () => select(items().findIndex((x) => x.id === r.item))
    }, shortId(r.item)), h("span", {}, linked(r.note, ctx)))))) : null, !a && !isChange(it) ? h("p", { class: "muted small sec" }, "The packet carries no analysis for this item.") : null, it.evidence.length ? collapsible(isIntentFeedback(it.kind) || it.kind === "question" ? "The intent in question" : "Evidence", h("div", {}, it.evidence.map((r) => {
      const text = fileText(r.path);
      const missing = r.quote && text !== undefined && !text.includes(r.quote);
      return h("div", { class: "evidence" }, h("div", { class: "ev-head" }, refLink(r, refLabel(r)), r.section ? h("span", { class: "muted small" }, \`§ \${r.section}\`) : null, missing ? h("span", { class: "warn small" }, "quote not found in the snapshot") : null), r.note ? h("p", { class: "small muted" }, linked(r.note, ctx)) : null, excerpt(r));
    })), true, 0, "evidence") : null, sections.length ? h("div", { class: "supporting" }, h("div", { class: "eyebrow" }, isIntentFeedback(it.kind) ? "The intent feedback as written" : "Detail"), sections.map((s) => collapsible(s.label, itemText(it, s.key, s.text), !FOLDED_BY_DEFAULT.has(s.key), annotationsOn({ kind: "item", item: it.id, section: s.key }).length, \`sec:\${s.key}\`))) : null, notes.length ? collapsible(\`Your notes on this item · \${notes.length}\`, noteList(notes), true, 0, "item-notes") : h("p", { class: "hint" }, "Select any text — here, in an excerpt, or in the file beside — to leave a note. Hover a note kind to see what it asks of the agent."));
    return h("main", { class: "center", "data-scroll": \`detail:\${it.id}\` }, doc, rulingBar(it, v));
  }
  function proposalSection(it) {
    const pr = it.proposal;
    const ctx = itemCtx(it);
    return h("section", { class: "sec" }, h("h2", {}, "Proposed edit"), pr.summary ? h("p", { class: "lead" }, linked(pr.summary, ctx)) : null, pr.edits.map((e) => {
      const text = fileText(e.path) ?? "";
      const at = text.indexOf(e.before);
      return h("div", { class: "edit" }, h("div", { class: "ev-head" }, refLink({ path: e.path, quote: e.before }, at >= 0 ? \`\${e.path}:\${lineOf(text, at)}\` : e.path), at < 0 ? h("span", { class: "warn small" }, "the “before” text is not in the snapshot") : null), wordDiff(e.before, e.after));
    }));
  }
  function collapsible(title, body, open, count = 0, key) {
    const isOpen = key !== undefined && key in S.folds ? S.folds[key] : open;
    const el = h("details", { class: "sec fold", open: isOpen ? true : undefined }, h("summary", {}, icon("chev"), typeof title === "string" ? h("span", { class: "h2" }, title) : title, count ? h("span", { class: "badge" }, String(count)) : null), body);
    if (key !== undefined) {
      el.addEventListener("toggle", () => {
        S.folds[key] = el.open;
        saveFolds();
      });
    }
    return el;
  }
  function noteList(list) {
    return h("div", { class: "notes" }, list.map((a) => {
      const q = a.selector.exact;
      return h("div", { class: \`note k-\${a.kind}\` }, h("div", { class: "row" }, h("span", { class: \`pill k-\${a.kind}\` }, a.kind), h("button", { class: "ref quiet", onclick: () => jumpTo(a) }, targetLabel(a)), h("span", { class: "grow" }), h("button", { class: "btn ghost sm", onclick: () => editAnnotation(a.id) }, "Edit")), h("div", { class: "note-quote" }, q.length > 280 ? \`\${q.slice(0, 280)}…\` : q), a.kind === "suggestion" ? wordDiff(q, a.suggestion ?? "") : null, a.comment ? h("p", {}, a.comment) : null);
    }));
  }
  var VERDICT_KEYS = [
    ["accept", "a"],
    ["amend", "m"],
    ["decline", "d"],
    ["defer", "f"],
    ["revise", "r"]
  ];
  function fieldCopy(it, field) {
    const change = isChange(it);
    switch (field) {
      case "wording":
        return {
          label: change ? "Your wording — the agent applies it on the branch" : "Your wording for the intent edit",
          placeholder: "What the text should say…"
        };
      case "why":
        return {
          label: change ? "Why reject — the agent reverts or reworks it" : "Why — one line; it becomes the declined disposition",
          placeholder: change ? "What is wrong with this change…" : "Why no intent change…"
        };
      case "ruling":
        return {
          label: "Ruling to record now (optional — leave empty to simply wait)",
          placeholder: "The ruling, applied by a later intent edit…"
        };
      default:
        return {
          label: "What should change in the proposal or analysis",
          placeholder: "Rework it so that…"
        };
    }
  }
  function rulingBar(it, v) {
    const field = v ? v.verdict === "defer" ? "ruling" : REQUIRED_WORDS[v.verdict] : null;
    const blur = () => document.activeElement?.blur();
    const a = it.analysis;
    const ctx = itemCtx(it);
    const tips = isChange(it) ? CHANGE_TIP : VERDICT_TIP;
    let words = null;
    if (v && field) {
      const copy = fieldCopy(it, field);
      words = h("textarea", {
        id: "verdict-words",
        class: \`field \${field === "wording" ? "mono" : ""}\`,
        rows: field === "wording" ? Math.min(8, Math.max(3, (v[field] ?? "").split(\`
\`).length + 1)) : 2,
        placeholder: copy.placeholder,
        "aria-label": copy.label,
        oninput: (e) => {
          v[field] = e.target.value;
          changed();
        },
        onkeydown: fieldKeys(blur, blur)
      });
      words.value = v[field] ?? "";
    }
    const side = v?.verdict === "accept" || v?.verdict === "amend" ? "yes" : v?.verdict === "decline" ? "no" : "";
    const consequence = (which, text) => h("button", {
      class: \`conseq c-\${which} \${side === which ? "picked" : ""}\`,
      tip: "Click to read it in full",
      onclick: (e) => e.currentTarget.classList.toggle("full")
    }, h("span", { class: "eyebrow" }, which === "yes" ? isChange(it) ? "If approved" : "If accepted" : isChange(it) ? "If rejected" : "If declined"), h("span", { class: "conseq-text" }, linked(text, ctx)));
    const hasConseq = Boolean(a?.ifAccepted || a?.ifDeclined);
    return h("div", {
      class: \`ruling \${v ? \`ruled v-\${v.verdict}\` : "unruled"}\`,
      role: "region",
      "aria-label": "Your ruling"
    }, hasConseq ? collapsible("Consequences", h("div", { class: "conseqs" }, a?.ifAccepted ? consequence("yes", a.ifAccepted) : null, a?.ifDeclined ? consequence("no", a.ifDeclined) : null), true, 0, "dock-consequences") : null, h("div", { class: "ruling-head" }, h("span", { class: "ruling-title" }, "Your ruling"), v ? h("span", { class: \`vchip v-\${v.verdict}\` }, \`✓ \${verdictLabel(it, v.verdict)}\`) : h("span", { class: "muted small" }, "not ruled yet"), a?.recommendation && !v ? h("span", { class: "muted small" }, \`· agent recommends \${verdictLabel(it, a.recommendation.verdict)}\`) : null, h("span", { class: "grow" }), v ? h("button", {
      class: "btn ghost sm",
      tip: "Clear this ruling (u)",
      onclick: () => {
        setVerdict(it.id, null);
        render();
      }
    }, "Clear", h("kbd", {}, "u")) : null, h("button", {
      class: "btn ghost sm",
      tip: "Go to the next item without a ruling (n)",
      onclick: nextUnreviewed
    }, "Next", h("kbd", {}, "n"))), h("div", { class: "verdicts" }, VERDICT_KEYS.map(([k, key]) => h("button", {
      class: \`vbtn v-\${k} \${v?.verdict === k ? "on" : ""} \${a?.recommendation?.verdict === k ? "rec" : ""}\`,
      "aria-pressed": v?.verdict === k ? "true" : "false",
      tip: tips[k],
      onclick: () => pickVerdict(it, k)
    }, h("span", { class: "vb-mark" }, v?.verdict === k ? "✓" : ""), h("span", { class: "vb-label" }, capitalize(verdictLabel(it, k))), h("kbd", {}, key)))), words && field ? [h("label", { class: "lbl", for: "verdict-words" }, fieldCopy(it, field).label), words] : null, v ? h("input", {
      class: "field note-field",
      placeholder: "Note to the agent (optional)",
      value: v.note ?? "",
      oninput: (e) => {
        v.note = e.target.value;
        changed();
      },
      onkeydown: fieldKeys(blur, blur)
    }) : null);
  }
  function pickVerdict(it, k) {
    setVerdict(it.id, k);
    render();
    if (k !== "accept")
      setTimeout(() => document.getElementById("verdict-words")?.focus(), 0);
  }
  function nextUnreviewed() {
    const order = displayOrder();
    const pos = Math.max(0, order.indexOf(S.current));
    for (let d = 1;d <= order.length; d++) {
      const i = order[(pos + d) % order.length];
      if (!verdictOf(items()[i].id)) {
        select(i);
        return;
      }
    }
    toast("Every item has a ruling. Press 4 to review and submit.");
  }
  function sideRefs(it) {
    const seen = new Set;
    const out = [];
    const all = [
      ...it.evidence,
      ...it.context ?? [],
      ...it.proposal?.edits.map((e) => ({ path: e.path, quote: e.before })) ?? [],
      ...it.changes?.map((c) => ({ path: c.path })) ?? []
    ];
    for (const r of all) {
      if (seen.has(r.path) || fileText(r.path) === undefined)
        continue;
      seen.add(r.path);
      out.push(r);
    }
    return out;
  }
  function sidePane(it) {
    const refs = sideRefs(it);
    if (S.side && fileText(S.side) === undefined)
      S.side = null;
    if (!S.side) {
      S.side = refs[0]?.path ?? null;
      S.focus = refs[0] ?? null;
    }
    const path = S.side;
    const tabs = !path || refs.some((r) => r.path === path) ? refs : [...refs, { path }];
    return h("aside", { class: "side" }, h("div", { class: "side-tabs" }, tabs.length === 0 ? h("span", { class: "muted small pad" }, "Nothing to show beside this item.") : null, tabs.map((r) => h("button", {
      class: \`stab \${r.path === path ? "on" : ""}\`,
      title: r.path,
      onclick: () => showBeside(r)
    }, r.path.split("/").pop()))), path ? h("div", { class: "side-path" }, h("span", { class: "mono small" }, path), h("span", { class: "grow" }), langOf(path) === "markdown" ? h("button", { class: "btn ghost sm", onclick: toggleRaw }, S.raw ? "Prose" : "Source", h("kbd", {}, "v")) : null, h("button", { class: "btn ghost sm", onclick: () => openFile(path) }, "Open in Files")) : null, path ? h("div", { class: "side-body", "data-scroll": \`side:\${path}\` }, fileView(path, { extra: focusMarks(path) })) : null);
  }
  function focusMarks(path) {
    if (S.focus?.path !== path)
      return [];
    const r = refRange(S.focus, fileText(path) ?? "");
    return r ? [{ ...r, cls: "focus" }] : [];
  }
  function toggleRaw() {
    S.raw = !S.raw;
    scrollWanted = true;
    render();
  }
  function buildTree(paths) {
    const top = { name: "", path: "", dirs: new Map, files: [] };
    for (const p of paths) {
      const parts = p.split("/");
      let node = top;
      for (let i = 0;i < parts.length - 1; i++) {
        const name = parts[i];
        let next = node.dirs.get(name);
        if (!next) {
          next = { name, path: parts.slice(0, i + 1).join("/"), dirs: new Map, files: [] };
          node.dirs.set(name, next);
        }
        node = next;
      }
      node.files.push(p);
    }
    return top;
  }
  function revealDir(path) {
    const parts = path.split("/");
    for (let i = 1;i < parts.length; i++)
      S.openDirs.add(parts.slice(0, i).join("/"));
  }
  function filteredPaths() {
    const q = S.filter.trim().toLowerCase();
    return [...FILES.keys()].filter((p) => !q || p.toLowerCase().includes(q));
  }
  function filesNav() {
    const q = S.filter.trim();
    const paths = filteredPaths();
    const counts = new Map;
    for (const a of S.review.annotations) {
      if (a.target.kind !== "file")
        continue;
      const parts = a.target.path.split("/");
      for (let i = 1;i <= parts.length; i++) {
        const k = parts.slice(0, i).join("/");
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const cited = new Set(items().flatMap((it) => sideRefs(it).map((r) => r.path)));
    const walk = (node, depth) => {
      const out = [];
      for (const d of [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        const open = q !== "" || S.openDirs.has(d.path);
        out.push(h("button", {
          class: \`tn dir \${open ? "open" : ""}\`,
          style: \`--d:\${depth}\`,
          onclick: () => {
            if (S.openDirs.has(d.path))
              S.openDirs.delete(d.path);
            else
              S.openDirs.add(d.path);
            render();
          }
        }, icon("chev"), h("span", { class: "tn-name" }, d.name), counts.get(d.path) ? h("span", { class: "badge" }, String(counts.get(d.path))) : null));
        if (open)
          out.push(...walk(d, depth + 1));
      }
      for (const f of node.files) {
        out.push(h("button", {
          class: \`tn file \${f === S.file ? "on" : ""}\`,
          style: \`--d:\${depth}\`,
          title: f,
          onclick: () => openFile(f)
        }, h("span", { class: \`lang-dot l-\${langOf(f)}\` }), h("span", { class: "tn-name" }, f.split("/").pop()), cited.has(f) ? h("span", { class: "cite", title: "Cited by an item" }) : null, counts.get(f) ? h("span", { class: "badge" }, String(counts.get(f))) : null));
      }
      return out;
    };
    const filter = h("input", {
      id: "file-filter",
      class: "field filter",
      placeholder: "Filter files   /",
      value: S.filter,
      oninput: (e) => {
        const input = e.target;
        S.filter = input.value;
        const pos = input.selectionStart;
        render();
        const el = document.getElementById("file-filter");
        el?.focus();
        if (el && pos !== null)
          el.setSelectionRange(pos, pos);
      },
      onkeydown: (e) => {
        if (e.key === "Escape")
          e.target.blur();
        if (e.key === "Enter" && paths[0])
          openFile(paths[0]);
      }
    });
    const omitted = S.packet.omitted ?? [];
    return h("aside", { class: "nav files-nav", "data-scroll": "files-nav" }, h("div", { class: "filter-wrap" }, filter, h("div", { class: "small muted" }, \`\${paths.length} of \${FILES.size} files\`)), h("div", { class: "tree" }, walk(buildTree(paths), 0)), omitted.length ? h("details", { class: "omitted" }, h("summary", { class: "small muted" }, \`\${omitted.length} not in the snapshot\`), omitted.map((o) => h("div", { class: "small muted mono" }, \`\${o.path} — \${o.reason}\`))) : null);
  }
  function filesView() {
    if (!S.file || !FILES.has(S.file)) {
      const keys = [...FILES.keys()];
      S.file = keys.find((p) => p.startsWith("intent/")) ?? keys[0] ?? null;
      if (S.file)
        revealDir(S.file);
    }
    const path = S.file;
    const notes = path ? annotationsInFile(path) : [];
    const citing = path ? items().filter((it) => sideRefs(it).some((r) => r.path === path)) : [];
    const prose = path !== null && langOf(path) === "markdown" && !S.raw;
    return h("div", { class: "layout files" }, filesNav(), h("main", { class: "center file-center", "data-scroll": \`file:\${path}\` }, path ? h("div", { class: "file-head" }, h("span", { class: "mono" }, path), h("span", { class: "grow" }), langOf(path) === "markdown" ? h("button", { class: "btn ghost sm", onclick: toggleRaw }, S.raw ? "Show as prose" : "Show source", h("kbd", {}, "v")) : h("span", { class: "tag" }, langOf(path))) : null, path ? h("div", { class: prose ? "doc file-doc" : "file-code" }, fileView(path, { extra: focusMarks(path) })) : h("p", { class: "muted pad" }, "The packet carries no files.")), h("aside", { class: "side side-notes" }, h("div", { class: "side-path" }, h("span", { class: "h2" }, "In this file")), h("div", { class: "side-body pad" }, notes.length ? noteList(notes) : h("p", { class: "muted small" }, "No notes yet. Select text and press c, q, s, i (intent here), or x (mismatch)."), citing.length ? [
      h("h3", {}, "Items citing this file"),
      h("ul", { class: "rel" }, citing.map((it) => h("li", {}, h("button", { class: "ref", onclick: () => select(items().indexOf(it)) }, shortId(it.id)), h("span", {}, it.title))))
    ] : null)));
  }
  function openFile(path) {
    S.view = "files";
    S.file = path;
    if (S.focus?.path !== path)
      S.focus = null;
    revealDir(path);
    scrollWanted = true;
    render();
  }
  var STATUSES = ["pending", "ruled", "adjudicated", "declined"];
  function dashboardView() {
    const ledger = S.packet.ledger ?? [];
    const by = (s) => ledger.filter((r) => r.status === s);
    const idCell = (r) => {
      const i = items().findIndex((x) => x.id === r.id);
      const v = i >= 0 ? verdictOf(r.id) : undefined;
      return i >= 0 ? h("button", { class: "ref", onclick: () => select(i) }, shortId(r.id), v ? h("span", { class: \`vchip v-\${v.verdict}\` }, v.verdict) : null) : h("span", { class: "mono small" }, shortId(r.id));
    };
    const slices = new Map;
    for (const r of ledger) {
      for (const s of r.slices.length ? r.slices : ["(no slice cited)"]) {
        slices.set(s, [...slices.get(s) ?? [], r]);
      }
    }
    const matrix = h("table", { class: "matrix" }, h("thead", {}, h("tr", {}, h("th", {}, "Intent slice"), STATUSES.map((s) => h("th", {}, s)))), h("tbody", {}, [...slices.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([slice, rows]) => h("tr", {}, h("td", {}, FILES.has(slice) ? h("button", { class: "ref", onclick: () => openFile(slice) }, slice.replace(/^intent\\//, "")) : h("span", { class: "muted small" }, slice)), STATUSES.map((s) => {
      const rs = rows.filter((r) => r.status === s);
      if (!rs.length)
        return h("td", { class: "num muted" }, "·");
      return h("td", { class: \`num st-\${s}\` }, h("span", { title: rs.map((r) => \`\${shortId(r.id)} — \${r.title}\`).join(\`
\`) }, String(rs.length)));
    })))));
    return h("main", { class: "page", "data-scroll": "dash" }, h("div", { class: "page-inner" }, h("h1", {}, "Intent feedback across the repository"), h("p", { class: "lead" }, "Every intent-feedback item (IF) in every design entry, by where it stands and by the intent slice it questions."), ledger.length === 0 ? h("p", { class: "muted" }, "The packet carries no ledger.") : null, h("div", { class: "cards" }, STATUSES.map((s) => h("div", { class: \`stat st-\${s}\` }, h("div", { class: "n" }, String(by(s).length)), h("div", { class: "l" }, s)))), ledger.length ? [h("h2", {}, "By intent slice"), matrix, h("h2", {}, "By status")] : null, STATUSES.filter((s) => by(s).length).map((s) => collapsible(\`\${capitalize(s)} · \${by(s).length}\`, h("table", { class: "list" }, h("tbody", {}, by(s).map((r) => h("tr", {}, h("td", { class: "nowrap" }, idCell(r)), h("td", {}, linked(r.title, { entry: r.entry, dir: \`design/\${r.entry}\` })), h("td", { class: "mono small muted" }, r.slices.map((x) => x.replace(/^intent\\//, "")).join(", ")))))), s === "pending" || s === "ruled"))));
  }
  var OVERALL_COPY = {
    approve: ["Approve", "Ready to merge as far as intent and design go."],
    "request-changes": ["Request changes", "The agent fixes the branch before it merges."],
    comment: ["Comment only", "Notes, no merge verdict."]
  };
  function textArea(value, rows, placeholder, onInput) {
    const t = h("textarea", {
      class: "field",
      rows,
      placeholder,
      oninput: (e) => onInput(e.target.value)
    });
    t.value = value;
    return t;
  }
  function submitView() {
    const unreviewed = items().filter((it) => !verdictOf(it.id));
    const counts = new Map;
    for (const v of S.review.verdicts)
      counts.set(v.verdict, (counts.get(v.verdict) ?? 0) + 1);
    return h("main", { class: "page", "data-scroll": "submit" }, h("div", { class: "page-inner narrow" }, h("h1", {}, "Review & submit"), h("p", { class: "lead" }, \`\${S.review.verdicts.length} of \${items().length} items ruled · \${S.review.annotations.length} notes. Submitting hands everything to the agent, which carries it out and may come back with a smaller packet.\`), counts.size ? h("div", { class: "cards" }, [...counts.entries()].map(([k, n]) => h("div", { class: \`stat v-\${k}\` }, h("div", { class: "n" }, String(n)), h("div", { class: "l" }, k)))) : null, h("h2", {}, "Rulings"), h("div", { class: "rows" }, items().map((it, i) => {
      const v = verdictOf(it.id);
      const words = v ? v.wording ?? v.why ?? v.ruling ?? v.request ?? "" : "";
      return h("button", { class: \`srow \${v ? "" : "todo"}\`, onclick: () => select(i) }, v ? h("span", { class: \`vchip v-\${v.verdict}\` }, verdictLabel(it, v.verdict)) : h("span", { class: "vchip" }, "unreviewed"), h("span", { class: "srow-title" }, h("span", { class: "mono small muted" }, shortId(it.id)), " ", it.title), words ? h("span", { class: "srow-words" }, words.length > 200 ? \`\${words.slice(0, 200)}…\` : words) : null);
    })), unreviewed.length ? h("p", { class: "muted small" }, \`\${unreviewed.length} unreviewed — they stay as they are and come back next time.\`) : null, h("h2", {}, \`Notes · \${S.review.annotations.length}\`), S.review.annotations.length ? noteList(S.review.annotations) : h("p", { class: "muted small" }, "None."), S.packet.mode === "branch" ? overallPanel() : null, h("h2", {}, "Hand it back"), h("label", { class: "lbl" }, "Reviewer — recorded on rulings"), h("input", {
      class: "field",
      value: S.review.reviewer,
      placeholder: "Your name",
      oninput: (e) => {
        S.review.reviewer = e.target.value;
        changed();
      }
    }), h("label", { class: "lbl" }, "Anything else for the agent (optional)"), textArea(S.review.comment ?? "", 3, "", (v) => {
      S.review.comment = v;
      changed();
    }), S.errors.length ? h("div", { class: "errors" }, h("strong", {}, "Not submitted yet — fix these first:"), h("ul", {}, S.errors.map((e) => h("li", {}, h("span", { class: "mono" }, describePath(e.path)), " — ", e.message)))) : null, h("div", { class: "row submit-row" }, h("button", { class: "btn primary big", onclick: submit }, "Submit — give this back to the agent"), h("span", { class: "grow" }), h("button", { class: "btn ghost danger", onclick: abandon }, "Abandon (keep draft)")), h("p", { class: "small muted" }, \`Draft autosaves to \${S.draftPath}\`)));
  }
  function overallPanel() {
    const c = S.packet.change;
    const cur = S.review.overall;
    return h("section", {}, h("h2", {}, "Overall verdict on the branch"), c?.recommendation ? h("p", { class: "small" }, h("span", { class: \`vchip o-\${c.recommendation.verdict}\` }, \`agent: \${c.recommendation.verdict}\`), " ", c.recommendation.why) : null, h("div", { class: "choices" }, OVERALL.map((o) => h("button", {
      class: \`choice o-\${o} \${cur?.verdict === o ? "on" : ""}\`,
      onclick: () => {
        S.review.overall = { ...S.review.overall ?? {}, verdict: o };
        changed();
        render();
      }
    }, h("strong", {}, OVERALL_COPY[o][0]), h("span", { class: "small muted" }, OVERALL_COPY[o][1])))), cur ? textArea(cur.note ?? "", 3, "Notes for the branch — what to fix, what to say on the review…", (v) => {
      if (S.review.overall)
        S.review.overall.note = v;
      changed();
    }) : null);
  }
  function describePath(path) {
    const v = /^verdicts\\[(\\d+)\\]/.exec(path);
    if (v) {
      const x = S.review.verdicts[Number(v[1])];
      if (x)
        return \`\${shortId(x.item)} (\${x.verdict})\`;
    }
    const a = /^annotations\\[(\\d+)\\]/.exec(path);
    if (a) {
      const x = S.review.annotations[Number(a[1])];
      if (x)
        return \`note \${x.id}\`;
    }
    return path;
  }
  async function submit() {
    clearTimeout(saveTimer);
    const r = await api("POST", "/api/submit", S.review);
    if (r.status === 200) {
      S.ended = \`Submitted. Decisions are in \${r.data.out}; the agent takes it from here. You can close this tab.\`;
    } else {
      S.errors = r.data.errors ?? [{ path: "$", message: \`submit failed (\${r.status})\` }];
    }
    render();
  }
  async function abandon() {
    if (!confirm("Abandon this review? Nothing is submitted; your draft is kept for next time."))
      return;
    clearTimeout(saveTimer);
    await api("PUT", "/api/draft", S.review).catch(() => {
      return;
    });
    await api("POST", "/api/abandon");
    S.ended = \`Abandoned. Nothing was submitted; the draft is kept at \${S.draftPath}.\`;
    render();
  }
  function helpModal() {
    if (!S.help)
      return null;
    return h("div", {
      class: "modal",
      onclick: () => {
        S.help = false;
        render();
      }
    }, h("div", { class: "modal-box" }, h("div", { class: "modal-head" }, h("strong", {}, "Keyboard"), h("span", { class: "muted small" }, "More on the home page (1)")), keysTable()));
  }
  function go(v) {
    S.view = v;
    if (v !== "submit")
      S.errors = [];
    scrollWanted = true;
    render();
  }
  function select(i) {
    if (i < 0 || i >= items().length)
      return;
    S.view = "queue";
    S.current = i;
    S.side = null;
    scrollWanted = true;
    render();
    document.querySelector(".qi.on")?.scrollIntoView({ block: "nearest" });
    document.querySelector("main.center")?.scrollTo(0, 0);
  }
  var scrollWanted = true;
  var scrollMemo = new Map;
  function render() {
    hidePeek();
    hideToolbar();
    for (const el of root.querySelectorAll("[data-scroll]")) {
      scrollMemo.set(el.dataset.scroll, el.scrollTop);
    }
    if (S.ended) {
      root.replaceChildren(h("div", { class: "ended" }, h("div", { class: "ended-mark" }, "✓"), h("h1", {}, "Review ended"), h("p", {}, S.ended)));
      return;
    }
    const body = S.view === "home" ? homeView() : S.view === "queue" ? queueView() : S.view === "files" ? filesView() : S.view === "dashboard" ? dashboardView() : submitView();
    const banner = S.banner ? h("div", { class: "banner" }, h("span", {}, S.banner), h("button", {
      class: "btn ghost sm",
      onclick: () => {
        S.banner = null;
        render();
      }
    }, "Dismiss")) : "";
    root.replaceChildren(header(), banner, h("div", { class: \`main \${S.drawer ? "with-drawer" : ""}\` }, body, drawer() ?? ""), themePicker() ?? "", editorModal() ?? "", helpModal() ?? "");
    paintChrome();
    for (const el of root.querySelectorAll("[data-scroll]")) {
      const top = scrollMemo.get(el.dataset.scroll);
      if (top !== undefined)
        el.scrollTop = top;
    }
    if (scrollWanted) {
      scrollWanted = false;
      scrollToFocus();
    }
  }
  function scrollToFocus() {
    const pane = document.querySelector(S.view === "files" ? ".file-center" : ".side-body");
    if (!pane)
      return;
    const hit = pane.querySelector(".focus");
    if (hit) {
      hit.scrollIntoView({ block: "center" });
      return;
    }
    const f = S.focus;
    if (f?.section) {
      const off = findSection(fileText(f.path) ?? "", f.section);
      if (off !== null) {
        pane.querySelector(\`[data-start="\${off}"]\`)?.scrollIntoView({ block: "start" });
        return;
      }
    }
    pane.scrollTop = 0;
  }
  function toast(msg) {
    const t = h("div", { class: "toast" }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2800);
  }
  function stepFile(d) {
    const paths = filteredPaths();
    const next = paths[Math.min(Math.max(paths.indexOf(S.file ?? "") + d, 0), paths.length - 1)];
    if (next)
      openFile(next);
  }
  function onKey(e) {
    if (S.ended)
      return;
    const t = e.target;
    if (t.closest("input, textarea, [contenteditable]"))
      return;
    if (e.metaKey || e.ctrlKey || e.altKey)
      return;
    if (editor) {
      if (e.key === "Escape")
        closeEditor();
      return;
    }
    if (e.key === "Escape") {
      if (S.help || S.drawer || S.picker) {
        S.help = false;
        S.drawer = false;
        S.picker = false;
        render();
      }
      hideToolbar();
      return;
    }
    const it = currentItem();
    const verdict = VERDICT_KEYS.find(([, k]) => k === e.key);
    if (verdict && S.view === "queue" && it) {
      e.preventDefault();
      pickVerdict(it, verdict[0]);
      return;
    }
    const ann = ANN_KEYS.find(([, k]) => k === e.key);
    if (ann) {
      e.preventDefault();
      openEditor(ann[0]);
      return;
    }
    const actions = {
      j: () => S.view === "files" ? stepFile(1) : step(1),
      k: () => S.view === "files" ? stepFile(-1) : step(-1),
      n: nextUnreviewed,
      u: () => {
        if (it && S.view === "queue") {
          setVerdict(it.id, null);
          render();
        }
      },
      "1": () => go("home"),
      "2": () => go("queue"),
      "3": () => go("files"),
      "4": () => go("dashboard"),
      "5": () => go("submit"),
      p: toggleDrawer,
      v: toggleRaw,
      "/": () => {
        if (S.view !== "files")
          go("files");
        document.getElementById("file-filter")?.focus();
      },
      t: () => {
        S.picker = !S.picker;
        render();
      },
      "?": () => {
        S.help = !S.help;
        render();
      }
    };
    const act = actions[e.key];
    if (act) {
      e.preventDefault();
      act();
    }
  }
  async function boot() {
    injectThemes(THEMES);
    const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(systemDark ? DEFAULT_DARK : DEFAULT_LIGHT, false);
    const p = await api("GET", "/api/packet");
    if (p.status !== 200) {
      root.replaceChildren(h("div", { class: "ended" }, h("h1", {}, "Cannot load the review"), h("p", {}, "Open the exact URL the review tool printed — it carries the access token.")));
      return;
    }
    const d = await api("GET", "/api/draft");
    const th = await api("GET", "/api/themes");
    const draft = d.data.draft;
    const packet = p.data.packet;
    FILES = new Map(packet.files.map((f) => [f.path, f.text]));
    IDX = buildIndex(packet.files.map((f) => f.path), [...(packet.ledger ?? []).map((r) => r.id), ...packet.items.map((i) => i.id)], packet.items.map((i) => i.id));
    injectThemes([...THEMES, ...th.data.themes ?? []]);
    const known = (id) => !!id && [...THEMES, ...th.data.themes ?? []].some((t) => t.id === id);
    const startTheme = known(th.data.initial) ? th.data.initial : known(th.data.prefs?.theme) ? th.data.prefs.theme : null;
    if (startTheme)
      applyTheme(startTheme, false);
    const restored = draft ? d.data.stale ? "Restored a draft made against a different version of this packet. Rulings and notes were kept — check them against the current items." : "Welcome back — your draft is restored." : null;
    S = {
      packet,
      digest: p.data.digest,
      draftPath: p.data.draftPath,
      review: {
        reviewer: draft?.reviewer || packet.reviewer || "",
        verdicts: (draft?.verdicts ?? []).filter((v) => packet.items.some((i) => i.id === v.item)),
        annotations: draft?.annotations ?? []
      },
      view: "home",
      current: 0,
      file: null,
      side: null,
      focus: null,
      filter: "",
      openDirs: new Set(["intent"]),
      raw: false,
      drawer: false,
      saved: draft ? "saved" : "idle",
      banner: d.data.error ?? restored,
      errors: [],
      ended: null,
      help: false,
      theme: document.documentElement.dataset.theme ?? DEFAULT_LIGHT,
      picker: false,
      customThemes: th.data.themes ?? [],
      themeDir: th.data.dir ?? null,
      folds: loadFolds()
    };
    if (draft?.comment)
      S.review.comment = draft.comment;
    if (draft?.overall)
      S.review.overall = draft.overall;
    S.current = displayOrder()[0] ?? 0;
    applyHash();
    document.title = packet.title;
    document.addEventListener("keydown", onKey);
    initTips();
    document.addEventListener("mousedown", (e) => {
      if (S.picker && !e.target.closest(".picker, .theme-btn")) {
        S.picker = false;
        render();
      }
    });
    document.addEventListener("mouseup", () => setTimeout(showToolbar, 0));
    document.addEventListener("keyup", (e) => {
      if (e.shiftKey)
        setTimeout(showToolbar, 0);
    });
    document.addEventListener("selectionchange", () => {
      if (window.getSelection()?.isCollapsed)
        hideToolbar();
    });
    render();
  }
  function applyHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const item = q.get("item");
    const file = q.get("file");
    const view = q.get("view");
    const theme = q.get("theme");
    if (item) {
      const i = items().findIndex((x) => x.id === item);
      if (i >= 0) {
        S.current = i;
        S.view = "queue";
      }
    }
    if (file && FILES.has(file)) {
      S.view = "files";
      S.file = file;
      revealDir(file);
    }
    if (TABS.some(([v]) => v === view))
      S.view = view;
    if (q.has("drawer"))
      S.drawer = true;
    if (theme && allThemes().some((t) => t.id === theme))
      applyTheme(theme, false);
  }
  boot().catch((e) => {
    root.textContent = \`The review page failed to start: \${e instanceof Error ? e.message : String(e)}\`;
  });
})();
</script>
</body>
</html>
`;
  const config = configDir();
  const themeDir = join3(config, "themes");
  const { themes, initial } = loadThemes(themeDir, typeof flags.theme === "string" ? flags.theme : undefined, io);
  const base = {
    packet,
    digest,
    out,
    draft,
    html,
    themes,
    themeDir,
    prefsPath: join3(config, "prefs.json")
  };
  const withTheme = initial === undefined ? base : { ...base, initialTheme: initial };
  const handle = await serve(port === undefined ? withTheme : { ...withTheme, port });
  const abandon = () => {
    io.out(`review: abandoned — no decisions written; draft kept at ${draft}`);
    handle.close().finally(() => process.exit(3));
  };
  process.once("SIGINT", abandon);
  process.once("SIGTERM", abandon);
  io.out(`review: open ${handle.url}`);
  io.out(`review: ${packet.items.length} items; draft autosaves to ${draft}`);
  if (flags.open === true)
    openBrowser(handle.url);
  const outcome = await handle.done;
  process.off("SIGINT", abandon);
  process.off("SIGTERM", abandon);
  if (outcome.kind === "abandoned") {
    io.out(`review: abandoned from the page — no decisions written; draft kept at ${draft}`);
    return 3;
  }
  const d = outcome.decisions;
  io.out(`review: decisions written to ${outcome.out} (${d.verdicts.length} verdicts, ${d.annotations.length} annotations)`);
  return 0;
}
function cmdLocate(flags, io) {
  const decisionsPath = need(flags, "decisions");
  const root = resolve(need(flags, "repo"));
  const { value } = readJsonFile(decisionsPath);
  const v = validateDecisions(value);
  if (!v.ok)
    throw new InputError(`${decisionsPath} is not a valid decisions file`, v.errors);
  const packet = typeof flags.packet === "string" ? loadPacket(flags.packet).packet : null;
  const results = v.value.annotations.map((a) => {
    let path = null;
    if (a.target.kind === "file")
      path = a.target.path;
    else {
      const target = a.target;
      path = packet?.items.find((i) => i.id === target.item)?.source.path ?? null;
    }
    if (!path)
      return {
        id: a.id,
        path: null,
        status: "unknown",
        note: "item annotation; pass --packet to locate it in its source file"
      };
    let text;
    try {
      text = readFileSync3(join3(root, path), "utf8");
    } catch {
      return { id: a.id, path, status: "orphaned", note: "file not found" };
    }
    return { id: a.id, path, ...locate(text, a.selector) };
  });
  io.out(JSON.stringify(results, null, 2));
  return 0;
}
function configDir(env = process.env) {
  if (env.INTENT_REVIEW_CONFIG)
    return env.INTENT_REVIEW_CONFIG;
  const xdg = env.XDG_CONFIG_HOME || join3(homedir(), ".config");
  return join3(xdg, "intent-review");
}
function loadThemes(dir, flag, io) {
  const themes = [];
  const load = (path) => {
    let raw;
    try {
      raw = JSON.parse(readFileSync3(path, "utf8"));
    } catch {
      io.err(`review: warning: theme ${path} is not readable JSON; skipped`);
      return null;
    }
    const v = validateTheme(raw);
    if (!v.ok) {
      io.err(`review: warning: theme ${path} skipped:
  ${v.errors.join(`
  `)}`);
      return null;
    }
    const t2 = resolveTheme(v.theme);
    if (t2)
      themes.push(t2);
    return t2;
  };
  if (existsSync2(dir)) {
    for (const name of readdirSync2(dir).sort())
      if (name.endsWith(".json"))
        load(join3(dir, name));
  }
  if (flag === undefined)
    return { themes };
  if (THEMES.some((t2) => t2.id === flag) || themes.some((t2) => t2.id === flag))
    return { themes, initial: flag };
  if (!existsSync2(flag))
    throw new UsageError(`--theme: "${flag}" is neither a theme id nor a file`);
  const t = load(flag);
  return t ? { themes, initial: t.id } : { themes };
}
function openBrowser(url) {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", '""', url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {}
}

// src/main.ts
var code = await run(process.argv.slice(2), {
  out: (s) => process.stdout.write(`${s}
`),
  err: (s) => process.stderr.write(`${s}
`)
});
process.exitCode = code;
