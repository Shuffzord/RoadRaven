// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: PLUG-01, PLUG-03, PLUG-06 in 04-CONTEXT.md, §7.2 in 04-RESEARCH.md.

import { describe, it } from "vitest";
// Integration tests spin up an in-process WS loopback — Wave 1 provides the harness.
// import { createTestEventServer } from "../../helpers/eventServerHelper";

describe("Event API integration", () => {
	it.todo("routes events within 100ms");
	it.todo("producer disconnect emits one info toast per source");
	it.todo("malformed event appears in events.jsonl with _error");
	it.todo(
		"pushEventApiError is emitted when server rejects a malformed event (I-09)",
	);
	it.todo(
		"pushEventApiState connectedCount updates on producer connect + disconnect (I-09)",
	);
});
