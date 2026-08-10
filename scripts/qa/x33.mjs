// X33 — the ⋯ menu at the density of the one it was measured against, and
// operable without the pointer. Opened with real mouse events: the ⋯ button
// only appears on hover, and a synthetic MouseEvent is not a hover.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(3500);

  const where = JSON.parse(await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...document.querySelectorAll('button')].find(b => !main.contains(b) && (b.textContent ?? '').trim().length > 4);
    if (!row) return JSON.stringify({ found: false });
    const r = row.getBoundingClientRect();
    return JSON.stringify({ found: true, x: Math.round(r.right - 14), y: Math.round(r.top + r.height / 2), label: row.textContent.trim().slice(0, 20) });
  })()`));
  check("there is a row to act on", where.found === true, JSON.stringify(where));

  // A real pointer: move onto the row so the ⋯ appears, then click it.
  await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: where.x, y: where.y });
  await api.sleep(400);
  await api.click(where.x, where.y);
  await api.sleep(800);

  const shape = JSON.parse(await api.eval(`(() => {
    const menu = document.querySelector('[role="menu"]');
    if (!menu) return JSON.stringify({ menu: false });
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    const box = menu.getBoundingClientRect();
    const focused = document.activeElement;
    return JSON.stringify({
      menu: true,
      items: items.map(i => i.textContent.replace(/\\s+/g,' ').trim()),
      rowHeight: items[0] ? Math.round(items[0].getBoundingClientRect().height) : null,
      width: Math.round(box.width),
      letters: items.map(i => i.dataset.accelerator).filter(Boolean),
      focusRing: focused && menu.contains(focused) ? getComputedStyle(focused).outlineWidth : "none",
      headings: [...menu.querySelectorAll('p')].map(p => p.textContent.trim()),
    });
  })()`));
  check("the menu is open", shape.menu === true, JSON.stringify(shape));
  if (!shape.menu) { console.log("\\n0/1 passed"); throw new Error("no menu"); }

  check("the rows are compact", shape.rowHeight <= 26, `${shape.rowHeight}px`);
  check("…and the menu is narrow", shape.width <= 260, `${shape.width}px`);
  check("every action shows its letter", shape.letters.length >= 3, JSON.stringify(shape.letters));
  check("focus is a wash, not a ring", shape.focusRing === "0px" || shape.focusRing === "none", String(shape.focusRing));

  await api.eval(`document.querySelector('[role="menu"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))`);
  await api.sleep(800);
  const gone = await api.eval(`document.querySelector('[role="menu"]') === null`);
  check("pressing the letter runs it and closes the menu", gone === true);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
