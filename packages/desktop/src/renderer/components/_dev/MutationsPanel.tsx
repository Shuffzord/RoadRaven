import { useState } from "react";
import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

/**
 * Plan 03-01 mid-plan UAT surface. Exposes every NEW public action shipped by
 * the mutation plan as a clickable button. Auto-discovered by DevHarness via
 * `import.meta.glob("./*Panel.tsx")`.
 *
 * Dev-only: mounted by DevHarness, which itself is gated by
 * `import.meta.env.DEV` at the App.tsx mount site (Plan 04a wires this in).
 */
export function MutationsPanel() {
	const schema = useRoadmapStore((s) => s.schema);
	const [lastAction, setLastAction] = useState<string>("(no action yet)");
	const rootId = schema?.nodes?.[0]?.id ?? null;

	if (!rootId) {
		return <div>No schema loaded. Load via File menu or fixtures.</div>;
	}

	const run = (label: string, fn: () => void) => {
		fn();
		setLastAction(label);
	};
	const store = useRoadmapStore.getState();

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<strong>Plan 01 — Mutations</strong>
			<div style={{ fontSize: 10, opacity: 0.8 }}>
				Target: rootId = {rootId.slice(0, 8)}…
			</div>
			<button
				type="button"
				onClick={() => run("addChild", () => void store.addChild(rootId))}
			>
				addChild(root)
			</button>
			<button
				type="button"
				onClick={() =>
					run("addSiblingAbove", () => void store.addSiblingAbove(rootId))
				}
			>
				addSiblingAbove(root)
			</button>
			<button
				type="button"
				onClick={() =>
					run("addSiblingBelow", () => void store.addSiblingBelow(rootId))
				}
			>
				addSiblingBelow(root)
			</button>
			<button
				type="button"
				onClick={() =>
					run("duplicateNode", () => void store.duplicateNode(rootId))
				}
			>
				duplicateNode(root)
			</button>
			<button
				type="button"
				onClick={() => run("requestDelete", () => store.requestDelete(rootId))}
			>
				requestDelete(root)
			</button>
			<button
				type="button"
				onClick={() => run("moveNodeUp", () => store.moveNodeUp(rootId))}
			>
				moveNodeUp(root)
			</button>
			<button
				type="button"
				onClick={() => run("moveNodeDown", () => store.moveNodeDown(rootId))}
			>
				moveNodeDown(root)
			</button>
			<button
				type="button"
				onClick={() =>
					run("renameNode", () =>
						store.renameNode(rootId, `Renamed from DevHarness ${Date.now()}`),
					)
				}
			>
				renameNode(root, "Renamed…")
			</button>
			<button
				type="button"
				onClick={() =>
					run("copySubtreeToClipboard", () =>
						void store.copySubtreeToClipboard(rootId),
					)
				}
			>
				copySubtreeToClipboard(root)
			</button>
			<button
				type="button"
				onClick={() =>
					run("pasteFromClipboard", () =>
						void store.pasteFromClipboard(rootId),
					)
				}
			>
				pasteFromClipboard(root)
			</button>
			<pre
				data-testid="mutations-panel-output"
				style={{
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 4,
					fontSize: 10,
				}}
			>
				Last action: {lastAction}
			</pre>
		</div>
	);
}
