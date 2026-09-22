import * as ContextMenu from "@radix-ui/react-context-menu";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { clearRecentFiles, removeRecentFile } from "../hooks/useFileActions";
import { useRecentFiles } from "../hooks/useRecentFiles";
import { formatShortcut, getFileCommand } from "../lib/fileCommands";
import { basename } from "../lib/filePath";
import { trackMenuFocus } from "../lib/focusHandoff";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";
import { useToastStore } from "../store/toastStore";
import {
	SIDEBAR_MAX_WIDTH,
	SIDEBAR_MIN_WIDTH,
	useUiStore,
} from "../store/uiStore";
import { ITEM_CLASS, MENU_SURFACE_CLASS, SEP_CLASS } from "./menuStyles";
import { Outline } from "./Outline";
import { ResizeHandle } from "./ResizeHandle";

type Section = "recent" | "outline";

const RAIL_WIDTH = 48;

/**
 * The nav's width style. It animates on collapse/expand only: from the first
 * drag step until mouseup the transition is off, or the edge lags the cursor.
 */
function useNavStyle(collapsed: boolean): {
	style: React.CSSProperties;
	setResizing: (resizing: boolean) => void;
} {
	const sidebarWidth = useUiStore((s) => s.sidebarWidth);
	const [resizing, setResizing] = useState(false);
	return {
		style: {
			width: collapsed ? RAIL_WIDTH : sidebarWidth,
			transitionProperty: resizing ? "none" : "width",
			transitionDuration: "200ms",
		},
		setResizing,
	};
}

export function Sidebar() {
	// v0.8.2 F3: collapse state lives in uiStore so Ctrl+B (keyboard router)
	// toggles the same flag as the header button.
	const collapsed = useUiStore((s) => s.sidebarCollapsed);
	const toggleSidebar = useUiStore((s) => s.toggleSidebar);
	const { style: navStyle, setResizing } = useNavStyle(collapsed);
	const currentPath = useRoadmapStore((s) => s.filePath);
	const recentFiles = useRecentFiles();
	const recentHeaderRef = useRef<HTMLDivElement>(null);
	const outlineHeaderRef = useRef<HTMLDivElement>(null);
	// The section a rail icon asked for; scrolled to once the expanded layout
	// has rendered, since the headers do not exist while collapsed.
	const pendingSection = useRef<Section | null>(null);

	useEffect(() => {
		if (collapsed || !pendingSection.current) return;
		const header =
			pendingSection.current === "recent" ? recentHeaderRef : outlineHeaderRef;
		pendingSection.current = null;
		header.current?.scrollIntoView({ block: "start" });
	}, [collapsed]);

	const expandTo = (section: Section): void => {
		pendingSection.current = section;
		toggleSidebar();
	};

	return (
		<nav
			className="[grid-area:sidebar] relative bg-rv-bg-surface border-r border-rv-border z-[50] flex flex-col overflow-hidden"
			style={navStyle}
			aria-label="Sidebar navigation"
		>
			<SidebarResizeHandle onResizingChange={setResizing} />
			{/* Header */}
			<div className="flex items-center justify-between h-[40px] px-3 border-b border-rv-border shrink-0">
				{!collapsed && (
					<span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-tertiary">
						Files
					</span>
				)}
				<button
					className="flex items-center justify-center w-6 h-6 rounded-[4px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150 ml-auto"
					type="button"
					onClick={toggleSidebar}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					title={formatShortcut("B")}
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
						className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
			</div>

			{collapsed ? (
				// Rail: one icon per section, each expanding straight to it.
				<div className="flex flex-col items-center gap-1 py-2">
					<RailButton label="Recent Files" onClick={() => expandTo("recent")}>
						<ClockIcon />
					</RailButton>
					<RailButton label="Outline" onClick={() => expandTo("outline")}>
						<ListTreeIcon />
					</RailButton>
				</div>
			) : (
				// Content — flex column so the Outline scrolls on its own below the
				// Recent Files list instead of sharing one scroll container.
				<div className="flex-1 py-2 overflow-y-auto flex flex-col min-h-0">
					<SectionHeader ref={recentHeaderRef} label="Recent Files" />
					{recentFiles.length === 0 ? (
						<div className="text-[12px] text-rv-text-tertiary px-3.5 py-[5px]">
							No recent files
						</div>
					) : (
						recentFiles.map((path) => (
							<RecentFileRow
								key={path}
								path={path}
								isCurrent={path === currentPath}
							/>
						))
					)}

					<SectionHeader ref={outlineHeaderRef} label="Outline" />
					<Outline collapsed={collapsed} />
				</div>
			)}
		</nav>
	);
}

/**
 * Drag handle on the sidebar's right edge; persists the width on release.
 * Absent while collapsed — the rail is fixed at 48px.
 */
function SidebarResizeHandle({
	onResizingChange,
}: {
	onResizingChange: (resizing: boolean) => void;
}) {
	const collapsed = useUiStore((s) => s.sidebarCollapsed);
	const sidebarWidth = useUiStore((s) => s.sidebarWidth);
	const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
	const resetSidebarWidth = useUiStore((s) => s.resetSidebarWidth);

	const persistWidth = (): void => {
		electroview?.rpc?.request
			.saveSettings({
				settings: { sidebarWidth: useUiStore.getState().sidebarWidth },
			})
			.catch(() => {
				// RPC unavailable outside Electrobun (HMR dev server).
			});
	};

	if (collapsed) return null;
	return (
		<ResizeHandle
			side="right"
			aria-label="Resize sidebar"
			minWidth={SIDEBAR_MIN_WIDTH}
			maxWidth={SIDEBAR_MAX_WIDTH}
			currentWidth={sidebarWidth}
			onResize={(width) => {
				onResizingChange(true);
				setSidebarWidth(width);
			}}
			onResizeEnd={() => {
				onResizingChange(false);
				persistWidth();
			}}
			onReset={() => {
				resetSidebarWidth();
				persistWidth();
			}}
		/>
	);
}

function SectionHeader({
	label,
	ref,
}: {
	label: string;
	ref: Ref<HTMLDivElement>;
}) {
	return (
		<div
			ref={ref}
			className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rv-text-tertiary px-3.5 py-1.5"
		>
			{label}
		</div>
	);
}

/** A4: Reveal for a recent entry that need not be the open file. */
async function revealRecentFile(path: string): Promise<void> {
	const result = await electroview?.rpc?.request.revealInFolder({ path });
	if (!result?.ok) {
		useToastStore.getState().pushToast({
			type: "file_error",
			source: "file",
			detail: "File not found on disk.",
		});
	}
}

function RecentFileRow({
	path,
	isCurrent,
}: {
	path: string;
	isCurrent: boolean;
}) {
	const open = (): void => {
		void getFileCommand("openRecent").run(path);
	};
	return (
		// Same close contract as the canvas and File menus: Radix's own focus
		// restore is off and lib/focusHandoff.ts hands focus back instead.
		<ContextMenu.Root onOpenChange={trackMenuFocus}>
			<ContextMenu.Trigger asChild>
				<button
					className={`flex items-center w-full gap-2 px-3.5 py-[5px] text-[12px] transition-colors duration-150 ${
						isCurrent
							? "bg-rv-bg-hover text-rv-text-primary"
							: "text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary"
					}`}
					type="button"
					title={path}
					aria-current={isCurrent ? "true" : undefined}
					onClick={open}
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
						className="text-rv-text-tertiary shrink-0"
					>
						<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
						<polyline points="14 2 14 8 20 8" />
					</svg>
					<span className="truncate">{basename(path)}</span>
				</button>
			</ContextMenu.Trigger>
			<ContextMenu.Portal>
				<ContextMenu.Content
					className={MENU_SURFACE_CLASS}
					aria-label="Recent file actions"
					collisionPadding={8}
					onCloseAutoFocus={(event) => event.preventDefault()}
				>
					<ContextMenu.Item className={ITEM_CLASS} onSelect={open}>
						<span>Open</span>
					</ContextMenu.Item>
					<ContextMenu.Item
						className={ITEM_CLASS}
						onSelect={() => {
							void revealRecentFile(path);
						}}
					>
						<span>Reveal in Folder</span>
					</ContextMenu.Item>
					<ContextMenu.Separator className={SEP_CLASS} />
					<ContextMenu.Item
						className={ITEM_CLASS}
						onSelect={() => {
							void removeRecentFile(path);
						}}
					>
						<span>Remove from Recent</span>
					</ContextMenu.Item>
					<ContextMenu.Item
						className={ITEM_CLASS}
						onSelect={() => {
							void clearRecentFiles();
						}}
					>
						<span>Clear Recent</span>
					</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Portal>
		</ContextMenu.Root>
	);
}

function RailButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			className="flex items-center justify-center w-8 h-8 rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150"
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			{children}
		</button>
	);
}

function ClockIcon() {
	return (
		<svg
			aria-hidden="true"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	);
}

function ListTreeIcon() {
	return (
		<svg
			aria-hidden="true"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 12h-8" />
			<path d="M21 6H8" />
			<path d="M21 18h-8" />
			<path d="M3 6v4c0 1.1.9 2 2 2h3" />
			<path d="M3 10v6c0 1.1.9 2 2 2h3" />
		</svg>
	);
}
