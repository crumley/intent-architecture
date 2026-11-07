// Build the single-file bundle (design/decisions/0002): the page (script +
// stylesheet inlined into the HTML template) defined as a constant inside one
// Node ES module, written into the skill.
//
//   bun scripts/build.ts            write the bundle
//   bun scripts/build.ts --check    fail if the committed bundle differs (no writes)
//   bun scripts/build.ts --out F    write somewhere else

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const here = join(import.meta.dir, '..');
const repoRoot = join(here, '..', '..');
const DEFAULT_OUT = join(repoRoot, '.agents/skills/intent-architecture/scripts/review.mjs');

const BANNER = `#!/usr/bin/env node
// GENERATED FILE — do not edit. Built from tools/review/ in the intent-architecture
// repository (\`mise run build\` there); CI fails if this file differs from a fresh build.
// The intent review tool: \`node review.mjs --help\`. Node >= 20, built-in modules only.
`;

async function buildOne(config: Parameters<typeof Bun.build>[0]): Promise<string> {
  const result = await Bun.build(config);
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error('build failed');
  }
  const out = result.outputs[0];
  if (!out) throw new Error('build produced no output');
  return await out.text();
}

export async function buildBundle(): Promise<string> {
  const js = await buildOne({
    entrypoints: [join(here, 'src/ui/main.ts')],
    target: 'browser',
    format: 'iife',
    minify: false,
  });
  const css = readFileSync(join(here, 'src/ui/style.css'), 'utf8');
  const template = readFileSync(join(here, 'src/ui/index.html'), 'utf8');
  // A literal "</script" inside the script would end the element early.
  const html = template
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));

  const server = await buildOne({
    entrypoints: [join(here, 'src/main.ts')],
    target: 'node',
    format: 'esm',
    minify: false,
    define: { __PAGE_HTML__: JSON.stringify(html) },
  });
  const bundle = BANNER + server;
  const foreign = [
    ...bundle.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ]
    .map((m) => m[1] ?? m[2])
    .filter((s): s is string => !!s && !s.startsWith('node:'));
  if (foreign.length) throw new Error(`bundle imports non-built-in modules: ${foreign.join(', ')}`);
  return bundle;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx === -1 ? DEFAULT_OUT : (args[outIdx + 1] as string);
  const bundle = await buildBundle();
  const rel = relative(process.cwd(), out);
  if (args.includes('--check')) {
    let committed = '';
    try {
      committed = readFileSync(out, 'utf8');
    } catch {
      // missing counts as drift
    }
    if (committed !== bundle) {
      console.error(
        `bundle drift: ${rel} differs from a fresh build — run \`mise run build\` and commit it`,
      );
      process.exit(1);
    }
    console.log(
      `bundle ok: ${rel} matches a fresh build (${(bundle.length / 1024).toFixed(0)} KiB)`,
    );
  } else {
    writeFileSync(out, bundle, { mode: 0o755 });
    console.log(`wrote ${rel} (${(bundle.length / 1024).toFixed(0)} KiB)`);
  }
}
