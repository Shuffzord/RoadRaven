/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { SidePanel } from "../../../src/mainview/components/SidePanel";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_ID = "11111111-2222-4333-8444-555555555555";

function makeSchema(
	overrides: Partial<RoadmapSchema> = {},
	nodeOverrides: Partial<{
		title: string;
		type: string;
		notes: string;
		metadata: Record<string, unknown>;
	}> = {},
): RoadmapSchema {
	return {
		version: "1.0",
		title: "Edit Mode Test",
		statusConfig: [
			{ id: "not-started", label: "Not Started" },
			{ id: "in-progress", label: "In Progress" },
			{ id: "completed", label: "Completed" },
			{ id: "blocked", label: "Blocked" },
		],
		typeConfig: [
			{ id: "epic", label: "Epic" },
			{ id: "task", label: "Task" },
		],
		nodes: [
			{
				id: ROOT_ID,
				title: nodeOverrides.title ?? "Root",
				status: "not-started",
				type: nodeOverrides.type,
				notes: nodeOverrides.notes,
				metadata: nodeOverrides.metadata,
				children: [{ id: CHILD_ID, title: "Child", status: "in-progress" }],
			},
		],
		...overrides,
	};
}

function seedStore(
	overrides: Partial<RoadmapSchema> = {},
	nodeOverrides: Partial<{
		title: string;
		type: string;
		notes: string;
		metadata: Record<string, unknown>;
	}> = {},
	selectedId = ROOT_ID,
): void {
	const schema = makeSchema(overrides, nodeOverrides);
	useRoadmapStore.getState().loadSchema(schema, "/tmp/test.json");
	useRoadmapStore.getState().setSelectedNode(selectedId);
}

beforeEach(() => {
	vi.restoreAllMocks();
	resetStore();
});

afterEach(() => {
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

describe("SidePanel — edit mode", () => {
	it("opens in preview mode; title renders as h2 (not input)", () => {
		seedStore({}, { title: "My Root" });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		const h2s = screen.getAllByRole("heading", { level: 2 });
		expect(h2s.some((h) => h.textContent === "My Root")).toBe(true);
		expect(screen.queryByLabelText("Title")).toBeNull();
	});

	it("clicking the title value switches to edit mode (title becomes input)", () => {
		seedStore({}, { title: "My Root" });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("My Root"));
		const input = screen.getByLabelText("Title") as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.value).toBe("My Root");
	});

	it("clicking the [E] Edit node button switches to edit mode", () => {
		seedStore({}, { title: "My Root" });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		expect(screen.getByLabelText("Title")).toBeTruthy();
	});

	it("edit mode shows 'Editing' label in panel header", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		expect(screen.getByText("Editing")).toBeTruthy();
	});

	it("editing title fires renameNode on Enter", () => {
		seedStore({}, { title: "Old Title" });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const input = screen.getByLabelText("Title") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "New Title" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(useRoadmapStore.getState().nodeIndex.get(ROOT_ID)?.title).toBe(
			"New Title",
		);
	});

	it("status dropdown renders options from schema.statusConfig", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const select = screen.getByLabelText("Status") as HTMLSelectElement;
		const labels = Array.from(select.options).map((o) => o.textContent);
		expect(labels).toEqual([
			"Not Started",
			"In Progress",
			"Completed",
			"Blocked",
		]);
	});

	it("status dropdown falls back to built-in statuses when schema.statusConfig absent", () => {
		seedStore({ statusConfig: undefined });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const select = screen.getByLabelText("Status") as HTMLSelectElement;
		expect(select.options.length).toBe(4);
	});

	it("selecting a new status calls updateNodeStatus", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const select = screen.getByLabelText("Status") as HTMLSelectElement;
		fireEvent.change(select, { target: { value: "in-progress" } });
		expect(useRoadmapStore.getState().nodeIndex.get(ROOT_ID)?.status).toBe(
			"in-progress",
		);
	});

	it("type dropdown renders typeConfig options when present", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const select = screen.getByLabelText("Type") as HTMLSelectElement;
		const labels = Array.from(select.options).map((o) => o.textContent);
		expect(labels).toContain("Epic");
		expect(labels).toContain("Task");
	});

	it("type field is freeform input when typeConfig absent", () => {
		seedStore({ typeConfig: undefined });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const typeEl = screen.getByLabelText("Type") as HTMLElement;
		expect(typeEl.tagName).toBe("INPUT");
	});

	it("Escape clears edit mode without committing", () => {
		seedStore({}, { title: "Stay" });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const input = screen.getByLabelText("Title") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "Changed" } });
		fireEvent.keyDown(document, { key: "Escape" });
		expect(useRoadmapStore.getState().nodeIndex.get(ROOT_ID)?.title).toBe(
			"Stay",
		);
		expect(screen.queryByLabelText("Title")).toBeNull();
	});

	it("metadata editor renders in edit mode with existing metadata", () => {
		seedStore({}, { metadata: { priority: "high" } });
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Edit node"));
		const keyInput = screen.getByPlaceholderText("key") as HTMLInputElement;
		expect(keyInput.value).toBe("priority");
	});

	it("pressing E enters edit mode when no text input is focused", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		expect(screen.queryByLabelText("Title")).toBeNull();
		fireEvent.keyDown(window, { key: "e" });
		expect(screen.getByLabelText("Title")).toBeTruthy();
	});

	it("pressing E does NOT enter edit mode when an input is focused", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		const textbox = document.createElement("input");
		document.body.appendChild(textbox);
		textbox.focus();
		fireEvent.keyDown(window, { key: "e" });
		expect(screen.queryByLabelText("Title")).toBeNull();
	});

	it("pressing E does NOT enter edit mode when modifier held (Ctrl+E reserved)", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.keyDown(window, { key: "e", ctrlKey: true });
		expect(screen.queryByLabelText("Title")).toBeNull();
	});

	it("SaveIndicator renders in panel header when a node is selected", () => {
		seedStore();
		render(<SidePanel isOpen onClose={vi.fn()} />);
		expect(screen.getByText("Saved")).toBeTruthy();
	});

	it("copy-ID button still works in preview mode (Phase 2 regression check)", () => {
		seedStore();
		const mockWrite = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: mockWrite },
			writable: true,
			configurable: true,
		});
		render(<SidePanel isOpen onClose={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Copy node ID"));
		expect(mockWrite).toHaveBeenCalledWith(ROOT_ID);
	});
});
