/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetadataEditor } from "../../../src/mainview/components/MetadataEditor";

afterEach(() => {
	document.body.innerHTML = "";
});

describe("MetadataEditor", () => {
	it("empty metadata: renders 'No metadata. Click + to add a key-value pair.'", () => {
		render(<MetadataEditor metadata={{}} onChange={vi.fn()} />);
		expect(
			screen.getByText("No metadata. Click + to add a key-value pair."),
		).not.toBeNull();
	});

	it("existing metadata { key1: 'v1' } renders one row with key1/v1", () => {
		render(
			<MetadataEditor metadata={{ key1: "v1" }} onChange={vi.fn()} />,
		);
		const keyInput = screen.getByPlaceholderText("key") as HTMLInputElement;
		const valueInput = screen.getByPlaceholderText("value") as HTMLInputElement;
		expect(keyInput.value).toBe("key1");
		expect(valueInput.value).toBe("v1");
	});

	it("clicking '+ Add row' adds an empty row — calls onChange with prev + { '': '' }", () => {
		const onChange = vi.fn();
		render(
			<MetadataEditor metadata={{ foo: "bar" }} onChange={onChange} />,
		);
		const addBtn = screen.getByRole("button", { name: "+ Add row" });
		act(() => {
			fireEvent.click(addBtn);
		});
		// toRecord filters out empty-key rows, so a single '' key row is dropped.
		// The observable behavior is the onChange fires with the original record (foo=bar only)
		// and a second row becomes visible for the user to fill in.
		expect(onChange).toHaveBeenCalledWith({ foo: "bar" });
		// After click we should see 2 key inputs (the new empty row is visible)
		const keyInputs = screen.getAllByPlaceholderText("key");
		expect(keyInputs).toHaveLength(2);
	});

	it("editing a key input calls onChange with the renamed key", () => {
		const onChange = vi.fn();
		render(
			<MetadataEditor
				metadata={{ priority: "high" }}
				onChange={onChange}
			/>,
		);
		const keyInput = screen.getByPlaceholderText("key") as HTMLInputElement;
		act(() => {
			fireEvent.change(keyInput, { target: { value: "urgency" } });
		});
		expect(onChange).toHaveBeenLastCalledWith({ urgency: "high" });
	});

	it("editing a value input calls onChange with same key, new value", () => {
		const onChange = vi.fn();
		render(
			<MetadataEditor
				metadata={{ priority: "low" }}
				onChange={onChange}
			/>,
		);
		const valueInput = screen.getByPlaceholderText("value") as HTMLInputElement;
		act(() => {
			fireEvent.change(valueInput, { target: { value: "high" } });
		});
		expect(onChange).toHaveBeenLastCalledWith({ priority: "high" });
	});

	it("clicking x button on a row calls onChange with that key removed", () => {
		const onChange = vi.fn();
		render(
			<MetadataEditor
				metadata={{ a: "1", b: "2" }}
				onChange={onChange}
			/>,
		);
		const removeBtn = screen.getByRole("button", {
			name: 'Delete metadata row "a"',
		});
		act(() => {
			fireEvent.click(removeBtn);
		});
		expect(onChange).toHaveBeenLastCalledWith({ b: "2" });
	});

	it("delete button has aria-label='Delete metadata row \"{key}\"'", () => {
		render(
			<MetadataEditor
				metadata={{ priority: "high" }}
				onChange={vi.fn()}
			/>,
		);
		const btn = screen.getByLabelText('Delete metadata row "priority"');
		expect(btn).not.toBeNull();
	});

	it("add button visible label is '+ Add row'", () => {
		render(<MetadataEditor metadata={{}} onChange={vi.fn()} />);
		const btn = screen.getByRole("button", { name: "+ Add row" });
		expect(btn.textContent).toContain("+ Add row");
	});
});
