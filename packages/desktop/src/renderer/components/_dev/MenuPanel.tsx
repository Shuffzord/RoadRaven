import { useState } from "react";
import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

type Status = "not-started" | "in-progress" | "completed" | "blocked";
const STATUSES: readonly Status[] = [
	"not-started",
	"in-progress",
	"completed",
	"blocked",
];

/**
 * Plan 03-02 mid-plan UAT surface. Exposes programmatic triggers for the
 * Radix context menu (node + canvas variants) and a status cycler so the
 * UAT checkpoint in Task 5 can click through without needing to right-click
 * real canvas geometry. Auto-discovered by DevHarness via
 * `import.meta.glob("./*Panel.tsx")`.
 *
 * Dev-only: mounted by DevHarness, which itself is gated by
 * `import.meta.env.DEV` at the App.tsx mount site.
 */
export function MenuPanel() {
	const schema = useRoadmapStore((s) => s.schema);
	const [status, setStatus] = useState<string>("(no menu opened yet)");
	const rootId = schema?.nodes?.[0]?.id ?? null;

	const openAtFixedCoords = (
		targetSelector: string,
		x: number,
		y: number,
		label: string,
	) => {
		const el = document.querySelector(targetSelector) as HTMLElement | null;
		if (!el) {
			setStatus(`Selector not found: ${targetSelector}`);
			return;
		}
		el.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: x,
				clientY: y,
				button: 2,
			}),
		);
		setStatus(`${label} @ (${x},${y})`);
	};

	const cycleStatus = () => {
		if (!rootId) {
			setStatus("No schema loaded — cannot cycle status");
			return;
		}
		const current =
			useRoadmapStore.getState().nodeIndex.get(rootId)?.status ?? "not-started";
		const idx = STATUSES.indexOf(current as Status);
		const next = STATUSES[(idx + 1) % STATUSES.length];
		useRoadmapStore.getState().updateNodeStatus(rootId, next);
		setStatus(`Status on root cycled: ${current} → ${next}`);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<strong>Plan 02 — Menu</strong>
			<div style={{ fontSize: 10, opacity: 0.6 }}>
				Tip: the coordinate buttons dispatch a synthetic contextmenu on the
				first matching element. Right-clicking a real node on the canvas works
				too — this panel just gives a deterministic target for UAT.
			</div>
			<button
				type="button"
				onClick={() =>
					openAtFixedCoords("[data-source-id]", 400, 300, "Opened node menu")
				}
			>
				Open node context menu @ (400,300)
			</button>
			<button
				type="button"
				onClick={() =>
					openAtFixedCoords(
						'[role="application"]',
						100,
						100,
						"Opened canvas menu",
					)
				}
			>
				Open canvas context menu @ (100,100)
			</button>
			<button type="button" onClick={cycleStatus}>
				Cycle status on root
			</button>
			<pre
				style={{
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 4,
					fontSize: 10,
				}}
			>
				{status}
			</pre>
		</div>
	);
}
