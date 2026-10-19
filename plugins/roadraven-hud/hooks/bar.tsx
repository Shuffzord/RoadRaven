// A node's progress bar: a surface module (Client) that eases the fill from the old done count to
// the new one on the surface's frame clock. The glyph maths and the easing are pure and exported.
import type { ClientElements, ClientModule } from "claude-code";

export const BAR_CELLS = 12;
export const EASE_MS = 400;
const TICK_MS = 50;
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

export const barKey = (nodeId: string) => `bar-${nodeId}`;

// `fill`, `rest` and `label` are colours: the done part, the rest of the bar, and the numbers.
export type BarProps = {
	done: number;
	total: number;
	still: boolean;
	fill: string;
	rest: string;
	label: string;
};

// Ease-out cubic from `from` to `to` at `t` (0 to 1, clamped): exact at both ends.
export function eased(from: number, to: number, t: number) {
	if (t <= 0) return from;
	if (t >= 1) return to;
	return from + (to - from) * (1 - (1 - t) ** 3);
}

// The bar's cells for a fraction, to the nearest eighth of a cell.
export function barGlyphs(fraction: number, cells = BAR_CELLS) {
	const eighths = Math.round(Math.min(1, Math.max(0, fraction)) * cells * 8);
	const full = Math.floor(eighths / 8);
	const part = EIGHTHS[eighths % 8] ?? "";
	return {
		filled: "█".repeat(full) + part,
		empty: "░".repeat(cells - full - (part ? 1 : 0)),
	};
}

const label = (done: number, total: number) =>
	`${String(Math.round((done / total) * 100)).padStart(3)}%  ${done}/${total}`;

// `███████▋░░░░  64%  7/11`: the bar at `fraction` (eased), the numbers at the count itself.
export const progressText = (fraction: number, done: number, total: number) => {
	const { filled, empty } = barGlyphs(fraction);
	return `${filled}${empty} ${label(done, total)}`;
};

// The bar as drawn, by a surface module here or by the pane where a surface has no Client.
export function barLine(
	Text: ClientElements["Text"],
	p: BarProps,
	fraction: number,
) {
	const { filled, empty } = barGlyphs(fraction);
	return (
		<Text wrap="truncate-end">
			<Text color={p.fill}>{filled}</Text>
			<Text color={p.rest}>{empty}</Text>
			<Text color={p.label}> {label(p.done, p.total)}</Text>
		</Text>
	);
}

// Easing from `from` to `to`, `t` ms in; `id` names the tween whose clock may move it.
type BarState = { from: number; to: number; t: number; id: number };
type Surface = Parameters<ClientModule<BarProps, BarState>>[1];

const shown = (s: BarState) => eased(s.from, s.to, s.t / EASE_MS);

// One clock per tween: it stops at the end, or once a newer tween has taken over.
function tween(surface: Surface, id: number) {
	const stop = surface.every(TICK_MS, () => {
		const s = surface.state;
		if (s?.id !== id || s.t >= EASE_MS) {
			stop();
			return;
		}
		surface.setState({ ...s, t: Math.min(EASE_MS, s.t + TICK_MS) });
	});
}

// A new count: the first one, or any under still mode, is drawn at once; else a tween from where
// the bar is now.
function retarget(surface: Surface, to: number, still: boolean): BarState {
	const s = surface.state;
	const isJump = s === undefined || still;
	const next = isJump
		? { from: to, to, t: EASE_MS, id: 0 }
		: { from: shown(s), to, t: 0, id: s.id + 1 };
	surface.setState(next);
	if (!isJump) tween(surface, next.id);
	return next;
}

const Bar: ClientModule<BarProps, BarState> = (props, surface) => {
	const to = props.done / props.total;
	const s = surface.state;
	const now = s && s.to === to ? s : retarget(surface, to, props.still);
	return barLine(surface.elements.Text, props, shown(now));
};
export default Bar;
