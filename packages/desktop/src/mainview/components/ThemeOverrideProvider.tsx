import type { CSSProperties, ReactNode } from "react";

export interface ThemeConfig {
	statusColors?: Record<string, string>;
	nodeShape?: {
		borderRadius?: string;
	};
}

// Whitelist pattern for CSS injection prevention (T-01-05)
// Only 6-digit hex -- rejects 3/4/8-digit shorthand to avoid parseInt slice bugs
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const PX_VALUE_RE = /^\d+px$/;

/**
 * Convert a themeConfig JSON block into inline CSS custom property overrides.
 * Only allows whitelisted value patterns to prevent CSS injection.
 * Per D-07: scope is status colors + node shape only.
 */
export function buildOverrideVars(
	config: ThemeConfig | undefined,
): CSSProperties {
	if (!config) return {};
	const vars: Record<string, string> = {};

	if (config.statusColors) {
		for (const [status, color] of Object.entries(config.statusColors)) {
			if (!HEX_COLOR_RE.test(color)) continue; // reject non-hex values
			const key = `--rv-status-${status}`;
			vars[key] = color;
			// Auto-generate bg variant at 10% opacity
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			vars[`${key}-bg`] = `rgba(${r},${g},${b},0.1)`;
		}
	}

	if (config.nodeShape?.borderRadius) {
		if (PX_VALUE_RE.test(config.nodeShape.borderRadius)) {
			vars["--node-radius"] = config.nodeShape.borderRadius;
		}
	}

	return vars as CSSProperties;
}

interface ThemeOverrideProviderProps {
	themeConfig?: ThemeConfig;
	children: ReactNode;
	className?: string;
}

/**
 * Scoped container for per-schema theme overrides.
 * Applied as inline CSS custom properties on a wrapper div -- NOT on :root (D-08).
 * Overrides stack on top of whichever base theme is active (D-06).
 */
export function ThemeOverrideProvider({
	themeConfig,
	children,
	className,
}: ThemeOverrideProviderProps) {
	const overrideVars = buildOverrideVars(themeConfig);
	return (
		<div
			style={overrideVars}
			className={className}
			data-testid="theme-override-container"
		>
			{children}
		</div>
	);
}
