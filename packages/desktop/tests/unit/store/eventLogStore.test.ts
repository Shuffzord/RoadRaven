// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-03 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-19, D-20 in 04-CONTEXT.md.

import { describe, it } from "vitest";
// eventLogStore does not exist yet — Wave 2 creates it.
// import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";

describe("eventLogStore", () => {
	it.todo("rows cap at 1000 (drops oldest)");
	it.todo("filter predicate for source dropdown");
	it.todo("filter predicate for selectedNodeOnly toggle");
	it.todo("filter predicate for status filter");
});
