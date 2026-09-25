import type { Page } from "@playwright/test";

export interface ThemeShot {
	name: string;
	image: string;
}

/** Compose the real captures in a separate document, without image dependencies. */
export async function captureCollage(
	page: Page,
	shots: ThemeShot[],
	path: string,
): Promise<void> {
	await page.goto("about:blank");
	await page.setViewportSize({ width: 2400, height: 1200 });
	await page.setContent(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 48px; background: #101318; color: #edf1f7;
    font-family: Arial, sans-serif; }
  header { margin-bottom: 36px; }
  .brand { color: #83b8ff; font-size: 20px; letter-spacing: 3px; text-transform: uppercase; }
  h1 { margin: 12px 0; font-size: 48px; }
  p { margin: 0; color: #a7b4c6; font-size: 24px; }
  main { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
  figure { margin: 0; overflow: hidden; border: 1px solid #35404f; border-radius: 14px;
    background: #1b222c; }
  figcaption { padding: 18px 24px; font-size: 26px; font-weight: bold; }
  img { display: block; width: 100%; height: auto; }
</style></head><body>
  <header><div class="brand">RoadRaven</div><h1>One roadmap. Different perspectives.</h1>
  <p>CFA Level I · The same study progress across built-in themes</p></header>
  <main></main>
</body></html>`);
	await page.evaluate(async (tiles) => {
		const grid = document.querySelector("main");
		if (!grid) throw new Error("Collage grid missing");
		await Promise.all(
			tiles.map(async ({ name, image }) => {
				const figure = document.createElement("figure");
				const caption = document.createElement("figcaption");
				caption.textContent = name;
				const img = document.createElement("img");
				img.alt = `CFA roadmap in ${name}`;
				img.src = image;
				figure.append(caption, img);
				grid.append(figure);
				await img.decode();
			}),
		);
		await document.fonts.ready;
	}, shots);
	await page.screenshot({ path, fullPage: true, animations: "disabled" });
}
