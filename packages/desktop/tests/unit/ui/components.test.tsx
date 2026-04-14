// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the rpc module to prevent Electroview import
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				saveSettings: vi.fn(() => Promise.resolve({ success: true })),
				loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
			},
		},
	},
}));

import { RoadmapNodeCard } from "../../../src/mainview/components/RoadmapNodeCard";
import { SidePanel } from "../../../src/mainview/components/SidePanel";

describe("RoadmapNodeCard", () => {
	it("renders title text", () => {
		render(<RoadmapNodeCard title="Test Node" status="in-progress" />);
		expect(screen.getByText("Test Node")).toBeTruthy();
	});

	it("renders status badge with text label", () => {
		render(<RoadmapNodeCard title="Test Node" status="in-progress" />);
		expect(screen.getByText("In Progress")).toBeTruthy();
	});

	it("sets --node-stripe-color CSS variable matching status", () => {
		const { container } = render(
			<RoadmapNodeCard title="Test Node" status="completed" />,
		);
		const node = container.querySelector(".node");
		expect(node).toBeTruthy();
		const style = node?.getAttribute("style") ?? "";
		expect(style).toContain("--node-stripe-color");
		expect(style).toContain("--rv-status-completed");
	});

	it("sets --badge-color and --badge-bg CSS variables", () => {
		const { container } = render(
			<RoadmapNodeCard title="Test Node" status="blocked" />,
		);
		const node = container.querySelector(".node");
		const style = node?.getAttribute("style") ?? "";
		expect(style).toContain("--badge-color");
		expect(style).toContain("--badge-bg");
		expect(style).toContain("--rv-status-blocked");
		expect(style).toContain("--rv-status-blocked-bg");
	});
});

describe("SidePanel", () => {
	it("renders field labels: STATUS, TYPE, CREATED, UPDATED, ID, NOTES", () => {
		render(
			<SidePanel
				isOpen={true}
				onClose={() => {
					/* noop */
				}}
			/>,
		);
		for (const label of [
			"STATUS",
			"TYPE",
			"CREATED",
			"UPDATED",
			"ID",
			"NOTES",
		]) {
			expect(screen.getByText(label)).toBeTruthy();
		}
	});

	it("close button has aria-label='Close panel'", () => {
		render(
			<SidePanel
				isOpen={true}
				onClose={() => {
					/* noop */
				}}
			/>,
		);
		expect(screen.getByLabelText("Close panel")).toBeTruthy();
	});

	it("renders in closed state (width 0) by default", () => {
		const { container } = render(
			<SidePanel
				isOpen={false}
				onClose={() => {
					/* noop */
				}}
			/>,
		);
		const panel = container.firstElementChild as HTMLElement;
		expect(panel.style.width).toBe("0px");
	});
});

describe("Hardcoded color check", () => {
	it("components contain zero hardcoded hex/rgb color values", () => {
		const componentsDir = path.resolve(
			__dirname,
			"../../../src/mainview/components",
		);
		const files = fs
			.readdirSync(componentsDir)
			.filter(
				(f: string) => f.endsWith(".tsx") && f !== "ThemeOverrideProvider.tsx",
			);
		const hexPattern = /#[0-9a-fA-F]{3,8}\b/;
		const rgbPattern = /rgb\(|rgba\(|hsl\(/;

		for (const file of files) {
			const content = fs.readFileSync(path.join(componentsDir, file), "utf-8");
			expect(hexPattern.test(content)).toBe(false);
			expect(rgbPattern.test(content)).toBe(false);
		}
	});
});
