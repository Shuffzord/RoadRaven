/**
 * Dev-only harness auto-discovers `*Panel.tsx` files via `import.meta.glob` and
 * renders them in a floating panel for interactive testing.
 *
 * This is a minimal stub landed by Plan 03-01 to unblock vite build while
 * Plan 03-04a owns the full auto-discovery implementation. Plan 04a replaces
 * this file. Do NOT add logic here until Plan 04a is merged.
 */
import type React from "react";
import { useEffect, useState } from "react";

// biome-ignore lint/suspicious/noExplicitAny: dev-harness dynamic module shape
type PanelModule = { [K: string]: any };

export function DevHarness() {
	const [open, setOpen] = useState(false);
	const [panels, setPanels] = useState<
		Array<{ name: string; component: () => React.JSX.Element }>
	>([]);

	useEffect(() => {
		// Auto-discover *Panel.tsx files in this directory
		const modules = import.meta.glob("./*Panel.tsx");
		const entries = Object.entries(modules);
		Promise.all(
			entries.map(async ([path, loader]) => {
				const m = (await loader()) as PanelModule;
				const name =
					path
						.split("/")
						.pop()
						?.replace(/\.tsx$/, "") ?? path;
				const Component = m[name] ?? m.default;
				return Component
					? { name, component: Component as () => React.JSX.Element }
					: null;
			}),
		).then((results) => {
			setPanels(
				results.filter((r): r is { name: string; component: () => React.JSX.Element } =>
					Boolean(r),
				),
			);
		});
	}, []);

	if (!import.meta.env.DEV) return null;

	return (
		<div
			style={{
				position: "fixed",
				bottom: 8,
				right: 8,
				zIndex: 20000,
				fontSize: 11,
				fontFamily: "monospace",
			}}
		>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				style={{
					background: "var(--rv-bg-elevated)",
					border: "1px solid var(--rv-border)",
					color: "var(--rv-text-primary)",
					borderRadius: 4,
					padding: "4px 8px",
					cursor: "pointer",
				}}
			>
				DevHarness ({panels.length})
			</button>
			{open && (
				<div
					style={{
						marginTop: 4,
						width: 320,
						maxHeight: "60vh",
						overflow: "auto",
						background: "var(--rv-bg-elevated)",
						border: "1px solid var(--rv-border)",
						borderRadius: 6,
						padding: 8,
						color: "var(--rv-text-primary)",
					}}
				>
					{panels.length === 0 ? (
						<div>No panels discovered.</div>
					) : (
						panels.map(({ name, component: C }) => (
							<details key={name} style={{ marginBottom: 8 }}>
								<summary style={{ cursor: "pointer", fontWeight: 600 }}>
									{name}
								</summary>
								<div style={{ marginTop: 6 }}>
									<C />
								</div>
							</details>
						))
					)}
				</div>
			)}
		</div>
	);
}
