// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-25 in 04-CONTEXT.md, §3 in 04-RESEARCH.md.

import { describe, it } from "vitest";
// Implementation file does not exist yet — Wave 1 creates it.
// import type { EventCoalescer } from "../../../src/bun/eventCoalescer";

describe("EventCoalescer", () => {
	it.todo("batches events within 100ms window");
	it.todo("last-write-wins per nodeId");
	it.todo("flushes exactly once per batch");
	it.todo("flushNow() drains pending and clears timer");
	it.todo("timer is null when idle");
});
