// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-05 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-05, D-28 in 04-CONTEXT.md, §6 in 04-RESEARCH.md.

import { describe, it } from "vitest";
// sentinel module does not exist yet — Wave 4 creates it.
// import { readSentinel } from "../src/sentinel";

describe("Sentinel reader (MCP wrapper side)", () => {
	it.todo("retries readSentinel 6 times with 500ms backoff (3s total)");
	it.todo("returns not-running error when sentinel missing after retries");
	it.todo(
		"returns not-running when pid is dead (process.kill(pid, 0) throws)",
	);
});
