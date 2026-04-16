import { type ReactNode, useMemo, useState } from "react";

// Auto-discover every *Panel.tsx sibling via Vite import.meta.glob.
// This eliminates manual registry edits — each plan just drops its *Panel.tsx
// file here. `eager: true` inlines the modules so named exports can be read
// synchronously when building the panel registry.
const panelModules = import.meta.glob("./*Panel.tsx", {
	eager: true,
}) as Record<string, Record<string, () => ReactNode>>;

interface PanelRegistryEntry {
	id: string;
	label: string;
	render: () => ReactNode;
}

function buildPanels(): PanelRegistryEntry[] {
	const entries: PanelRegistryEntry[] = [];
	for (const [path, mod] of Object.entries(panelModules)) {
		// path looks like "./PersistencePanel.tsx" → exported name "PersistencePanel"
		const match = path.match(/\.\/(\w+)Panel\.tsx$/);
		if (!match) continue;
		const baseName = match[1];
		const Component = mod[`${baseName}Panel`] as (() => ReactNode) | undefined;
		if (!Component) continue;
		entries.push({
			id: baseName.toLowerCase(),
			label: baseName,
			render: () => Component(),
		});
	}
	// Stable alphabetical order so tabs don't reshuffle between HMR reloads
	return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * DevHarness — the shared mid-plan UAT surface.
 *
 * CRITICAL: this component must ONLY be imported/rendered when
 * `import.meta.env.DEV` is true. The import.meta.env.DEV guard lives at the
 * mount site (Plan 01 wires it into App.tsx) so this file itself remains a
 * plain React component that is tree-shaken from production bundles.
 */
export function DevHarness() {
	const panels = useMemo(buildPanels, []);
	const [activeId, setActiveId] = useState<string>(panels[0]?.id ?? "");
	const active = panels.find((p) => p.id === activeId);

	return (
		<div
			data-testid="dev-harness"
			style={{
				position: "fixed",
				bottom: 0,
				right: 0,
				width: 420,
				maxHeight: "60vh",
				overflow: "auto",
				background: "var(--rv-bg-elevated, #1a1a1a)",
				border: "1px solid var(--rv-border, #444)",
				borderTopLeftRadius: 8,
				boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
				fontSize: 12,
				color: "var(--rv-text-primary, #eee)",
				zIndex: 10000,
				padding: 8,
			}}
		>
			<div
				style={{
					display: "flex",
					gap: 4,
					borderBottom: "1px solid var(--rv-border, #444)",
					paddingBottom: 6,
					marginBottom: 8,
				}}
			>
				<strong style={{ marginRight: 8 }}>DevHarness</strong>
				{panels.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => setActiveId(p.id)}
						style={{
							background:
								p.id === activeId
									? "var(--rv-accent-muted, #2a4a6a)"
									: "transparent",
							border: "1px solid var(--rv-border, #444)",
							borderRadius: 4,
							color: "inherit",
							padding: "2px 8px",
							fontSize: 11,
							cursor: "pointer",
						}}
					>
						{p.label}
					</button>
				))}
			</div>
			{active ? (
				active.render()
			) : (
				<div>No panels discovered. Create a *Panel.tsx sibling file.</div>
			)}
		</div>
	);
}
