import { useState } from "react";
import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

export function EditorPanel() {
	const schema = useRoadmapStore((s) => s.schema);
	const statusTick = useRoadmapStore((s) => s.statusTick);
	const dataKey = useRoadmapStore((s) => s.dataKey);
	const rootId = schema?.nodes?.[0]?.id ?? null;
	const [status, setStatus] = useState<string>("(no action yet)");

	if (!rootId) {
		return (
			<div style={{ fontSize: 11, opacity: 0.8 }}>
				Load a schema first (File → Open, or drop JSON on the app).
			</div>
		);
	}

	const store = useRoadmapStore.getState();
	const rootNode = store.nodeIndex.get(rootId);

	const run = (label: string, fn: () => void) => {
		fn();
		setStatus(label);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<strong>Plan 03 — Editor</strong>
			<div style={{ fontSize: 10, opacity: 0.8 }}>
				root title: {rootNode?.title}
				<br />
				type: {rootNode?.type ?? "(unset)"} | status: {rootNode?.status}
				<br />
				dataKey: {dataKey} | statusTick: {statusTick}
			</div>
			<button
				type="button"
				onClick={() =>
					run("renameNode (structural bump)", () =>
						store.renameNode(rootId, `From DevHarness ${Date.now()}`),
					)
				}
			>
				Edit title
			</button>
			<button
				type="button"
				onClick={() =>
					run("updateNodeNotes (in-place, 1s autosave debounce)", () =>
						store.updateNodeNotes(
							rootId,
							`# From DevHarness\n\nNotes at ${Date.now()}`,
						),
					)
				}
			>
				Edit notes
			</button>
			<button
				type="button"
				onClick={() =>
					run("updateNodeMetadata (in-place)", () =>
						store.updateNodeMetadata(rootId, {
							priority: "high",
							updatedBy: "devharness",
						}),
					)
				}
			>
				Edit metadata
			</button>
			<button
				type="button"
				onClick={() =>
					run("updateNodeType=epic (in-place)", () =>
						store.updateNodeType(rootId, "epic"),
					)
				}
			>
				Set type=epic
			</button>
			<button
				type="button"
				onClick={() =>
					run("updateNodeStatus=in-progress (in-place)", () =>
						store.updateNodeStatus(rootId, "in-progress"),
					)
				}
			>
				Change status
			</button>
			<pre
				style={{
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 4,
					fontSize: 10,
					margin: 0,
				}}
			>
				{status}
			</pre>
		</div>
	);
}
