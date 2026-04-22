import { useCallback, useEffect, useRef, useState } from "react";
import { useRoadmapStore } from "../store/roadmapStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { MetadataEditor } from "./MetadataEditor";
import { NotesEditor } from "./NotesEditor";
import { ResizeHandle } from "./ResizeHandle";
import { formatStatus, STATUS_TOKEN_MAP } from "./RoadmapNode";

const FLASH_MS = 2000;

type EditableField = "title" | "status" | "type" | "metadata" | "notes";

function isTextInputFocused(): boolean {
	const el = document.activeElement;
	if (!el || !(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	const tag = el.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function SavedFlash({ visible }: { visible: boolean }) {
	if (!visible) return null;
	return (
		<span
			role="status"
			aria-live="polite"
			className="inline-flex items-center text-rv-status-completed text-[11px] motion-safe:animate-[fadeIn_150ms_ease-out]"
		>
			<svg
				width="10"
				height="10"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
			<span className="ml-1">saved</span>
		</span>
	);
}

interface SidePanelProps {
	isOpen: boolean;
	onClose: () => void;
}

const DEFAULT_STATUSES = [
	{ id: "not-started", label: "Not Started" },
	{ id: "in-progress", label: "In Progress" },
	{ id: "completed", label: "Completed" },
	{ id: "blocked", label: "Blocked" },
] as const;

function formatDate(dateStr: string | undefined): string {
	if (!dateStr) return "N/A";
	try {
		const d = new Date(dateStr);
		if (Number.isNaN(d.getTime())) return "N/A";
		return d.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return "N/A";
	}
}

export function SidePanel({ isOpen, onClose }: SidePanelProps) {
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const nodeIndex = useRoadmapStore((s) => s.nodeIndex);
	useRoadmapStore((s) => s.statusTick);
	useRoadmapStore((s) => s.dataKey);
	const schema = useRoadmapStore((s) => s.schema);
	const selectedNode = selectedNodeId
		? nodeIndex.get(selectedNodeId)
		: undefined;

	const [width, setWidth] = useState(340);
	const [copied, setCopied] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const cancellingRef = useRef(false);
	const [flashedFields, setFlashedFields] = useState<Set<EditableField>>(
		() => new Set(),
	);
	const flashTimersRef = useRef<
		Map<EditableField, ReturnType<typeof setTimeout>>
	>(new Map());

	const flash = useCallback((field: EditableField) => {
		const existing = flashTimersRef.current.get(field);
		if (existing) clearTimeout(existing);
		setFlashedFields((prev) => {
			if (prev.has(field)) return prev;
			const next = new Set(prev);
			next.add(field);
			return next;
		});
		const timer = setTimeout(() => {
			flashTimersRef.current.delete(field);
			setFlashedFields((prev) => {
				if (!prev.has(field)) return prev;
				const next = new Set(prev);
				next.delete(field);
				return next;
			});
		}, FLASH_MS);
		flashTimersRef.current.set(field, timer);
	}, []);

	useEffect(() => {
		return () => {
			for (const t of flashTimersRef.current.values()) clearTimeout(t);
			flashTimersRef.current.clear();
		};
	}, []);

	const maxWidth =
		typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.5) : 480;

	useEffect(() => {
		setIsEditing(false);
		setTitleDraft(selectedNode?.title ?? "");
	}, [selectedNode?.title]);

	useEffect(() => {
		if (!isEditing) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				cancellingRef.current = true;
				setIsEditing(false);
				setTitleDraft(selectedNode?.title ?? "");
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [isEditing, selectedNode?.title]);

	// E shortcut to enter edit mode (D-10). Skipped when text input focused
	// (D-08 context-aware) or already editing.
	useEffect(() => {
		if (!isOpen || !selectedNode || isEditing) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key !== "e" && e.key !== "E") return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isTextInputFocused()) return;
			e.preventDefault();
			setIsEditing(true);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen, selectedNode, isEditing]);

	const handleCopyId = useCallback(async () => {
		if (!selectedNode) return;
		await navigator.clipboard.writeText(selectedNode.id);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	}, [selectedNode]);

	const handleTitleCommit = useCallback(() => {
		if (cancellingRef.current) {
			cancellingRef.current = false;
			return;
		}
		if (!selectedNode) return;
		const trimmed = titleDraft.trim();
		if (trimmed && trimmed !== selectedNode.title) {
			useRoadmapStore.getState().renameNode(selectedNode.id, trimmed);
			flash("title");
		}
	}, [titleDraft, selectedNode, flash]);

	const handleStatusChange = useCallback(
		(next: string) => {
			if (!selectedNode) return;
			useRoadmapStore.getState().updateNodeStatus(selectedNode.id, next);
			flash("status");
		},
		[selectedNode, flash],
	);

	const handleTypeChange = useCallback(
		(next: string) => {
			if (!selectedNode) return;
			useRoadmapStore.getState().updateNodeType(selectedNode.id, next);
			flash("type");
		},
		[selectedNode, flash],
	);

	const handleMetadataChange = useCallback(
		(next: Record<string, unknown>) => {
			if (!selectedNode) return;
			useRoadmapStore.getState().updateNodeMetadata(selectedNode.id, next);
			flash("metadata");
		},
		[selectedNode, flash],
	);

	const handleNotesPersist = useCallback(
		(id: string, content: string) => {
			useRoadmapStore.getState().updateNodeNotes(id, content);
			flash("notes");
		},
		[flash],
	);

	const status = selectedNode?.status ?? "not-started";
	const tokens =
		STATUS_TOKEN_MAP[status as keyof typeof STATUS_TOKEN_MAP] ??
		STATUS_TOKEN_MAP["not-started"];
	const statuses = schema?.statusConfig?.length
		? schema.statusConfig
		: DEFAULT_STATUSES;
	const types = schema?.typeConfig ?? [];
	const metadata = selectedNode?.metadata ?? {};

	return (
		<aside
			className="[grid-area:panel] bg-rv-bg-panel border-l border-rv-border z-[50] overflow-hidden flex flex-col relative"
			style={{
				width: isOpen ? width : 0,
				transitionProperty: "width",
				transitionDuration: "200ms",
				transitionTimingFunction: "ease-out",
				boxShadow: isOpen ? "var(--rv-shadow-panel)" : "none",
			}}
			// biome-ignore lint/a11y/noRedundantRoles: plan requires explicit role="complementary" for accessibility contract
			role="complementary"
			aria-label="Node details"
		>
			{isOpen && (
				<ResizeHandle
					onResize={setWidth}
					minWidth={320}
					maxWidth={maxWidth}
					currentWidth={width}
				/>
			)}

			<div className="flex items-center justify-between min-h-[52px] px-4 py-3.5 border-b border-rv-border shrink-0">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-[14px] font-semibold text-rv-text-primary whitespace-nowrap">
						Node Details
					</span>
					{isEditing && (
						<span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-secondary">
							Editing
						</span>
					)}
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{selectedNode && !isEditing && (
						<button
							className="flex items-center justify-center w-7 h-7 rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150"
							type="button"
							onClick={() => setIsEditing(true)}
							aria-label="Edit node"
							title="Edit node (E)"
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
								<path d="M12 20h9" />
								<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
							</svg>
						</button>
					)}
					<button
						className="flex items-center justify-center w-7 h-7 rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150"
						type="button"
						onClick={onClose}
						aria-label="Close panel"
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
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</div>

			<div className="flex-1 p-4 overflow-y-auto">
				{selectedNode ? (
					<>
						<FieldLabel flashing={flashedFields.has("title")}>TITLE</FieldLabel>
						{isEditing ? (
							<input
								type="text"
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onBlur={handleTitleCommit}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleTitleCommit();
										setIsEditing(false);
									}
								}}
								aria-label="Title"
								className="w-full text-[14px] font-semibold text-rv-text-primary bg-rv-bg-input border border-rv-border rounded-[6px] px-2 py-1 mb-4 focus:border-rv-border-focus outline-none"
							/>
						) : (
							// biome-ignore lint/a11y/useKeyWithClickEvents: preview-to-edit entry parallels the explicit [E] button in header; no new keyboard path needed.
							<h2
								className="text-[14px] font-semibold text-rv-text-primary mb-4 cursor-text hover:bg-rv-bg-hover rounded px-1 -mx-1"
								onClick={() => setIsEditing(true)}
							>
								{selectedNode.title}
							</h2>
						)}

						<FieldLabel flashing={flashedFields.has("status")}>
							STATUS
						</FieldLabel>
						{isEditing ? (
							<select
								value={status}
								onChange={(e) => handleStatusChange(e.target.value)}
								aria-label="Status"
								className="w-full text-[12px] text-rv-text-primary bg-rv-bg-input border border-rv-border rounded-[6px] px-2 py-1 mb-4 focus:border-rv-border-focus outline-none"
							>
								{statuses.map((s) => (
									<option key={s.id} value={s.id}>
										{s.label}
									</option>
								))}
							</select>
						) : (
							<div className="flex items-center gap-2 px-2.5 py-1.5 bg-rv-bg-input border border-rv-border rounded-[6px] mb-4">
								<span
									className="w-2 h-2 rounded-full"
									style={{ backgroundColor: `var(${tokens.color})` }}
								/>
								<span className="text-[12px] text-rv-text-primary">
									{formatStatus(status)}
								</span>
							</div>
						)}

						<FieldLabel flashing={flashedFields.has("type")}>TYPE</FieldLabel>
						{isEditing ? (
							types.length > 0 ? (
								<select
									value={selectedNode.type ?? ""}
									onChange={(e) => handleTypeChange(e.target.value)}
									aria-label="Type"
									className="w-full text-[12px] text-rv-text-primary bg-rv-bg-input border border-rv-border rounded-[6px] px-2 py-1 mb-4 focus:border-rv-border-focus outline-none"
								>
									<option value="">(none)</option>
									{types.map((t) => (
										<option key={t.id} value={t.id}>
											{t.label}
										</option>
									))}
								</select>
							) : (
								<input
									type="text"
									value={selectedNode.type ?? ""}
									onChange={(e) => handleTypeChange(e.target.value)}
									aria-label="Type"
									placeholder="type (freeform)"
									className="w-full text-[12px] text-rv-text-primary bg-rv-bg-input border border-rv-border rounded-[6px] px-2 py-1 mb-4 focus:border-rv-border-focus outline-none"
								/>
							)
						) : (
							<div className="mb-4">
								<span className="inline-block px-2.5 py-[3px] text-[11px] font-semibold rounded-[4px] bg-rv-accent-muted text-rv-accent">
									{selectedNode.type ?? "Unknown"}
								</span>
							</div>
						)}

						<FieldLabel>CREATED</FieldLabel>
						<MetaRow label="Date" value={formatDate(selectedNode.createdAt)} />

						<FieldLabel>UPDATED</FieldLabel>
						<MetaRow label="Date" value={formatDate(selectedNode.updatedAt)} />

						<FieldLabel>ID</FieldLabel>
						<div className="flex items-center gap-2 mb-4">
							<span className="text-[12px] text-rv-text-secondary font-mono">
								{selectedNode.id}
							</span>
							<button
								className="flex items-center justify-center w-5 h-5 rounded-[4px] hover:bg-rv-bg-hover hover:text-rv-accent transition-colors duration-150 text-rv-text-tertiary"
								type="button"
								aria-label={copied ? "Node ID copied" : "Copy node ID"}
								onClick={handleCopyId}
							>
								{copied ? (
									<svg
										aria-hidden="true"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg
										aria-hidden="true"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								)}
							</button>
						</div>

						<FieldLabel flashing={flashedFields.has("metadata")}>
							METADATA
						</FieldLabel>
						{isEditing ? (
							<div className="mb-4">
								<MetadataEditor
									metadata={metadata}
									onChange={handleMetadataChange}
								/>
							</div>
						) : Object.keys(metadata).length > 0 ? (
							<div className="mb-4 flex flex-col gap-1">
								{Object.entries(metadata).map(([k, v]) => (
									<MetaRow
										key={k}
										label={k}
										value={typeof v === "string" ? v : JSON.stringify(v)}
									/>
								))}
							</div>
						) : (
							<p className="text-[13px] text-rv-text-tertiary mb-4">
								No metadata for this node.
							</p>
						)}

						<div className="h-px bg-rv-border my-4" />

						{isEditing ? (
							<NotesEditor
								nodeId={selectedNode.id}
								notes={selectedNode.notes ?? ""}
								onPersist={handleNotesPersist}
								panelWidth={width}
							/>
						) : (
							<>
								<FieldLabel flashing={flashedFields.has("notes")}>
									NOTES
								</FieldLabel>
								{selectedNode.notes ? (
									<MarkdownRenderer content={selectedNode.notes} />
								) : (
									<p className="text-[13px] leading-[1.7] text-rv-text-tertiary">
										No notes for this node.
									</p>
								)}
							</>
						)}
					</>
				) : (
					<p className="text-[13px] text-rv-text-tertiary">
						Select a node to view details.
					</p>
				)}
			</div>
		</aside>
	);
}

function FieldLabel({
	children,
	flashing = false,
}: {
	children: React.ReactNode;
	flashing?: boolean;
}) {
	return (
		<div className="flex items-center gap-2 mb-1.5">
			<span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-tertiary">
				{children}
			</span>
			<SavedFlash visible={flashing} />
		</div>
	);
}

function MetaRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2 mb-4">
			<span className="text-[12px] text-rv-text-tertiary">{label}</span>
			<span className="text-[12px] text-rv-text-secondary">{value}</span>
		</div>
	);
}
