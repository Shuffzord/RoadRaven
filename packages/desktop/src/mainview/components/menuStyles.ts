// The one visual language for every Radix menu surface (context menu, File
// menu). Shared as constants so a new menu cannot drift from the canvas one.

export const MENU_SURFACE_CLASS =
	"min-w-[200px] max-w-[280px] py-1 bg-[var(--rv-bg-elevated)] border border-[var(--rv-border)] rounded-[8px] shadow-[var(--rv-shadow-config)] z-[9000] will-change-transform";
export const ITEM_CLASS =
	"flex items-center justify-between h-[28px] px-3 text-[13px] text-[var(--rv-text-primary)] select-none cursor-default outline-none data-[highlighted]:bg-[var(--rv-accent-muted)] data-[highlighted]:text-[var(--rv-text-primary)] data-[disabled]:text-[var(--rv-text-tertiary)] data-[disabled]:pointer-events-none";
export const ITEM_DESTRUCTIVE_CLASS =
	"flex items-center justify-between h-[28px] px-3 text-[13px] text-[var(--rv-status-blocked)] select-none cursor-default outline-none data-[highlighted]:bg-[var(--rv-accent-muted)]";
export const HINT_CLASS = "text-[11px] text-[var(--rv-text-tertiary)] ml-4";
export const SEP_CLASS = "h-px my-1 bg-[var(--rv-border-subtle)]";
