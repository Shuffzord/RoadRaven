import { useEffect, useState } from "react";

interface MetadataEditorProps {
	metadata: Record<string, unknown>;
	onChange: (metadata: Record<string, unknown>) => void;
}

interface Row {
	id: string;
	key: string;
	value: string;
}

let rowIdSeq = 0;
function newRowId(): string {
	rowIdSeq += 1;
	return `r${rowIdSeq}`;
}

function toRows(m: Record<string, unknown>): Row[] {
	return Object.entries(m).map(([key, value]) => ({
		id: newRowId(),
		key,
		value: typeof value === "string" ? value : JSON.stringify(value),
	}));
}

function toRecord(rows: Row[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const { key, value } of rows) {
		if (!key.trim()) continue;
		out[key] = value;
	}
	return out;
}

export function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
	const [rows, setRows] = useState<Row[]>(() => toRows(metadata));

	// Sync when the underlying metadata changes externally. Only sync when the
	// incoming metadata's serialized form differs from our current rows — this
	// prevents feedback loops where persist → onChange → parent re-renders with
	// same data → useEffect fires → rows reset (losing mid-edit in-progress keys).
	// biome-ignore lint/correctness/useExhaustiveDependencies: external-only sync; adding `rows` would feedback-loop through persist → onChange → re-enter.
	useEffect(() => {
		const incoming = toRows(metadata);
		const current = toRecord(rows);
		const next = toRecord(incoming);
		if (JSON.stringify(current) !== JSON.stringify(next)) {
			setRows(incoming);
		}
	}, [metadata]);

	const persist = (next: Row[]) => {
		setRows(next);
		onChange(toRecord(next));
	};

	if (rows.length === 0) {
		return (
			<div className="flex flex-col gap-2">
				<div className="text-[13px] text-rv-text-tertiary">
					No metadata. Click + to add a key-value pair.
				</div>
				<AddButton
					onClick={() => persist([{ id: newRowId(), key: "", value: "" }])}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-1 items-center">
				{rows.map((row) => (
					<RowControls
						key={row.id}
						row={row}
						onKeyChange={(k) =>
							persist(rows.map((r) => (r.id === row.id ? { ...r, key: k } : r)))
						}
						onValueChange={(v) =>
							persist(
								rows.map((r) => (r.id === row.id ? { ...r, value: v } : r)),
							)
						}
						onRemove={() => persist(rows.filter((r) => r.id !== row.id))}
					/>
				))}
			</div>
			<AddButton
				onClick={() =>
					persist([...rows, { id: newRowId(), key: "", value: "" }])
				}
			/>
		</div>
	);
}

function RowControls({
	row,
	onKeyChange,
	onValueChange,
	onRemove,
}: {
	row: Row;
	onKeyChange: (k: string) => void;
	onValueChange: (v: string) => void;
	onRemove: () => void;
}) {
	return (
		<>
			<input
				type="text"
				value={row.key}
				onChange={(e) => onKeyChange(e.target.value)}
				placeholder="key"
				className="text-[13px] bg-rv-bg-input border border-rv-border rounded px-2 py-1 text-rv-text-primary focus:border-rv-border-focus outline-none"
			/>
			<input
				type="text"
				value={row.value}
				onChange={(e) => onValueChange(e.target.value)}
				placeholder="value"
				className="text-[13px] bg-rv-bg-input border border-rv-border rounded px-2 py-1 text-rv-text-primary focus:border-rv-border-focus outline-none"
			/>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Delete metadata row "${row.key}"`}
				className="w-5 h-5 flex items-center justify-center rounded text-rv-text-tertiary hover:text-rv-status-blocked hover:bg-rv-bg-hover"
			>
				<svg
					aria-hidden="true"
					width={10}
					height={10}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</>
	);
}

function AddButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex items-center gap-1 text-[11px] font-normal text-rv-text-secondary hover:text-rv-text-primary self-start"
		>
			+ Add row
		</button>
	);
}
