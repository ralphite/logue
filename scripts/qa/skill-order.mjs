/**
 * Skills in the person's own order, stacked on the toolbar itself.
 *
 *   ./scripts/qa/browser.sh 9899
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/skill-order.mjs
 *
 * Reorders the workspace's Skills over the real Host, reads the selection
 * toolbar's column off a real document (2026-09-02, his correction: every
 * Skill on the toolbar, one per line — no "More Skills" menu on this surface),
 * drags a row on the Skills page, then puts the order back exactly as it was
 * found and asserts the restore — the f7 rule: a check only changes what it
 * can read back and write again. The API alone cannot un-place a Skill
 * (`position`, once written, has no endpoint that removes it), so the restore
 * finishes on the Host's own record files: every Skill's `position` is
 * snapshotted at the start and put back verbatim — value or absence — at the
 * end, and asserted. This is why the check must run on the machine the Host
 * runs on.
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const SR = `document.getElementById('logue-host').shadowRoot`;
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";
const HEADERS = `{ 'X-Logue-Client': 'web', 'Content-Type': 'application/json' }`;

// Lines are picked by their RENDERED width, not their text length: widgets
// hide URLs and marks, so a 100-character source line can render 20
// characters wide — which is how a text-length pick found nothing on a
// document whose long lines were all links (2026-09-02).
const SELECT = `(() => {
  const editor = document.querySelector('main [contenteditable="true"]');
  const ps = [...editor.querySelectorAll('.cm-line')].filter((l) => l.getBoundingClientRect().width > 120 && l.textContent.trim().length > 10);
  const target = ps.find((p) => p.getBoundingClientRect().top > 300) ?? ps[0];
  if (!target) return 'no line wide enough to select';
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
})()`;

// The Skills stand in their own group on the toolbar; a line's title is the
// Skill's full name even when the shown span truncates.
const READ_BAR = `(() => {
  const group = ${SR}.querySelector('[aria-label="Selection actions"] [aria-label="Skills"]');
  if (!group) return JSON.stringify(null);
  return JSON.stringify([...group.querySelectorAll('button[title]')].map((b) => b.title));
})()`;

export async function run(api) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });
  await api.goto(`${HOST}/stream`);
  await api.sleep(1000);

  const read = (path) => api.eval(`fetch('${path}', { headers: ${HEADERS} }).then(r => r.json())`);
  const post = (path, body) =>
    api.eval(
      `fetch('${path}', { method: 'POST', headers: ${HEADERS}, body: JSON.stringify(${JSON.stringify(body)}) }).then(r => r.json())`,
    );
  // What the toolbar should offer for the order the Host holds now: the
  // Settings choice first, then the order, filtered to what a selection runs.
  const barNames = async (preferred) => {
    const skills = (await read("/v1/context")).skills.filter((s) => s.contexts.includes("selection"));
    return [
      ...skills.filter((s) => s.id === preferred).map((s) => s.name),
      ...skills.filter((s) => s.id !== preferred).map((s) => s.name),
    ];
  };

  const found = (await read("/v1/skills")).skills;
  const before = found.map((s) => s.id);
  // The whole field, not just the sequence: value where placed, absence
  // where not. What the restore has to put back.
  const placedAtStart = new Map(found.map((s) => [s.id, s.position]));
  const dataDir = (await read("/v1/status")).data_dir;
  const preferred = ((await read("/v1/context")).defaults ?? {}).extension;

  try {
    // An order nobody would land on by accident: the current list, reversed.
    const turned = [...before].reverse();
    const served = (await post("/v1/skills/reorder", { order: turned })).skills.map((s) => s.id);
    if (JSON.stringify(served) !== JSON.stringify(turned)) throw new Error("the Host did not keep the order");
    const again = (await read("/v1/skills")).skills.map((s) => s.id);
    if (JSON.stringify(again) !== JSON.stringify(turned)) throw new Error("the order did not survive a read");

    const names = await barNames(preferred);

    // A fresh page, so the content script fetches the reordered context.
    const docId = await api.eval(
      `fetch('/v1/documents', { headers: ${HEADERS} }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => (x.content ?? '').length > 800); return (rich[0] ?? d.documents[0])?.id; })`,
    );
    await api.goto(`${HOST}/documents/${docId}`);
    await api.sleep(3000);
    await api.eval(SELECT);
    await api.sleep(2500);

    // Measure the CONTENT, not the line: a row is a fixed 24px box, so the
    // broken shape — a glyph gone block, shoving the name to a second line —
    // never changes the row's own rect. It overflows it. What is read here
    // is where the children actually end.
    const panel = JSON.parse(
      await api.eval(`(() => {
        const sr = ${SR};
        const bar = sr.querySelector('[aria-label="Selection actions"]');
        if (!bar) return JSON.stringify(null);
        const box = bar.getBoundingClientRect();
        const rows = [...bar.querySelectorAll('[aria-label="Skills"] button')].map((el) => {
          const r = el.getBoundingClientRect();
          const spill = Math.max(r.bottom, ...[...el.children].map((c) => c.getBoundingClientRect().bottom));
          const svg = el.querySelector('svg')?.getBoundingClientRect();
          return { name: el.title, top: r.top, bottom: r.bottom, spill,
                   iconInRow: svg ? svg.top >= r.top - 1 && svg.bottom <= r.bottom + 1 : true };
        });
        const range = getSelection().rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : null;
        const icons = bar.querySelector('[aria-label="Voice comment"]')?.parentElement?.getBoundingClientRect() ?? null;
        const column = bar.querySelector('[aria-label="Skills"]')?.getBoundingClientRect() ?? null;
        return JSON.stringify({ rows, more: Boolean(bar.querySelector('[aria-label="More Skills"]')),
          box: { top: box.top, bottom: box.bottom },
          icons: icons ? { top: icons.top, bottom: icons.bottom } : null,
          column: column ? { top: column.top, bottom: column.bottom } : null,
          sel: range ? { top: range.top, bottom: range.bottom } : null });
      })()`),
    );
    if (!panel) throw new Error("no selection toolbar on screen");
    // His correction, held: every Skill stands on the toolbar, none behind a menu.
    if (panel.more) throw new Error("a More Skills menu is still on the toolbar");
    if (panel.rows.length !== names.length)
      throw new Error(`the toolbar stacks ${panel.rows.length} Skills, the order says ${names.length}`);
    panel.rows.forEach((row, at) => {
      if (row.name !== names[at]) throw new Error(`line ${at} is "${row.name}", the order says "${names[at]}"`);
      // One Skill, one line: everything in the row ends inside the row.
      if (row.spill > row.bottom + 1)
        throw new Error(`"${row.name}"'s content runs ${Math.round(row.spill - row.bottom)}px past its line`);
      if (!row.iconInRow) throw new Error(`"${row.name}"'s glyph escapes its line`);
      if (at > 0 && row.top < panel.rows[at - 1].spill - 0.5)
        throw new Error(`"${row.name}" prints over "${panel.rows[at - 1].name}"`);
    });
    // The toolbar acts on the selection, so it must never stand on top of it.
    if (panel.sel && panel.box.top < panel.sel.bottom && panel.box.bottom > panel.sel.top)
      throw new Error("the toolbar covers the selection it acts on");
    // "The 3 buttons should be close to the selected text": whichever side
    // the toolbar stands on, the icon row is nearer the selection than the
    // Skills column — the column stacks away from the words, never between.
    if (panel.sel && panel.icons && panel.column) {
      const mid = (r) => (r.top + r.bottom) / 2;
      const selMid = mid(panel.sel);
      if (Math.abs(mid(panel.icons) - selMid) >= Math.abs(mid(panel.column) - selMid))
        throw new Error("the Skills column sits between the icon row and the selection");
    }
    await api.screenshot(`${OUT}/skill-order-menu.png`);
    console.log(`PASS the toolbar stacks ${panel.rows.length} Skills in the person's order, one line each, icons nearest the words`);

    // The same tab, left open while the order changes somewhere else: coming
    // back to it must show the new order without a reload.
    await api.send("Target.createTarget", { url: "about:blank" });
    await api.sleep(600);
    const rotated = [...turned.slice(1), turned[0]];
    await post("/v1/skills/reorder", { order: rotated });
    await api.send("Page.bringToFront", {});
    await api.sleep(1500);
    // The refetch races the read: coming back triggers one context fetch,
    // and the bar redraws when it lands. Three rounds, because the promise
    // is "the return shows the new order", not "it shows it within 1200ms"
    // — two rounds still missed once on a busy machine (2026-09-02, twice).
    const wantOnReturn = JSON.stringify(await barNames(preferred));
    let shownOnReturn = JSON.stringify(null);
    for (let round = 0; round < 3 && shownOnReturn !== wantOnReturn; round += 1) {
      await api.eval(SELECT);
      await api.sleep(1200);
      shownOnReturn = await api.eval(READ_BAR);
    }
    if (shownOnReturn !== wantOnReturn)
      throw new Error(`back on the tab, the bar offers ${shownOnReturn}, the new order says ${wantOnReturn}`);
    console.log("PASS an open tab shows the new order on return, without a reload");

    // The Skills page itself: dragging a row is one write to the Host. The
    // drag is synthesized as DragEvents on the page, so it exercises the real
    // handlers and the real request, not a re-implementation of them.
    await api.goto(`${HOST}/skills`);
    await api.sleep(1500);
    const pre = (await read("/v1/skills")).skills.map((s) => s.id);
    const dropped = await api.eval(`(() => {
      const rows = [...document.querySelectorAll('[draggable="true"]')];
      if (rows.length < 3) return 'too few draggable rows: ' + rows.length;
      const dt = new DataTransfer();
      const fire = (el, type, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }));
      const from = rows[2], to = rows[0];
      const box = to.getBoundingClientRect();
      fire(from, 'dragstart', 0);
      fire(to, 'dragover', box.top + 2);
      fire(to, 'drop', box.top + 2);
      fire(from, 'dragend', 0);
      return 'dropped';
    })()`);
    if (dropped !== "dropped") throw new Error(dropped);
    const want = [pre[2], ...pre.filter((id) => id !== pre[2])];
    let landed = [];
    for (let waited = 0; waited < 12; waited += 1) {
      await api.sleep(250);
      landed = (await read("/v1/skills")).skills.map((s) => s.id);
      if (JSON.stringify(landed) === JSON.stringify(want)) break;
    }
    if (JSON.stringify(landed) !== JSON.stringify(want))
      throw new Error(`the drag wrote ${JSON.stringify(landed.slice(0, 3))}…, not ${JSON.stringify(want.slice(0, 3))}…`);
    await api.screenshot(`${OUT}/skill-order-list.png`);
    console.log("PASS dragging the third row above the first told the Host once, and it kept it");
  } finally {
    // Exactly as found, and proven: the f7 rule's restore-and-assert. The
    // API restores the sequence; the record files then get each Skill's
    // `position` back verbatim — the value it had, or no field at all — so
    // a workspace that had never been arranged stays never-arranged.
    const back = (await post("/v1/skills/reorder", { order: before })).skills.map((s) => s.id);
    if (JSON.stringify(back) !== JSON.stringify(before)) throw new Error("RESTORE FAILED — the workspace holds a changed order");
    const { readFile, writeFile, rename } = await import("node:fs/promises");
    for (const [id, position] of placedAtStart) {
      const file = `${dataDir}/skills/${id}.json`;
      const record = JSON.parse(await readFile(file, "utf8"));
      if (record.position === position) continue;
      if (position === undefined) delete record.position;
      else record.position = position;
      await writeFile(`${file}.qa-restore`, JSON.stringify(record, null, 2));
      await rename(`${file}.qa-restore`, file);
    }
    const settled = (await read("/v1/skills")).skills;
    if (JSON.stringify(settled.map((s) => s.id)) !== JSON.stringify(before))
      throw new Error("RESTORE FAILED — the sequence moved while positions were being put back");
    for (const one of settled) {
      if (one.position !== placedAtStart.get(one.id))
        throw new Error(`RESTORE FAILED — "${one.name}" holds position ${one.position}, had ${placedAtStart.get(one.id)}`);
    }
    console.log("PASS the order — sequence and placement both — was put back exactly as found");
  }
}
