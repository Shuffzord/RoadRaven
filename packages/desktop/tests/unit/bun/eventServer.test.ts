// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-01, D-02, D-05 in 04-CONTEXT.md, §1 in 04-RESEARCH.md.

import { describe, it } from "vitest";
// Implementation file does not exist yet — Wave 1 creates it.
// import type { startEventServer } from "../../../src/bun/eventServer";

describe("EventServer (WebSocket lifecycle)", () => {
	it.todo("binds on the default port 47921 when nothing conflicts");
	it.todo("falls back to +1..+9 when default port is taken (D-01)");
	it.todo(
		"returns in_use error when user-specified port is taken (D-02 — no fallback)",
	);
	it.todo("accepts hello frame within 2s grace window (D-05)");
	it.todo(
		"stamps source: 'unknown' when no hello frame arrives in grace window",
	);
	it.todo(
		"falls back to port X+1 when Bun.serve on port X throws EADDRINUSE asynchronously (I-04 coverage — see Plan 04-02 Task 5 eventServer.eaddrinuse.test.ts)",
	);
});
