import { useState } from "react";
import { useFileActions } from "../../../mainview/hooks/useFileActions";
import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

/**
 * Plan 03-04c mid-plan UAT surface. Exposes the shell features so a verifier
 * can exercise File > New, the external-edit toast trigger, and a stand-in
 * for before-quit without leaving the dev harness.
 *
 * Buttons:
 *   - File > New                 → useFileActions().newRoadmap()
 *   - Simulate external change   → store.setExternalEdit(filePath ?? '/tmp/fake-…')
 *   - Trigger before-quit (dev)  → dispatches roadraven:dev-simulate-before-quit
 *                                  (real before-quit verification uses Cmd+Q
 *                                   in the full Phase 3 UAT — Task 5 below).
 *
 * Dev-only: mounted by DevHarness, which itself is gated by
 * `import.meta.env.DEV` at the App.tsx mount site.
 */
export function ShellPanel() {
	const { newRoadmap } = useFileActions();
	const setExternalEdit = useRoadmapStore((s) => s.setExternalEdit);
	const filePath = useRoadmapStore((s) => s.filePath);
	const isUntitled = useRoadmapStore((s) => s.isUntitled);
	const [log, setLog] = useState<string>("(no action yet)");

	const doNew = (): void => {
		void newRoadmap();
		setLog("newRoadmap dispatched (newUntitledSchema or Bun newFile RPC)");
	};

	const simulateExternalChange = (): void => {
		// Mirrors what handleExternalFileChange does on the dirty branch — the
		// toast appears at the bottom of the screen.
		setExternalEdit(filePath ?? "/tmp/fake-external-change.json");
		setLog("setExternalEdit dispatched; ExternalEditToast should be visible");
	};

	const triggerBeforeQuit = (): void => {
		// We cannot trigger Electrobun.events from the webview (the singleton
		// lives in the Bun process). Dispatch a CustomEvent instead so a
		// verifier can confirm the dev wiring, then run real before-quit in
		// Task 5's full UAT via Cmd+Q.
		window.dispatchEvent(new CustomEvent("roadraven:dev-simulate-before-quit"));
		setLog(
			"Dispatched roadraven:dev-simulate-before-quit (dev event only — use Cmd+Q for real before-quit)",
		);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<strong>Plan 04c — Shell</strong>
			<div style={{ fontSize: 10, opacity: 0.8 }}>
				filePath: <code>{filePath ?? "(null)"}</code>
				<br />
				isUntitled: <code>{String(isUntitled)}</code>
			</div>
			<button type="button" onClick={doNew}>
				File &gt; New
			</button>
			<button type="button" onClick={simulateExternalChange}>
				Simulate external file change
			</button>
			<button type="button" onClick={triggerBeforeQuit}>
				Trigger before-quit (dev event)
			</button>
			<pre
				style={{
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 4,
					fontSize: 10,
					whiteSpace: "pre-wrap",
				}}
			>
				{log}
			</pre>
		</div>
	);
}
