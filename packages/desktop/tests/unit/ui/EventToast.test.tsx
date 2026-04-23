// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-04 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-22, D-23, D-24 in 04-CONTEXT.md, PLUG-06.

import { describe, it } from "vitest";

// import { render } from "@testing-library/react";
// EventToast component does not exist yet — Wave 3 creates it.
// import { EventToast } from "../../../src/mainview/components/EventToast";

describe("EventToast (D-23, D-24)", () => {
	it.todo("renders malformed-event toast copy per D-23");
	it.todo("renders unknown-node toast copy per D-23");
	it.todo("renders invalid-status toast copy per D-23");
	it.todo("renders producer-disconnect info toast (grey stripe)");
	it.todo(
		"merges same-type same-source within 5s into single toast with count (D-24)",
	);
	it.todo("dismiss button removes toast");
});
