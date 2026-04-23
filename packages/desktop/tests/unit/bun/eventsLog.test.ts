// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-08..D-13 in 04-CONTEXT.md, §4 in 04-RESEARCH.md.

import { describe, it } from "vitest";

// Implementation file does not exist yet — Wave 1 creates it.
// import type { EventsLog } from "../../../src/bun/eventsLog";

describe("EventsLog (sidecar .events.jsonl)", () => {
	it.todo("appends one JSON line per event");
	it.todo("replays log into a last-event-per-nodeId Map");
	it.todo("preserves _error field on disk");
	it.todo("synthesises line for unparseable JSON with _error: malformed");
});
