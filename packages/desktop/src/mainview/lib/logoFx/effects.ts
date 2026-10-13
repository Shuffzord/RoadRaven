import ravenLogo from "../../assets/raven-logo.svg";
import ravenSvg from "../../assets/raven-logo.svg?raw";
import { LOGO_FX_VARIANT, type LogoFxVariant } from "./constants";
import type { LogoFxHandle } from "./player";

/**
 * The six background-logo effects (v0.9.1), ported from the approved
 * prototype. Each one adds its own layers to the 800x800 watermark stage,
 * animates them with WAAPI and removes them again when it finishes or is
 * cancelled. Theme colours are read when an effect starts, so every theme
 * gets its own accent and status palette.
 */

type Effect = (stage: HTMLElement) => LogoFxHandle;
type Anim = Pick<Animation, "cancel"> & { finished: Promise<unknown> };

function svgAttr(name: string): string {
	return new RegExp(`\\s${name}="([^"]+)"`).exec(ravenSvg)?.[1] ?? "";
}

/** The logo's single path, straight from the shipped asset. */
export const RAVEN_PATH_D = svgAttr("d");
const VIEWBOX = svgAttr("viewBox");
const [VB_X, VB_Y, VB_W, VB_H] = VIEWBOX.split(/\s+/).map(Number);

const STAGE = 800;
const SVG_NS = "http://www.w3.org/2000/svg";
// The watermark is mask-size: contain on a 1:1 SVG, so the viewBox is
// meet-fitted into the stage: full width, centred vertically.
const UNIT = STAGE / VB_W;
const OFFSET_Y = (STAGE - VB_H * UNIT) / 2;
const NECK = { x: (92 - VB_X) * UNIT, y: OFFSET_Y + (210 - VB_Y) * UNIT };

const canAnimate = (): boolean =>
	typeof Element.prototype.animate === "function";

const settled = (): LogoFxHandle => ({
	finished: Promise.resolve(),
	cancel: () => undefined,
});

/** Wraps the animations of one effect: its nodes go when they all end or on cancel. */
function handle(nodes: Element[], anims: Anim[]): LogoFxHandle {
	let done = false;
	const cleanup = (): void => {
		if (done) return;
		done = true;
		for (const n of nodes) n.remove();
	};
	const finished = Promise.all(anims.map((a) => a.finished)).then(
		cleanup,
		cleanup,
	);
	return {
		finished,
		cancel: () => {
			if (done) return;
			cleanup();
			for (const a of anims) a.cancel();
		},
	};
}

function token(stage: HTMLElement, name: string): string {
	return getComputedStyle(stage).getPropertyValue(name).trim();
}

function div(
	parent: Element,
	style: Partial<CSSStyleDeclaration>,
): HTMLElement {
	const n = document.createElement("div");
	Object.assign(n.style, { position: "absolute" }, style);
	parent.append(n);
	return n;
}

/** A full-stage layer clipped to the raven silhouette, like the watermark. */
function masked(stage: HTMLElement, opacity: number): HTMLElement {
	const m = div(stage, {
		inset: "0",
		overflow: "hidden",
		opacity: String(opacity),
	});
	for (const p of ["mask", "-webkit-mask"]) {
		m.style.setProperty(`${p}-image`, `url(${ravenLogo})`);
		m.style.setProperty(`${p}-size`, "contain");
		m.style.setProperty(`${p}-repeat`, "no-repeat");
		m.style.setProperty(`${p}-position`, "center");
	}
	return m;
}

function svg<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string>,
	parent: Element,
): SVGElementTagNameMap[K] {
	const n = document.createElementNS(SVG_NS, tag);
	for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
	parent.append(n);
	return n;
}

/** Opacity ramp shared by the slow overlays: fade in, hold, fade out. */
const fadeHold = (peak: number): Keyframe[] => [
	{ opacity: 0 },
	{ opacity: peak, offset: 0.2 },
	{ opacity: peak, offset: 0.75 },
	{ opacity: 0 },
];

function shimmer(stage: HTMLElement): LogoFxHandle {
	const m = masked(stage, 0.16);
	const band = div(m, {
		top: "-10%",
		bottom: "-10%",
		left: "0",
		width: "45%",
		background: `linear-gradient(90deg, transparent 0%, ${token(stage, "--rv-text-primary")} 50%, transparent 100%)`,
	});
	return handle(
		[m],
		[
			band.animate(
				[
					{ transform: "translateX(-110%) skewX(-18deg)" },
					{ transform: "translateX(330%) skewX(-18deg)" },
				],
				{ duration: 1900, easing: "cubic-bezier(.4,0,.2,1)" },
			),
		],
	);
}

function circuitPulse(stage: HTMLElement): LogoFxHandle {
	const T = 2800;
	const s = svg("svg", { viewBox: VIEWBOX, "aria-hidden": "true" }, stage);
	Object.assign(s.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		overflow: "visible",
	});
	const p = svg(
		"path",
		{
			d: RAVEN_PATH_D,
			fill: "none",
			stroke: token(stage, "--rv-accent"),
			"stroke-width": "0.45",
			"stroke-linecap": "round",
			pathLength: "1000",
			"stroke-dasharray": "1.2 14",
		},
		s,
	);
	return handle(
		[s],
		[
			p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -60 }], {
				duration: T,
				easing: "linear",
			}),
			s.animate(fadeHold(0.5), { duration: T, easing: "ease-in-out" }),
		],
	);
}

function powerSurge(stage: HTMLElement): LogoFxHandle {
	const m = masked(stage, 0.22);
	const ring = div(m, {
		left: `${NECK.x - 800}px`,
		top: `${NECK.y - 800}px`,
		width: "1600px",
		height: "1600px",
		borderRadius: "50%",
		background: `radial-gradient(circle, transparent 0 38%, ${token(stage, "--rv-accent")} 46%, transparent 54%)`,
	});
	return handle(
		[m],
		[
			ring.animate(
				[
					{ transform: "scale(.05)", opacity: 1 },
					{ transform: "scale(.7)", opacity: 1, offset: 0.7 },
					{ transform: "scale(1)", opacity: 0 },
				],
				{ duration: 2300, easing: "cubic-bezier(.3,.6,.4,1)" },
			),
		],
	);
}

/** [dx, dy, clip top %, clip bottom %, visible] per step. */
const GLITCH_FRAMES = [
	[0, 0, 0, 100, 0],
	[-7, 6, 18, 62, 1],
	[5, -4, 40, 30, 1],
	[-3, 9, 5, 80, 1],
	[8, -8, 55, 12, 1],
	[0, 0, 0, 100, 0],
	[-5, 4, 25, 50, 1],
	[0, 0, 0, 100, 0],
];

function glitchKeyframes(sign: number): Keyframe[] {
	return GLITCH_FRAMES.map(([dx, dy, top, bottom, on]) => ({
		transform: `translate(${dx * sign}px, ${dy * sign * 0.3}px)`,
		clipPath: `inset(${top}% 0 ${bottom === 100 ? 0 : bottom}% 0)`,
		opacity: on ? 0.14 : 0,
		easing: "steps(1, end)",
	}));
}

function glitch(stage: HTMLElement): LogoFxHandle {
	const T = 700;
	const tinted = (color: string): HTMLElement => {
		const m = masked(stage, 0);
		div(m, { inset: "0", background: color });
		return m;
	};
	const a = tinted(token(stage, "--rv-status-blocked"));
	const c = tinted(token(stage, "--rv-search"));
	const anims: Anim[] = [
		a.animate(glitchKeyframes(1), { duration: T }),
		c.animate(glitchKeyframes(-1), { duration: T }),
	];
	const base = stage.firstElementChild;
	if (base) {
		anims.push(
			base.animate(
				GLITCH_FRAMES.map(([dx]) => ({
					transform: `translateX(${Math.round(dx / 3)}px)`,
					easing: "steps(1, end)",
				})),
				{ duration: T },
			),
		);
	}
	return handle([a, c], anims);
}

function statusAurora(stage: HTMLElement): LogoFxHandle {
	const T = 6000;
	const [ns, ip, done] = [
		"--rv-status-not-started",
		"--rv-status-in-progress",
		"--rv-status-completed",
	].map((name) => token(stage, name));
	const m = masked(stage, 0);
	const strip = div(m, {
		top: "0",
		bottom: "0",
		left: "0",
		width: "300%",
		background: `linear-gradient(100deg, ${[ns, ip, done, ip, ns, ip, done].join(", ")})`,
	});
	return handle(
		[m],
		[
			strip.animate(
				[{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
				{ duration: T, easing: "ease-in-out" },
			),
			m.animate(fadeHold(0.14), { duration: T }),
		],
	);
}

let spawnCache: { x: number; y: number }[] | null = null;

/** Random points inside the back of the silhouette, hit-tested once and kept. */
function spawnPoints(
	ctx: CanvasRenderingContext2D,
): { x: number; y: number }[] {
	if (spawnCache) return spawnCache;
	const path = new Path2D(RAVEN_PATH_D);
	const out: { x: number; y: number }[] = [];
	for (let i = 0; i < 6000 && out.length < 500; i++) {
		// Back of the head only: bits stream away from the beak.
		const x = Math.random() * STAGE * 0.6;
		const y = OFFSET_Y + Math.random() * VB_H * UNIT;
		if (
			ctx.isPointInPath(path, x / UNIT + VB_X, (y - OFFSET_Y) / UNIT + VB_Y)
		) {
			out.push({ x, y });
		}
	}
	spawnCache = out;
	return out;
}

interface Bit {
	x: number;
	y: number;
	born: number;
	life: number;
	vx: number;
	vy: number;
	size: number;
	phase: number;
}

function spawnBits(pts: { x: number; y: number }[], n: number): Bit[] {
	return Array.from({ length: n }, () => {
		const p = pts[Math.floor(Math.random() * pts.length)];
		return {
			x: p.x,
			y: p.y,
			born: Math.random() * 1300,
			life: 1400 + Math.random() * 1400,
			vx: -(40 + Math.random() * 110),
			vy: -10 + Math.random() * 20,
			size: 2 + Math.floor(Math.random() * 3),
			phase: Math.random() * 6.28,
		};
	});
}

function drawBits(ctx: CanvasRenderingContext2D, bits: Bit[], t: number): void {
	ctx.clearRect(0, 0, STAGE, STAGE);
	for (const q of bits) {
		const age = t - q.born;
		if (age < 0 || age > q.life) continue;
		const s = age / 1000;
		ctx.globalAlpha = 0.4 * Math.sin((Math.PI * age) / q.life);
		ctx.fillRect(
			q.x + q.vx * s,
			q.y + q.vy * s + Math.sin(q.phase + s * 4) * 6,
			q.size,
			q.size,
		);
	}
}

/** A requestAnimationFrame loop shaped like a WAAPI animation. */
function frameLoop(duration: number, draw: (t: number) => void): Anim {
	let raf = 0;
	let settle = (): void => undefined;
	const finished = new Promise<void>((resolve) => {
		settle = resolve;
	});
	const t0 = performance.now();
	const step = (now: number): void => {
		const t = now - t0;
		draw(Math.min(t, duration));
		if (t < duration) raf = requestAnimationFrame(step);
		else settle();
	};
	raf = requestAnimationFrame(step);
	return {
		finished,
		cancel: () => {
			cancelAnimationFrame(raf);
			settle();
		},
	};
}

function bitDrift(stage: HTMLElement): LogoFxHandle {
	const cv = document.createElement("canvas");
	const ctx = cv.getContext("2d");
	if (!ctx) return settled();
	const dpr = window.devicePixelRatio || 1;
	cv.width = STAGE * dpr;
	cv.height = STAGE * dpr;
	Object.assign(cv.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
	});
	stage.append(cv);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = token(stage, "--rv-text-primary");
	const bits = spawnBits(spawnPoints(ctx), 70);
	return handle([cv], [frameLoop(3400, (t) => drawBits(ctx, bits, t))]);
}

/** Without WAAPI (jsdom) an effect adds nothing and is already finished. */
const guarded =
	(effect: Effect): Effect =>
	(stage) =>
		canAnimate() ? effect(stage) : settled();

export const LOGO_FX_EFFECTS: Record<LogoFxVariant, Effect> = {
	[LOGO_FX_VARIANT.SHIMMER]: guarded(shimmer),
	[LOGO_FX_VARIANT.CIRCUIT_PULSE]: guarded(circuitPulse),
	[LOGO_FX_VARIANT.POWER_SURGE]: guarded(powerSurge),
	[LOGO_FX_VARIANT.GLITCH]: guarded(glitch),
	[LOGO_FX_VARIANT.STATUS_AURORA]: guarded(statusAurora),
	[LOGO_FX_VARIANT.BIT_DRIFT]: guarded(bitDrift),
};
