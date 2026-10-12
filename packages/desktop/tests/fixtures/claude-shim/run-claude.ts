// Runs runClaude under real Bun (Bun.spawn + the default tree kill), the way
// the app does; vitest runs on Node, where Bun.spawn does not exist.
// argv: <shim> <timeoutMs> <resultFile>
import { writeFileSync } from "node:fs";
import { claudeArgv, runClaude } from "../../../src/bun/claudeCli";

const [shim, timeoutMs, resultFile] = process.argv.slice(2);
const res = await runClaude(claudeArgv(shim, []), Number(timeoutMs));
writeFileSync(resultFile, JSON.stringify(res));
