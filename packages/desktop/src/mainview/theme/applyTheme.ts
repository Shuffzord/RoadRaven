const TOKEN_PREFIX = "--rv-";

/**
 * Paints a resolved theme (v0.8.3 Phase 3). The only writer of `--rv-*` on
 * the root element and of `data-theme`: every token in `resolved` is set,
 * every `--rv-*` the previous theme set and this one lacks is removed (a
 * radius knob only Contrast sets must not survive a switch to Dark), and
 * `data-theme` carries the id for the few CSS hooks and tests that key on it.
 */
export function applyTheme(
	resolved: Record<string, string>,
	id: string,
	root: HTMLElement = document.documentElement,
): void {
	const style = root.style;
	const stale: string[] = [];
	for (let i = 0; i < style.length; i++) {
		const name = style.item(i);
		if (name.startsWith(TOKEN_PREFIX) && !(name in resolved)) stale.push(name);
	}
	for (const name of stale) style.removeProperty(name);
	for (const [name, value] of Object.entries(resolved)) {
		style.setProperty(name, value);
	}
	root.setAttribute("data-theme", id);
}
