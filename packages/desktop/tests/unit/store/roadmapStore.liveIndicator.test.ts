// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-03 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-14, D-15 in 04-CONTEXT.md.

import { describe, it } from "vitest";
// isNodeLive selector does not exist yet — Wave 2 adds it to roadmapStore.
// import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

describe("roadmapStore live indicator (D-14)", () => {
	it.todo("isNodeLive returns true within 30s window");
	it.todo("isNodeLive returns false after 30s");
	it.todo("1 Hz tick re-evaluates which nodes are live");
});
