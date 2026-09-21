// @vitest-environment jsdom
// Phase 4 Plan 04-03 Task 5 — EventToast real tests.
// Sources: D-22, D-23, D-24 in 04-CONTEXT.md, PLUG-06, I-05.

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventToast } from "../../../src/mainview/components/EventToast";
import type { ActiveToast } from "../../../src/mainview/store/toastStore";

function makeToast(overrides: Partial<ActiveToast> = {}): ActiveToast {
	return {
		id: "t1",
		type: "malformed",
		source: "claude-code",
		count: 1,
		lastEventAt: Date.now(),
		...overrides,
	};
}

describe("EventToast (D-23, D-24)", () => {
	it("renders malformed toast copy per D-23", () => {
		render(<EventToast toast={makeToast()} onDismiss={vi.fn()} />);
		expect(
			screen.getByText("Invalid event from claude-code."),
		).toBeInTheDocument();
		expect(screen.getByText("See event log for details.")).toBeInTheDocument();
	});

	it("renders unknown_node toast copy per D-23", () => {
		render(
			<EventToast
				toast={makeToast({ type: "unknown_node" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText("Event for unknown node from claude-code."),
		).toBeInTheDocument();
		expect(
			screen.getByText("Node id not found in the current roadmap."),
		).toBeInTheDocument();
	});

	it("renders invalid_status toast copy per D-23", () => {
		render(
			<EventToast
				toast={makeToast({ type: "invalid_status", detail: "pending" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText("Unknown status 'pending' from claude-code."),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Extend statusConfig in the schema to accept this status.",
			),
		).toBeInTheDocument();
	});

	it("renders version_mismatch toast copy", () => {
		render(
			<EventToast
				toast={makeToast({ type: "version_mismatch", detail: "0.7.2|0.8.0" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText(
				"MCP server version 0.7.2 does not match RoadRaven 0.8.0.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText("Update the RoadRaven plugin or the app."),
		).toBeInTheDocument();
	});

	it("renders disconnect info toast with no body per D-23", () => {
		render(
			<EventToast
				toast={makeToast({ type: "disconnect", source: "producer-1" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText("Producer producer-1 disconnected."),
		).toBeInTheDocument();
		// Disconnect has no body per D-23
		expect(
			screen.queryByText("See event log for details."),
		).not.toBeInTheDocument();
	});

	it("renders merged headline when count > 1 (D-24)", () => {
		render(<EventToast toast={makeToast({ count: 3 })} onDismiss={vi.fn()} />);
		expect(
			screen.getByText("3 invalid events from claude-code."),
		).toBeInTheDocument();
	});

	it("no Retry button present (D-22)", () => {
		render(<EventToast toast={makeToast()} onDismiss={vi.fn()} />);
		expect(screen.queryByText(/Retry/i)).not.toBeInTheDocument();
	});

	it("dismiss button calls onDismiss", () => {
		const onDismiss = vi.fn();
		render(<EventToast toast={makeToast()} onDismiss={onDismiss} />);
		fireEvent.click(screen.getByText("Dismiss"));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});

// v0.8: the Bun process appends the remedy to the detail
// (`<producer>|<app>|<remedy>`); the toast only displays it.
describe("EventToast version_mismatch remedy (v0.8)", () => {
	beforeEach(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function renderMismatch(detail: string, count = 1) {
		render(
			<EventToast
				toast={makeToast({ type: "version_mismatch", detail, count })}
				onDismiss={vi.fn()}
			/>,
		);
	}

	it("update-plugin shows the verified plugin update command with a working Copy button", async () => {
		renderMismatch("0.7.2|0.8.0|update-plugin");
		const command =
			"claude plugin marketplace update roadraven; claude plugin update roadraven@roadraven";
		expect(
			screen.getByText(
				"MCP server version 0.7.2 does not match RoadRaven 0.8.0.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Update the RoadRaven plugin, then restart Claude Code:",
			),
		).toBeInTheDocument();
		expect(screen.getByText(command)).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(screen.getByText("Copy"));
		});
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(command);
		expect(screen.getByText("Copied ✓")).toBeInTheDocument();
	});

	it("update-npm re-registers the server pinned to the app version", () => {
		renderMismatch("0.7.2|0.8.0-beta.1|update-npm");
		expect(
			screen.getByText(
				"Re-register the MCP server at 0.8.0-beta.1, then restart your agent:",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"claude mcp remove roadraven; claude mcp add -s user roadraven -- npx -y @roadraven/mcp@0.8.0-beta.1",
			),
		).toBeInTheDocument();
	});

	it("update-app on Windows shows the PowerShell installer one-liner", () => {
		vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		);
		renderMismatch("0.9.1|0.8.0|update-app");
		expect(screen.getByText("Update RoadRaven to 0.9.1.")).toBeInTheDocument();
		expect(
			screen.getByText(
				"irm https://raw.githubusercontent.com/Shuffzord/RoadRaven/master/install.ps1 | iex",
			),
		).toBeInTheDocument();
	});

	it("update-app on Linux shows the shell installer one-liner", () => {
		vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		);
		renderMismatch("0.9.1|0.8.0|update-app");
		expect(
			screen.getByText(
				"curl -fsSL https://raw.githubusercontent.com/Shuffzord/RoadRaven/master/install.sh | sh",
			),
		).toBeInTheDocument();
	});

	it("update-app without an installer for the platform shows text only", () => {
		vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15",
		);
		renderMismatch("0.9.1|0.8.0|update-app");
		expect(screen.getByText("Update RoadRaven to 0.9.1.")).toBeInTheDocument();
		expect(screen.queryByText("Copy")).not.toBeInTheDocument();
	});

	it("restart-agent is text only", () => {
		renderMismatch("0.1.0|0.8.0|restart-agent");
		expect(
			screen.getByText(
				"RoadRaven updated its MCP server — restart your agent session to load it.",
			),
		).toBeInTheDocument();
		expect(screen.queryByText("Copy")).not.toBeInTheDocument();
	});

	it("reinstall points at the Setup Wizard, text only", () => {
		renderMismatch("0.1.0|0.8.0|reinstall");
		expect(
			screen.getByText("Re-run the Setup Wizard and install the integration."),
		).toBeInTheDocument();
		expect(screen.queryByText("Copy")).not.toBeInTheDocument();
	});

	it("a merged toast shows the same remedy", () => {
		renderMismatch("0.7.2|0.8.0|update-plugin", 3);
		expect(
			screen.getByText("3 version mismatches from claude-code."),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Update the RoadRaven plugin, then restart Claude Code:",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Copy")).toBeInTheDocument();
	});
});
