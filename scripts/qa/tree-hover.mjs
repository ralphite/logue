/** The fold takes the glyph's place under the pointer, the way Notion's does. */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";

export async function run(api) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });
  await api.goto(`${HOST}/documents`);
  await api.sleep(3000);
  const spot = JSON.parse(await api.eval(`(() => {
    // A page with pages inside it: the fold only exists on those.
    const fold = document.querySelector('main button[aria-label="Fold this away"], main button[aria-label="Show what is inside"]');
    const row = fold.closest('div');
    const r = row.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
  })()`));
  const read = `(() => {
    const fold = document.querySelector('main button[aria-label="Fold this away"], main button[aria-label="Show what is inside"]');
    const row = fold.closest('div');
    const glyph = row.querySelector('button[aria-current], button');
    const svg = glyph.querySelector('svg');
    return JSON.stringify({
      // The slot is what fades, not the button inside it: reading the button
      // reported 1 at rest and called a working swap broken.
      fold: Number(getComputedStyle(fold.parentElement).opacity),
      glyph: Number(getComputedStyle(svg).opacity),
      overlapping: Math.abs(fold.getBoundingClientRect().left - svg.getBoundingClientRect().left) <= 1,
    });
  })()`;
  const resting = JSON.parse(await api.eval(read));
  console.log("at rest:", JSON.stringify(resting));
  await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x, y: spot.y });
  await api.sleep(500);
  const hovered = JSON.parse(await api.eval(read));
  console.log("hovered:", JSON.stringify(hovered));
  await api.screenshot(`${OUT}/tree-hover.png`);
  const ok =
    resting.fold === 0 && resting.glyph === 1 && hovered.fold === 1 && hovered.glyph === 0 && hovered.overlapping;
  console.log(`${ok ? "PASS" : "FAIL"} the fold and the glyph share one slot, and swap on hover`);
  if (!ok) throw new Error("the fold does not take the glyph's place");
}
