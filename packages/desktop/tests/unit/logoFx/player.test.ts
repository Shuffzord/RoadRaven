import { describe, expect, it } from "vitest";
import {
	LOGO_FX_COOLDOWN_MS,
	LOGO_FX_VARIANT,
	type LogoFxVariant,
} from "../../../src/mainview/lib/logoFx/constants";
import {
	createLogoFxPlayer,
	type LogoFxHandle,
} from "../../../src/mainview/lib/logoFx/player";

interface FakeRun {
	variant: LogoFxVariant;
	cancelled: boolean;
	finish: () => void;
}

/** A player on a hand-driven clock whose effects end only when told to. */
function setup(opts: { reducedMotion?: boolean; enabled?: boolean } = {}) {
	const clock = { t: 0 };
	const runs: FakeRun[] = [];
	const player = createLogoFxPlayer({
		now: () => clock.t,
		reducedMotion: () => opts.reducedMotion === true,
		enabled: () => opts.enabled !== false,
		run: (variant): LogoFxHandle => {
			let finish = (): void => undefined;
			const finished = new Promise<void>((resolve) => {
				finish = resolve;
			});
			const run: FakeRun = { variant, cancelled: false, finish };
			runs.push(run);
			return {
				finished,
				cancel: () => {
					run.cancelled = true;
					finish();
				},
			};
		},
	});
	return { clock, runs, player };
}

/** Let the player observe a settled `finished` promise. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("logo FX player", () => {
	it("plays a requested variant", () => {
		const { runs, player } = setup();

		expect(player.request(LOGO_FX_VARIANT.SHIMMER)).toBe(true);

		expect(runs.map((r) => r.variant)).toEqual([LOGO_FX_VARIANT.SHIMMER]);
		expect(player.current()).toBe(LOGO_FX_VARIANT.SHIMMER);
	});

	it("lets Glitch pre-empt a running Shimmer and cancels it", () => {
		const { runs, player } = setup();
		player.request(LOGO_FX_VARIANT.SHIMMER);

		expect(player.request(LOGO_FX_VARIANT.GLITCH)).toBe(true);

		expect(runs.map((r) => r.variant)).toEqual([
			LOGO_FX_VARIANT.SHIMMER,
			LOGO_FX_VARIANT.GLITCH,
		]);
		expect(runs[0].cancelled).toBe(true);
		expect(player.current()).toBe(LOGO_FX_VARIANT.GLITCH);
	});

	it("keeps the pre-empting effect when the cancelled one settles late", async () => {
		const { runs, player } = setup();
		player.request(LOGO_FX_VARIANT.SHIMMER);
		player.request(LOGO_FX_VARIANT.GLITCH);

		await flush();

		expect(runs[1].cancelled).toBe(false);
		expect(player.current()).toBe(LOGO_FX_VARIANT.GLITCH);
	});

	it("drops a lower-priority request during an effect", () => {
		const { runs, player } = setup();
		player.request(LOGO_FX_VARIANT.GLITCH);

		expect(player.request(LOGO_FX_VARIANT.SHIMMER)).toBe(false);

		expect(runs).toHaveLength(1);
		expect(runs[0].cancelled).toBe(false);
	});

	it("drops an equal-priority request during an effect", () => {
		const { runs, player } = setup();
		player.request(LOGO_FX_VARIANT.SHIMMER);

		expect(player.request(LOGO_FX_VARIANT.STATUS_AURORA)).toBe(false);

		expect(runs).toHaveLength(1);
	});

	it("drops a request within the cooldown after an effect, and plays after it", async () => {
		const { clock, runs, player } = setup();
		player.request(LOGO_FX_VARIANT.SHIMMER);
		clock.t = 1900;
		runs[0].finish();
		await flush();
		expect(player.current()).toBeNull();

		clock.t = 1900 + LOGO_FX_COOLDOWN_MS - 1;
		expect(player.request(LOGO_FX_VARIANT.BIT_DRIFT)).toBe(false);

		clock.t = 1900 + LOGO_FX_COOLDOWN_MS;
		expect(player.request(LOGO_FX_VARIANT.BIT_DRIFT)).toBe(true);
		expect(runs.map((r) => r.variant)).toEqual([
			LOGO_FX_VARIANT.SHIMMER,
			LOGO_FX_VARIANT.BIT_DRIFT,
		]);
	});

	it("lets a higher-priority request through the cooldown", async () => {
		const { clock, runs, player } = setup();
		player.request(LOGO_FX_VARIANT.SHIMMER);
		runs[0].finish();
		await flush();

		clock.t = 10;
		expect(player.request(LOGO_FX_VARIANT.GLITCH)).toBe(true);
	});

	it("cancel() stops the running effect and starts the cooldown", () => {
		const { clock, runs, player } = setup();
		player.request(LOGO_FX_VARIANT.POWER_SURGE);
		clock.t = 500;

		player.cancel();

		expect(runs[0].cancelled).toBe(true);
		expect(player.current()).toBeNull();
		clock.t = 500 + LOGO_FX_COOLDOWN_MS - 1;
		expect(player.request(LOGO_FX_VARIANT.SHIMMER)).toBe(false);
	});

	it("is silent under reduced motion", () => {
		const { runs, player } = setup({ reducedMotion: true });

		expect(player.request(LOGO_FX_VARIANT.GLITCH)).toBe(false);

		expect(runs).toHaveLength(0);
	});

	it("is silent when enabled() is false", () => {
		const { runs, player } = setup({ enabled: false });

		expect(player.request(LOGO_FX_VARIANT.GLITCH)).toBe(false);

		expect(runs).toHaveLength(0);
	});
});
