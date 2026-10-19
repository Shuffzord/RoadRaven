// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	LOGO_FX_VARIANT,
	type LogoFxVariant,
} from "../../../src/mainview/lib/logoFx/constants";
import {
	LOGO_FX_EFFECTS,
	RAVEN_PATH_D,
} from "../../../src/mainview/lib/logoFx/effects";

const VARIANTS = Object.values(LOGO_FX_VARIANT) as LogoFxVariant[];

/** Layers each variant adds to the stage, beside the static watermark. */
const LAYERS: Record<LogoFxVariant, number> = {
	[LOGO_FX_VARIANT.SHIMMER]: 1,
	[LOGO_FX_VARIANT.CIRCUIT_PULSE]: 1,
	[LOGO_FX_VARIANT.POWER_SURGE]: 1,
	[LOGO_FX_VARIANT.GLITCH]: 2,
	[LOGO_FX_VARIANT.STATUS_AURORA]: 1,
	[LOGO_FX_VARIANT.BIT_DRIFT]: 1,
};

/** Stage shaped like Canvas's: an 800px box whose first child is the watermark. */
function makeStage(): HTMLElement {
	const stage = document.createElement("div");
	stage.appendChild(document.createElement("div"));
	document.body.appendChild(stage);
	return stage;
}

interface FakeAnimation {
	finished: Promise<FakeAnimation>;
	finish: () => void;
	cancel: () => void;
}

/** The smallest WAAPI the effects use: `finished` and `cancel()`. */
function stubAnimate(): FakeAnimation[] {
	const made: FakeAnimation[] = [];
	Object.defineProperty(Element.prototype, "animate", {
		configurable: true,
		writable: true,
		value: () => {
			let resolve = (_: FakeAnimation): void => undefined;
			let reject = (_: unknown): void => undefined;
			const anim = {} as FakeAnimation;
			anim.finished = new Promise<FakeAnimation>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			anim.finish = () => resolve(anim);
			// Real WAAPI rejects `finished` with an AbortError on cancel().
			anim.cancel = () => reject(new DOMException("cancelled", "AbortError"));
			made.push(anim);
			return anim;
		},
	});
	return made;
}

/** jsdom has no canvas 2D context nor Path2D: give Bit drift minimal ones. */
function stubCanvas(): { path2dCount: () => number } {
	let count = 0;
	vi.stubGlobal(
		"Path2D",
		class {
			constructor() {
				count++;
			}
		},
	);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
		() =>
			({
				setTransform: vi.fn(),
				clearRect: vi.fn(),
				fillRect: vi.fn(),
				isPointInPath: () => true,
			}) as unknown as CanvasRenderingContext2D,
	);
	return { path2dCount: () => count };
}

afterEach(() => {
	delete (Element.prototype as { animate?: unknown }).animate;
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
	document.documentElement.removeAttribute("style");
});

describe("logo FX effects without WAAPI (jsdom)", () => {
	it.each(
		VARIANTS,
	)("%s returns a finished handle and adds nothing", async (v) => {
		expect(typeof Element.prototype.animate).not.toBe("function");
		const stage = makeStage();

		const handle = LOGO_FX_EFFECTS[v](stage);

		await expect(handle.finished).resolves.toBeUndefined();
		expect(stage.childElementCount).toBe(1);
		handle.cancel();
	});
});

describe("logo FX effects with WAAPI", () => {
	let animations: FakeAnimation[];
	beforeEach(() => {
		animations = stubAnimate();
		stubCanvas();
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
	});

	it.each(VARIANTS)("%s adds its layer and cancel() removes it", async (v) => {
		const stage = makeStage();
		const base = stage.firstElementChild;

		const handle = LOGO_FX_EFFECTS[v](stage);
		expect(stage.childElementCount).toBe(1 + LAYERS[v]);
		expect(stage.firstElementChild).toBe(base);

		handle.cancel();

		expect(stage.childElementCount).toBe(1);
		expect(stage.firstElementChild).toBe(base);
		await expect(handle.finished).resolves.toBeUndefined();
	});

	it.each(VARIANTS)("%s removes its layer when it finishes", async (v) => {
		const stage = makeStage();
		const handle = LOGO_FX_EFFECTS[v](stage);

		for (const a of animations) a.finish();
		vi.advanceTimersByTime(10_000);
		await handle.finished;

		expect(stage.childElementCount).toBe(1);
	});

	it("reads the theme accent at play time", () => {
		const stage = makeStage();
		const stroke = (): string | null | undefined =>
			stage.querySelector("path")?.getAttribute("stroke");

		document.documentElement.style.setProperty("--rv-accent", "#ffa83d");
		const first = LOGO_FX_EFFECTS[LOGO_FX_VARIANT.CIRCUIT_PULSE](stage);
		expect(stroke()).toBe("#ffa83d");
		first.cancel();

		document.documentElement.style.setProperty("--rv-accent", "#4a9eff");
		LOGO_FX_EFFECTS[LOGO_FX_VARIANT.CIRCUIT_PULSE](stage);
		expect(stroke()).toBe("#4a9eff");
	});
});

describe("logo path data", () => {
	it("extracts a non-empty path d from the raw SVG", () => {
		expect(RAVEN_PATH_D.length).toBeGreaterThan(1000);
		expect(RAVEN_PATH_D.startsWith("M")).toBe(true);
	});
});

describe("Bit drift spawn points", () => {
	it("are computed on first play only, never at import, and cached", async () => {
		stubAnimate();
		const canvas = stubCanvas();
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
		// A fresh module: the cache of the copy imported above is already warm.
		vi.resetModules();
		const fresh = await import("../../../src/mainview/lib/logoFx/effects");
		const stage = makeStage();
		expect(canvas.path2dCount()).toBe(0);

		fresh.LOGO_FX_EFFECTS[LOGO_FX_VARIANT.BIT_DRIFT](stage).cancel();
		fresh.LOGO_FX_EFFECTS[LOGO_FX_VARIANT.BIT_DRIFT](stage).cancel();

		expect(canvas.path2dCount()).toBe(1);
	});
});
