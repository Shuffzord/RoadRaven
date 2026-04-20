import { useState } from "react";
import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

/**
 * Plan 03-01 mid-plan UAT surface. Exposes every NEW public action shipped by
 * the mutation plan as a clickable button. Auto-discovered by DevHarness via
 * `import.meta.glob("./*Panel.tsx")`.
 *
 * Target resolution: focused > selected > root. moveUp/Down are no-ops on the
 * root (no siblings) — the panel surfaces this so the user doesn't think the
 * action is broken when they're actually just testing against the wrong node.
 *
 * Dev-only: mounted by DevHarness, which itself is gated by
 * `import.meta.env.DEV` at the App.tsx mount site (Plan 04a wires this in).
 */
export function MutationsPanel() {
	const schema = useRoadmapStore((s) => s.schema);
	const focusedNodeId = useRoadmapStore((s) => s.focusedNodeId);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const [lastAction, setLastAction] = useState<string>("(no action yet)");

	const rootId = schema?.nodes?.[0]?.id ?? null;
	const targetId = focusedNodeId ?? selectedNodeId ?? rootId;
	const targetSource = focusedNodeId
		? "focused"
		: selectedNodeId
			? "selected"
			: "root";
	const isRootTarget = targetId === rootId && targetId !== null;

	if (!targetId) {
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
				Target ({targetSource}): {targetId.slice(0, 8)}…
				{isRootTarget ? " — root: moveUp/Down will be no-ops" : ""}
			</div>
			<div style={{ fontSize: 10, opacity: 0.6 }}>
				Tip: click a node in the canvas to retarget these buttons.
			</div>
			<button
				type="button"
				onClick={() => run("addChild", () => void store.addChild(targetId))}
			>
				addChild
			</button>
			<button
				type="button"
				onClick={() =>
					run("addSiblingAbove", () => void store.addSiblingAbove(targetId))
				}
			>
				addSiblingAbove
			</button>
			<button
				type="button"
				onClick={() =>
					run("addSiblingBelow", () => void store.addSiblingBelow(targetId))
				}
			>
				addSiblingBelow
			</button>
			<button
				type="button"
				onClick={() =>
					run("duplicateNode", () => void store.duplicateNode(targetId))
				}
			>
				duplicateNode
			</button>
			<button
				type="button"
				onClick={() =>
					run("requestDelete", () => store.requestDelete(targetId))
				}
			>
				requestDelete
			</button>
			<button
				type="button"
				disabled={isRootTarget}
				onClick={() => run("moveNodeUp", () => store.moveNodeUp(targetId))}
			>
				moveNodeUp{isRootTarget ? " (disabled — root)" : ""}
			</button>
			<button
				type="button"
				disabled={isRootTarget}
				onClick={() => run("moveNodeDown", () => store.moveNodeDown(targetId))}
			>
				moveNodeDown{isRootTarget ? " (disabled — root)" : ""}
			</button>
			<button
				type="button"
				onClick={() =>
					run("renameNode", () =>
						store.renameNode(targetId, `Renamed from DevHarness ${Date.now()}`),
					)
				}
			>
				renameNode → "Renamed…"
			</button>
			<button
				type="button"
				onClick={() =>
					run("copySubtreeToClipboard", () =>
						void store.copySubtreeToClipboard(targetId),
					)
				}
			>
				copySubtreeToClipboard
			</button>
			<button
				type="button"
				onClick={() =>
					run("pasteFromClipboard", () =>
						void store.pasteFromClipboard(targetId),
					)
				}
			>
				pasteFromClipboard
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
