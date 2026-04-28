// Phase 4 Plan 04-03 Task 1 — real tests for eventApiStore.
// Sources: D-06 in 04-CONTEXT.md, PLUG-06.

import { beforeEach, describe, expect, it } from "vitest";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";

beforeEach(() => {
	useEventApiStore.setState({
		status: "off",
		port: null,
		connectedCount: 0,
		errorMessage: null,
	});
});

describe("eventApiStore state machine", () => {
	it("initial state is off with null port and zero count", () => {
		const s = useEventApiStore.getState();
		expect(s.status).toBe("off");
		expect(s.port).toBeNull();
		expect(s.connectedCount).toBe(0);
		expect(s.errorMessage).toBeNull();
	});

	it("setState merges partial state — off → listening", () => {
		useEventApiStore.getState().setState({ status: "listening", port: 47921 });
		const s = useEventApiStore.getState();
		expect(s.status).toBe("listening");
		expect(s.port).toBe(47921);
		expect(s.connectedCount).toBe(0);
		expect(s.errorMessage).toBeNull();
	});

	it("off → listening → error preserves port when caller sets it", () => {
		useEventApiStore.getState().setState({ status: "listening", port: 47921 });
		useEventApiStore
			.getState()
			.setState({ status: "error", errorMessage: "Port 47921 in use" });
		const s = useEventApiStore.getState();
		expect(s.status).toBe("error");
		expect(s.port).toBe(47921);
		expect(s.errorMessage).toBe("Port 47921 in use");
	});

	it("connectedCount increments on connection open", () => {
		useEventApiStore
			.getState()
			.setState({ status: "listening", port: 47921, connectedCount: 2 });
		expect(useEventApiStore.getState().connectedCount).toBe(2);
	});
});
