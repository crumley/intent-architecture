// The bundle's entry point: run the CLI and exit with its code.

import { run } from './cli.ts';

const code = await run(process.argv.slice(2), {
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
});
process.exitCode = code;
