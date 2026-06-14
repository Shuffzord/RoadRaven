import { useState } from "react";
import { useFileActions } from "../hooks/useFileActions";
import { useRecentFiles } from "../hooks/useRecentFiles";
import { InfoDialog } from "./InfoDialog";

/** Extract filename from a path (browser-safe, no node:path) */
function basename(filePath: string): string {
	return filePath.split(/[\\/]/).pop() ?? filePath;
}

type InfoDialogKind = "preferences" | "help";

const INFO_DIALOG_CONTENT: Record<
	InfoDialogKind,
	{ title: string; body: string }
> = {
	preferences: {
		title: "Preferences",
		body: "Nothing here yet — stay tuned.",
	},
	help: {
		title: "Help",
		body: "Nothing here yet — stay tuned.",
	},
};

export function Sidebar() {
	const [collapsed, setCollapsed] = useState(false);
	const [activeDialog, setActiveDialog] = useState<InfoDialogKind | null>(null);
	const recentFiles = useRecentFiles();
	const { openRecent } = useFileActions();

	const dialogContent = activeDialog ? INFO_DIALOG_CONTENT[activeDialog] : null;

	return (
		<nav
			className={`[grid-area:sidebar] bg-rv-bg-surface border-r border-rv-border z-[50] flex flex-col overflow-hidden ${
				collapsed ? "w-[48px]" : "w-[220px]"
			}`}
			style={{ transitionProperty: "width", transitionDuration: "200ms" }}
			aria-label="Sidebar navigation"
		>
			{/* Header */}
			<div className="flex items-center justify-between h-[40px] px-3 border-b border-rv-border shrink-0">
				{!collapsed && (
					<span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-tertiary">
						Explorer
					</span>
				)}
				<button
					className="flex items-center justify-center w-6 h-6 rounded-[4px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150 ml-auto"
					type="button"
					onClick={() => setCollapsed(!collapsed)}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					title="Ctrl+B"
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

			{/* Content */}
			<div className="flex-1 py-2 overflow-y-auto">
				{/* Recent Files section */}
				<SectionHeader label="Recent Files" collapsed={collapsed} />
				{recentFiles.length === 0
					? !collapsed && (
							<div className="text-[12px] text-rv-text-tertiary px-3.5 py-[5px]">
								No recent files
							</div>
						)
					: recentFiles.map((filePath) => (
							<FileItem
								key={filePath}
								name={basename(filePath)}
								title={filePath}
								collapsed={collapsed}
								onClick={() => openRecent(filePath)}
							/>
						))}
			</div>

			{/* Bottom section */}
			<div className="border-t border-rv-border p-2 shrink-0">
				<BottomButton
					icon={<SettingsIcon />}
					label="Preferences"
					collapsed={collapsed}
					onClick={() => setActiveDialog("preferences")}
				/>
				<BottomButton
					icon={<HelpIcon />}
					label="Help"
					collapsed={collapsed}
					onClick={() => setActiveDialog("help")}
				/>
			</div>

			<InfoDialog
				open={dialogContent !== null}
				onClose={() => setActiveDialog(null)}
				title={dialogContent?.title ?? ""}
				body={dialogContent?.body ?? ""}
			/>
		</nav>
	);
}

function SectionHeader({
	label,
	collapsed,
}: {
	label: string;
	collapsed: boolean;
}) {
	if (collapsed) return null;
	return (
		<div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rv-text-tertiary px-3.5 py-1.5">
			{label}
		</div>
	);
}

function FileItem({
	name,
	collapsed,
	title,
	onClick,
}: {
	name: string;
	collapsed: boolean;
	title?: string;
	onClick?: () => void;
}) {
	return (
		<button
			className={`flex items-center w-full text-rv-text-secondary text-[12px] hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150 ${
				collapsed ? "justify-center py-1.5" : "gap-2 px-3.5 py-[5px]"
			}`}
			type="button"
			title={title}
			aria-label={collapsed ? name : undefined}
			onClick={onClick}
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
			{!collapsed && <span className="truncate">{name}</span>}
		</button>
	);
}

function BottomButton({
	icon,
	label,
	collapsed,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	collapsed: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			className={`flex items-center w-full rounded-[6px] text-[12px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150 ${
				collapsed ? "justify-center py-1.5" : "gap-2 px-2 py-1.5"
			}`}
			type="button"
			onClick={onClick}
			aria-label={collapsed ? label : undefined}
			title={collapsed ? label : undefined}
		>
			{icon}
			{!collapsed && <span>{label}</span>}
		</button>
	);
}

function SettingsIcon() {
	return (
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
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</svg>
	);
}

function HelpIcon() {
	return (
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
			<circle cx="12" cy="12" r="10" />
			<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	);
}
