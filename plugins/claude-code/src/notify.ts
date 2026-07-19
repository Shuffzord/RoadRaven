#!/usr/bin/env node
// One-shot CLI entrypoint — logic lives in notifyCli.ts so tests can import it
// without triggering a send (same thin-entry pattern as index.ts → server.ts).
import { runNotify } from "./notifyCli";

runNotify(process.argv.slice(2)).then((code) => {
	process.exit(code);
});
