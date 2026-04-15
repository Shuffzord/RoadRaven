import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WelcomeScreen } from "../../../src/mainview/components/WelcomeScreen";

// @vitest-environment jsdom

// Mock rpc module to prevent Electroview import errors
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: null,
}));

const defaultProps = {
	recentFiles: [],
	onOpenFile: vi.fn(),
	onNewRoadmap: vi.fn(),
	onOpenRecent: vi.fn(),
	onOpenSample: vi.fn(),
};

describe("WelcomeScreen", () => {
	it("renders Open File and New Roadmap buttons", () => {
		render(<WelcomeScreen {...defaultProps} />);
		expect(screen.getByText("Open File")).toBeTruthy();
		expect(screen.getByText("New Roadmap")).toBeTruthy();
	});

	it("renders app name and subheading", () => {
		render(<WelcomeScreen {...defaultProps} />);
		expect(screen.getByText("RoadRaven")).toBeTruthy();
		expect(screen.getByText("Open a roadmap file to get started")).toBeTruthy();
	});

	it("renders sample links", () => {
		render(<WelcomeScreen {...defaultProps} />);
		expect(screen.getByText("Hello World")).toBeTruthy();
		expect(screen.getByText("Getting Started")).toBeTruthy();
	});

	it("shows 'No recent files' when recentFiles is empty", () => {
		render(<WelcomeScreen {...defaultProps} recentFiles={[]} />);
		expect(screen.getByText("No recent files")).toBeTruthy();
	});

	it("renders recent file entries when provided", () => {
		const files = ["/path/to/roadmap.json", "/other/file.json"];
		render(<WelcomeScreen {...defaultProps} recentFiles={files} />);
		expect(screen.getByText("roadmap.json")).toBeTruthy();
		expect(screen.getByText("file.json")).toBeTruthy();
	});

	it("calls onOpenFile when Open File button is clicked", () => {
		const onOpenFile = vi.fn();
		render(<WelcomeScreen {...defaultProps} onOpenFile={onOpenFile} />);
		fireEvent.click(screen.getByText("Open File"));
		expect(onOpenFile).toHaveBeenCalledOnce();
	});

	it("calls onOpenRecent with correct path when recent file is clicked", () => {
		const onOpenRecent = vi.fn();
		render(
			<WelcomeScreen
				{...defaultProps}
				recentFiles={["/path/to/roadmap.json"]}
				onOpenRecent={onOpenRecent}
			/>,
		);
		fireEvent.click(screen.getByText("roadmap.json"));
		expect(onOpenRecent).toHaveBeenCalledWith("/path/to/roadmap.json");
	});

	it("calls onOpenSample with 'hello-world' when sample link is clicked", () => {
		const onOpenSample = vi.fn();
		render(<WelcomeScreen {...defaultProps} onOpenSample={onOpenSample} />);
		fireEvent.click(screen.getByText("Hello World"));
		expect(onOpenSample).toHaveBeenCalledWith("hello-world");
	});
});
