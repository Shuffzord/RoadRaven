// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-03 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-06 in 04-CONTEXT.md.

import { describe, it } from "vitest";
// eventApiStore does not exist yet — Wave 2 creates it.
// import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";

describe("eventApiStore state machine", () => {
	it.todo("off → listening transition on server up");
	it.todo("listening → error transition on EADDRINUSE");
	it.todo("connectedCount increments on connection open");
});
