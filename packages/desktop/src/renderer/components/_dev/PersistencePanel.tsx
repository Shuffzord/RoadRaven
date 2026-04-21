import { useState } from "react";
import type { RoadmapSchema } from "../../../../../../shared/types";
import { electroview } from "../../../mainview/rpc";

/**
 * Plan 03-04a mid-plan UAT surface. Exposes every public action shipped by
 * the persistence plan so a human verifier can click through them in dev:
 *   - Save to the cached main path
 *   - Fetch-back the current file
 *   - Load the $ref test fixture (exercises ownership map hydration)
 *   - Cross-boundary saveFile attempt (must be rejected by the allowlist)
 *
 * Dev-only: mounted by DevHarness, which itself is gated by
 * `import.meta.env.DEV` at the App.tsx mount site (Plan 01 wires this in).
 */

interface TestHook {
	getSchema?: () => RoadmapSchema | null;
	getFilePath?: () => string | null;
}

function getTestHook(): TestHook | undefined {
	return (window as unknown as { __ROADRAVEN_TEST__?: TestHook })
		.__ROADRAVEN_TEST__;
}

export function PersistencePanel() {
	const [lastOutput, setLastOutput] = useState<string>("(no action yet)");

	const saveToTmp = async () => {
		if (!electroview?.rpc) {
			setLastOutput("electroview not available (HMR browser)");
			return;
		}
		try {
			const schema = getTestHook()?.getSchema?.();
			if (!schema) {
				setLastOutput("No schema loaded. Load a file first.");
				return;
			}
			const result = await electroview.rpc.request.saveFile({ schema });
			setLastOutput(JSON.stringify(result));
		} catch (err) {
			setLastOutput(`Error: ${String(err)}`);
		}
	};

	const fetchBack = async () => {
		if (!electroview?.rpc) {
			setLastOutput("electroview not available (HMR browser)");
			return;
		}
		try {
			const path = getTestHook()?.getFilePath?.();
			if (!path) {
				setLastOutput("No file path. Load a file first.");
				return;
			}
			const result = await electroview.rpc.request.loadFile({ path });
			setLastOutput(`Loaded: ${JSON.stringify(result).slice(0, 200)}...`);
		} catch (err) {
			setLastOutput(`Error: ${String(err)}`);
		}
	};

	const toggleRefFixture = async () => {
		if (!electroview?.rpc) {
			setLastOutput("electroview not available (HMR browser)");
			return;
		}
		try {
			const result = await electroview.rpc.request.loadFile({
				path: "packages/desktop/tests/fixtures/roadmap-with-refs.json",
			});
			setLastOutput(
				`Ref fixture loaded: ${JSON.stringify(result).slice(0, 200)}`,
			);
		} catch (err) {
			setLastOutput(`Error: ${String(err)}`);
		}
	};

	const crossBoundaryAttempt = async () => {
		if (!electroview?.rpc) {
			setLastOutput("electroview not available (HMR browser)");
			return;
		}
		try {
			const result = await electroview.rpc.request.saveFile({
				schema: {
					version: "1.0",
					title: "cross-boundary test",
					nodes: [],
				},
				filePath: "/etc/passwd",
			});
			setLastOutput(
				`Traversal attempt result (expect ok:false): ${JSON.stringify(result)}`,
			);
		} catch (err) {
			setLastOutput(`Error: ${String(err)}`);
		}
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<strong>Plan 04a — Persistence</strong>
			<button type="button" onClick={() => void saveToTmp()}>
				Save to cached path
			</button>
			<button type="button" onClick={() => void fetchBack()}>
				Fetch-back current file
			</button>
			<button type="button" onClick={() => void toggleRefFixture()}>
				Load $ref fixture
			</button>
			<button type="button" onClick={() => void crossBoundaryAttempt()}>
				Cross-boundary (expect reject)
			</button>
			<pre
				data-testid="persistence-panel-output"
				style={{
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 4,
					fontSize: 10,
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
					maxHeight: 160,
					overflow: "auto",
				}}
			>
				{lastOutput}
			</pre>
		</div>
	);
}
