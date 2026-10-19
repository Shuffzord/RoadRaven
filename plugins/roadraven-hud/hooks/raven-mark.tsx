// The raven mark in the pane's header: a surface module (Client) that animates on the surface's own
// frame clock, so no frame costs a `ui.render` pass. The frames are pure (`frameAt`), the clock is here.
import type { ClientModule } from "claude-code";

export const MARK_KEY = "raven-mark";
export const MARK_MODE = { IDLE: "idle", BUSY: "busy" } as const;
export type MarkMode = (typeof MARK_MODE)[keyof typeof MARK_MODE];
// `body` and `hi` are colours: the palette's accent and its primary text.
export type MarkProps = {
	still: boolean;
	mode: MarkMode;
	body: string;
	hi: string;
};

// 8 frames a second at most: glyph art needs no more, and the terminal redraws less.
export const MARK_TICK_MS = 125;
const IDLE_FRAMES = 64; // 8 s: perched, one pulse down the traces and a blink
const BUSY_FRAMES = 16; // 2 s: a shimmer sweep and a circuit pulse, over and over
export const MARK_CYCLE_MS = {
	idle: IDLE_FRAMES * MARK_TICK_MS,
	busy: BUSY_FRAMES * MARK_TICK_MS,
} as const;

// The app's logo in glyphs: a raven head facing right, its eye, the long beak, and the circuit
// traces of its neck ending in pads.
const ART = [" ▄▟██◉█▄▄▄▖", "▟████▛▀▀▀▀▘", " ┃•┃•┃     "].map((row) => [
	...row,
]);
const EYE = "◉";
// The traces a pulse runs along, as `row,column`.
const TRACE = ["2,1", "2,2", "2,3", "2,4", "2,5"];
const LIT_PAD: Record<string, string> = { "•": "●" };

type Ink = "body" | "hi";
export type Run = { text: string; ink: Ink };
export type Frame = Run[][];
// What one frame changes on the still art: a column brightened (-1 for none), a trace lit
// ("" for none), the eye shut.
type Fx = { shimmer: number; lit: string; blink: boolean };
const NO_FX: Fx = { shimmer: -1, lit: "", blink: false };

const glyphAt = (ch: string, fx: Fx) => (ch === EYE && fx.blink ? "─" : ch);
const inkAt = (ch: string, c: number, fx: Fx): Ink =>
	ch === EYE || (ch !== " " && c === fx.shimmer) ? "hi" : "body";

function cell(ch: string, at: string, c: number, fx: Fx): Run {
	if (at === fx.lit) return { text: LIT_PAD[ch] ?? ch, ink: "hi" };
	return { text: glyphAt(ch, fx), ink: inkAt(ch, c, fx) };
}

// Neighbouring cells of one ink drawn as one run.
function runs(cells: Run[]): Run[] {
	const out: Run[] = [];
	for (const next of cells) {
		const last = out[out.length - 1];
		if (last?.ink === next.ink) last.text += next.text;
		else out.push({ ...next });
	}
	return out;
}

const paint = (fx: Fx): Frame =>
	ART.map((row, r) => runs(row.map((ch, c) => cell(ch, `${r},${c}`, c, fx))));

export const STILL_FRAME = paint(NO_FX);

// Idle: a slow pulse down the neck's traces from 3 s (two ticks a step), a blink at 7 s.
const PULSE_AT = 24;
const BLINK_AT = 56;
const idleFx = (i: number): Fx => ({
	...NO_FX,
	lit: TRACE[(i - PULSE_AT) >> 1] ?? "",
	blink: i >> 1 === BLINK_AT >> 1,
});

// Busy: a shimmer sweeps the head left to right while a pulse runs the traces twice as often.
const busyFx = (i: number): Fx => ({
	...NO_FX,
	shimmer: i,
	lit: TRACE[i % 8] ?? "",
});

// The frame at `t` ms on the mark's clock: pure, the same `t` the same frame, cycling.
export function frameAt(t: number, mode: MarkMode): Frame {
	const tick = Math.floor(t / MARK_TICK_MS);
	return mode === MARK_MODE.BUSY
		? paint(busyFx(tick % BUSY_FRAMES))
		: paint(idleFx(tick % IDLE_FRAMES));
}

type MarkState = { t: number };
type Surface = Parameters<ClientModule<MarkProps, MarkState>>[1];

const elapsed = (surface: Surface) => surface.state?.t ?? 0;

// Reduced motion or a screen reader: the clock never starts. Else it starts once, on the first call.
function startClock(props: MarkProps, surface: Surface) {
	if (props.still || surface.state !== undefined) return;
	surface.setState({ t: 0 });
	surface.every(MARK_TICK_MS, () =>
		surface.setState({ t: elapsed(surface) + MARK_TICK_MS }),
	);
}

const RavenMark: ClientModule<MarkProps, MarkState> = (props, surface) => {
	startClock(props, surface);
	const frame = props.still
		? STILL_FRAME
		: frameAt(elapsed(surface), props.mode);
	const { Box, Text } = surface.elements;
	return (
		<Box flexDirection="column">
			{frame.map((row, r) => (
				<Text key={`row-${r}`}>
					{row.map((run, i) => (
						<Text key={`run-${i}`} color={props[run.ink]}>
							{run.text}
						</Text>
					))}
				</Text>
			))}
		</Box>
	);
};
export default RavenMark;
