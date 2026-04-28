import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import { useEventApiStore } from "../store/eventApiStore";
import { getFilteredRows, useEventLogStore } from "../store/eventLogStore";
import { useRoadmapStore } from "../store/roadmapStore";
import { EventLogFilterBar } from "./EventLogFilterBar";
import { EventLogRow } from "./EventLogRow";

/** Empty-state helper — plain section with headline + body. */
function EmptyDrawer({
	headline,
	body,
	height,
}: {
	headline: string;
	body: string;
	height: number;
}) {
	return (
		<section
			aria-label="Event log"
			style={{
				position: "fixed",
				bottom: 32,
				left: 0,
				right: 0,
				height,
				background: "var(--rv-bg-panel)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				gap: 8,
				zIndex: 200,
			}}
		>
			<CloseButton />
			<div
				style={{
					fontSize: 13,
					color: "var(--rv-text-secondary)",
					fontWeight: 600,
					textAlign: "center",
				}}
			>
				{headline}
			</div>
			<div
				style={{
					fontSize: 11,
					color: "var(--rv-text-tertiary)",
					textAlign: "center",
					maxWidth: 480,
				}}
			>
				{body}
			</div>
		</section>
	);
}

/** [×] close button rendered in the top-right of every drawer state (UAT 04-06 drive-by). */
function CloseButton() {
	return (
		<button
			type="button"
			aria-label="Close event log"
			onClick={() => useEventLogStore.getState().setOpen(false)}
			style={{
				position: "absolute",
				top: 4,
				right: 8,
				background: "none",
				border: "none",
				cursor: "pointer",
				padding: "4px 6px",
				color: "var(--rv-text-secondary)",
				fontSize: 14,
				lineHeight: 1,
				borderRadius: 4,
				zIndex: 1,
			}}
			className="hover:bg-[var(--rv-bg-hover)] transition-colors duration-100"
		>
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<title>Close</title>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	);
}

/** 4px drag handle at the top edge for resizing the drawer. */
function ResizeHandle() {
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		const startY = e.clientY;
		const startHeight = useEventLogStore.getState().drawerHeightPx;

		const onMouseMove = (mv: MouseEvent) => {
			const delta = startY - mv.clientY; // drag up = increase height
			useEventLogStore.getState().setDrawerHeightPx(startHeight + delta);
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	}, []);

	return (
		<div
			onMouseDown={handleMouseDown}
			style={{
				height: 4,
				flexShrink: 0,
				cursor: "row-resize",
				background: "var(--rv-border-subtle)",
			}}
			aria-hidden="true"
		/>
	);
}

export function EventLogDrawer() {
	const isOpen = useEventLogStore((s) => s.isOpen);
	const drawerHeightPx = useEventLogStore((s) => s.drawerHeightPx);
	const rows = useEventLogStore((s) => s.rows);
	const filter = useEventLogStore((s) => s.filter);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const apiStatus = useEventApiStore((s) => s.status);
	const apiPort = useEventApiStore((s) => s.port);

	const filtered = useMemo(
		() => getFilteredRows(rows, filter, selectedNodeId),
		[rows, filter, selectedNodeId],
	);

	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const scrollRef = useRef<HTMLDivElement>(null);

	// Pitfall 9: stable getScrollElement callback to avoid measurement storm
	const getScrollElement = useCallback(() => scrollRef.current, []);

	const virtualizer = useVirtualizer({
		count: filtered.length,
		getScrollElement,
		// Fixed 32px row height — avoids measurement storm (Pitfall 9 / T-04-04-03).
		// Expanded rows are variable height but rare; we accept the small scroll
		// imprecision vs. the infinite-loop risk of dynamic measurement in jsdom.
		estimateSize: () => 32,
	});

	const filterSummary = filter.source
		? `From ${filter.source}`
		: filter.selectedNodeOnly
			? "Selected node"
			: "All sources";

	// If the drawer is closed, don't render
	if (!isOpen) return null;

	// Collapsed strip mode (drawerHeightPx === 24)
	if (drawerHeightPx <= 24) {
		const expandDrawer = () =>
			useEventLogStore
				.getState()
				.setDrawerHeightPx(
					Math.floor(
						(typeof window !== "undefined" ? window.innerHeight : 1000) * 0.3,
					),
				);

		return (
			<section
				aria-label="Event log"
				style={{
					position: "fixed",
					bottom: 32,
					left: 0,
					right: 0,
					height: 24,
					background: "var(--rv-bg-panel)",
					display: "flex",
					alignItems: "center",
					padding: "0 12px",
					zIndex: 200,
					borderTop: "1px solid var(--rv-border-subtle)",
				}}
			>
				<button
					type="button"
					onClick={expandDrawer}
					style={{
						display: "flex",
						alignItems: "center",
						width: "calc(100% - 32px)",
						paddingRight: 32,
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: 0,
						textAlign: "left",
					}}
					aria-label="Expand event log"
				>
					<span style={{ fontSize: 11, color: "var(--rv-text-secondary)" }}>
						Events · {filtered.length} shown · {filterSummary}
					</span>
					<span style={{ marginLeft: "auto", fontSize: 11 }}>▴</span>
				</button>
				<CloseButton />
			</section>
		);
	}

	// Empty states per UI-SPEC
	if (apiStatus === "off") {
		return (
			<EmptyDrawer
				height={drawerHeightPx}
				headline="Event API is not running."
				body="Check the logs at the user data directory for startup errors."
			/>
		);
	}

	if (apiStatus === "error") {
		return (
			<EmptyDrawer
				height={drawerHeightPx}
				headline={`Port ${apiPort ?? ""} is in use.`}
				body="Set a different port via ROADRAVEN_EVENT_PORT or the eventApi.port setting, then restart the app."
			/>
		);
	}

	if (rows.length === 0) {
		return (
			<EmptyDrawer
				height={drawerHeightPx}
				headline="No events received yet."
				body={`The app is listening on ws://127.0.0.1:${apiPort ?? 47921}. Copy the URL from the status bar and push an event from your producer.`}
			/>
		);
	}

	if (filtered.length === 0) {
		return (
			<section
				aria-label="Event log"
				style={{
					position: "fixed",
					bottom: 32,
					left: 0,
					right: 0,
					height: drawerHeightPx,
					background: "var(--rv-bg-panel)",
					display: "flex",
					flexDirection: "column",
					zIndex: 200,
					borderTop: "1px solid var(--rv-border-subtle)",
				}}
			>
				<CloseButton />
				<ResizeHandle />
				<EventLogFilterBar />
				<div
					style={{
						padding: 16,
						display: "flex",
						flexDirection: "column",
						gap: 8,
					}}
				>
					<div style={{ fontSize: 13, color: "var(--rv-text-secondary)" }}>
						No events match these filters.
					</div>
					<button
						type="button"
						onClick={() => useEventLogStore.getState().clearFilters()}
						style={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: "var(--rv-accent)",
							fontSize: 11,
							padding: 0,
							alignSelf: "flex-start",
						}}
					>
						Clear filters
					</button>
				</div>
			</section>
		);
	}

	return (
		<section
			aria-label="Event log"
			style={{
				position: "fixed",
				bottom: 32,
				left: 0,
				right: 0,
				height: drawerHeightPx,
				background: "var(--rv-bg-panel)",
				display: "flex",
				flexDirection: "column",
				zIndex: 200,
				borderTop: "1px solid var(--rv-border-subtle)",
			}}
		>
			<CloseButton />
			<ResizeHandle />
			<EventLogFilterBar />

			{/* Virtualized list */}
			<div ref={scrollRef} style={{ flex: 1, overflow: "auto" }}>
				<div
					style={{
						height: virtualizer.getTotalSize(),
						position: "relative",
					}}
				>
					{virtualizer.getVirtualItems().map((vi) => {
						const row = filtered[vi.index];
						const key = `${row.nodeId}__${row.timestamp ?? vi.index}`;
						const isExpanded = expandedKeys.has(key);

						return (
							<div
								key={vi.key}
								data-index={vi.index}
								ref={virtualizer.measureElement}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									transform: `translateY(${vi.start}px)`,
									width: "100%",
								}}
							>
								<EventLogRow
									row={row}
									isSelected={row.nodeId === selectedNodeId}
									expanded={isExpanded}
									onClick={() => {
										// I-11 resolution: setSelectedNode triggers Canvas.tsx's
										// existing `focusedNodeId ?? selectedNodeId` effect (lines
										// 141-143) which pans the viewport when the target node is
										// off-screen. Action name verified as `setSelectedNode`
										// (roadmapStore.ts:702), NOT `setSelectedNodeId`.
										useRoadmapStore.getState().setSelectedNode(row.nodeId);
									}}
									onToggleExpand={() => {
										setExpandedKeys((prev) => {
											const next = new Set(prev);
											if (next.has(key)) next.delete(key);
											else next.add(key);
											return next;
										});
									}}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
