/** @vitest-environment jsdom */
// ResizeHandle — drag geometry for both anchoring sides, clamping, the ARIA
// separator keyboard contract, onResizeEnd and the double-click reset.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResizeHandle } from "../../../src/mainview/components/ResizeHandle";

type Props = Partial<React.ComponentProps<typeof ResizeHandle>>;

function setup(props: Props = {}, parentLeft = 0) {
	const onResize = vi.fn();
	const onResizeEnd = vi.fn();
	const onReset = vi.fn();
	const utils = render(
		<div data-testid="parent">
			<ResizeHandle
				onResize={onResize}
				onResizeEnd={onResizeEnd}
				onReset={onReset}
				minWidth={160}
				maxWidth={480}
				currentWidth={220}
				{...props}
			/>
		</div>,
	);
	screen.getByTestId("parent").getBoundingClientRect = () =>
		({ left: parentLeft }) as DOMRect;
	const handle = screen.getByRole("separator");
	return { ...utils, handle, onResize, onResizeEnd, onReset };
}

function drag(handle: HTMLElement, clientX: number): void {
	fireEvent.mouseDown(handle);
	fireEvent.mouseMove(window, { clientX });
}

afterEach(() => {
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
});

describe("ResizeHandle — mouse drag", () => {
	it("defaults to the left edge and measures from the window's right edge", () => {
		window.innerWidth = 1000;
		const { handle, onResize } = setup();
		expect(handle.className).toContain("left-0");
		drag(handle, 700);
		expect(onResize).toHaveBeenLastCalledWith(300);
	});

	it("side=right sits on the right edge and measures from the parent's left", () => {
		const { handle, onResize } = setup({ side: "right" }, 40);
		expect(handle.className).toContain("right-0");
		drag(handle, 300);
		expect(onResize).toHaveBeenLastCalledWith(260);
	});

	it("clamps to min/max", () => {
		const { handle, onResize } = setup({ side: "right" });
		drag(handle, 20);
		expect(onResize).toHaveBeenLastCalledWith(160);
		fireEvent.mouseMove(window, { clientX: 2000 });
		expect(onResize).toHaveBeenLastCalledWith(480);
	});

	it("ignores mouse moves before a drag starts", () => {
		const { onResize } = setup();
		fireEvent.mouseMove(window, { clientX: 300 });
		expect(onResize).not.toHaveBeenCalled();
	});

	it("fires onResizeEnd on mouseup only after a drag", () => {
		const { handle, onResizeEnd } = setup();
		fireEvent.mouseUp(window);
		expect(onResizeEnd).not.toHaveBeenCalled();
		drag(handle, 300);
		expect(document.body.style.cursor).toBe("col-resize");
		fireEvent.mouseUp(window);
		expect(onResizeEnd).toHaveBeenCalledTimes(1);
		expect(document.body.style.cursor).toBe("");
	});
});

describe("ResizeHandle — keyboard", () => {
	it("ArrowRight grows a right-side handle by 16px, Shift by 64px", () => {
		const { handle, onResize, onResizeEnd } = setup({ side: "right" });
		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(onResize).toHaveBeenLastCalledWith(236);
		fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
		expect(onResize).toHaveBeenLastCalledWith(284);
		expect(onResizeEnd).toHaveBeenCalledTimes(2);
	});

	it("ArrowLeft shrinks a right-side handle and grows a left-side one", () => {
		const right = setup({ side: "right" });
		fireEvent.keyDown(right.handle, { key: "ArrowLeft" });
		expect(right.onResize).toHaveBeenLastCalledWith(204);
		right.unmount();
		const left = setup({ side: "left" });
		fireEvent.keyDown(left.handle, { key: "ArrowLeft" });
		expect(left.onResize).toHaveBeenLastCalledWith(236);
	});

	it("Home/End jump to min/max and steps clamp", () => {
		const { handle, onResize } = setup({ side: "right", currentWidth: 170 });
		fireEvent.keyDown(handle, { key: "Home" });
		expect(onResize).toHaveBeenLastCalledWith(160);
		fireEvent.keyDown(handle, { key: "End" });
		expect(onResize).toHaveBeenLastCalledWith(480);
		fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
		expect(onResize).toHaveBeenLastCalledWith(160);
	});

	it("ignores unrelated keys", () => {
		const { handle, onResize, onResizeEnd } = setup();
		fireEvent.keyDown(handle, { key: "Enter" });
		expect(onResize).not.toHaveBeenCalled();
		expect(onResizeEnd).not.toHaveBeenCalled();
	});
});

describe("ResizeHandle — ARIA and reset", () => {
	it("exposes separator values and a configurable label", () => {
		const { handle } = setup({ "aria-label": "Resize sidebar" });
		expect(handle.getAttribute("aria-valuenow")).toBe("220");
		expect(handle.getAttribute("aria-valuemin")).toBe("160");
		expect(handle.getAttribute("aria-valuemax")).toBe("480");
		expect(handle.getAttribute("aria-label")).toBe("Resize sidebar");
	});

	it("defaults the label to Resize panel", () => {
		const { handle } = setup();
		expect(handle.getAttribute("aria-label")).toBe("Resize panel");
	});

	it("double-click calls onReset", () => {
		const { handle, onReset } = setup();
		fireEvent.doubleClick(handle);
		expect(onReset).toHaveBeenCalledTimes(1);
	});
});
