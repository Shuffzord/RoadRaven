// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-09, PLUG-02 in 04-CONTEXT.md, §4.2 in 04-RESEARCH.md.

import { describe, it } from "vitest";

// Implementation file does not exist yet — Wave 1 creates it.
// import { parseEventFrame, classifyEvent } from "../../../src/bun/eventSchema";

describe("EventSchema (Zod boundary validation)", () => {
	it.todo("parses a valid event frame");
	it.todo("rejects missing nodeId");
	it.todo("rejects missing status");
	it.todo("accepts hello frame");
	it.todo("caps meta at 8KB");
	it.todo("classifies unknown_node when nodeId not in allowlist");
	it.todo("classifies invalid_status when status not in statusConfig");
});
