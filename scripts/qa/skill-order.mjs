/**
 * Skills in the person's own order, and a menu that stacks.
 *
 *   ./scripts/qa/browser.sh 9899
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/skill-order.mjs
 *
 * Reorders the workspace's Skills over the real Host, reads the selection
 * toolbar and its "More Skills" menu off a real document, drags a row on the
 * Skills page, then puts the order back exactly as it was found and asserts
 * the restore — the f7 rule: a check only changes what it can read back and
 * write again. The API alone cannot un-place a Skill (`position`, once
 * written, has no endpoint that removes it), so the restore finishes on the
 * Host's own record files: every Skill's `position` is snapshotted at the
 * start and put back verbatim — value or absence — at the end, and asserted.
 * This is why the check must run on the machine the Host runs on.
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const SR = `document.getElementById('logue-host').shadowRoot`;
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";
const HEADERS = `{ 'X-Logue-Client': 'web', 'Content-Type': 'application/json' }`;

const SELECT = `(() => {
  const editor = document.querySelector('main [contenteditable="true"]');
  const ps = [...editor.querySelectorAll('p, div, li, h1, h2, h3')].filter((p) => !p.querySelector('p, div, li') && p.textContent.trim().length > 40);
  const target = ps.find((p) => p.getBoundingClientRect().top > 300) ?? ps[0];
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
})()`;

// A Skill button carries its name twice: as the title and as the truncating
// span. The icon-only controls (voice, note, save, "More Skills") have a
// title and no span, which is what tells them apart.
const READ_BAR = `(() => {
  const bar = ${SR}.querySelector('[aria-label="Selection actions"]');
  if (!bar) return JSON.stringify(null);
  return JSON.stringify([...bar.querySelectorAll('button[title]')].filter((b) => b.querySelector('span.truncate')).map((b) => b.title));
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

    const bar = JSON.parse(
      await api.eval(`(() => {
        const sr = ${SR};
        const bar = sr.querySelector('[aria-label="Selection actions"]');
        const direct = JSON.parse(${READ_BAR});
        const more = sr.querySelector('[aria-label="More Skills"]')?.getBoundingClientRect();
        return JSON.stringify({ direct, more: more ? { x: more.x + more.width / 2, y: more.y + more.height / 2 } : null });
      })()`),
    );
    const expectDirect = names.slice(0, 2);
    if (JSON.stringify(bar.direct) !== JSON.stringify(expectDirect))
      throw new Error(`the bar offers ${JSON.stringify(bar.direct)}, the order says ${JSON.stringify(expectDirect)}`);
    if (!bar.more) throw new Error("no More Skills button to open");

    await api.click(bar.more.x, bar.more.y);
    await api.sleep(600);

    // Measure the CONTENT, not the button: the row is a fixed 24px box, so
    // the broken shape — a glyph gone block, shoving the name to a second
    // line — never changes the button's own rect. It overflows it. What is
    // read here is where the children actually end.
    const menu = JSON.parse(
      await api.eval(`(() => {
        const sr = ${SR};
        const items = [...sr.querySelectorAll('[role="menu"] [role="menuitem"]')];
        return JSON.stringify(items.map((el) => {
          const r = el.getBoundingClientRect();
          const spill = Math.max(r.bottom, ...[...el.children].map((c) => c.getBoundingClientRect().bottom));
          const svg = el.querySelector('svg')?.getBoundingClientRect();
          return { name: el.textContent.trim(), top: r.top, bottom: r.bottom, spill,
                   iconInRow: svg ? svg.top >= r.top - 1 && svg.bottom <= r.bottom + 1 : true };
        }));
      })()`),
    );
    if (menu.length !== names.length - 2)
      throw new Error(`the menu holds ${menu.length} Skills, the order says ${names.length - 2}`);
    const expectMenu = names.slice(2);
    menu.forEach((item, at) => {
      if (item.name !== expectMenu[at])
        throw new Error(`menu item ${at} is "${item.name}", the order says "${expectMenu[at]}"`);
      // One item, one line: everything in the row ends inside the row.
      if (item.spill > item.bottom + 1)
        throw new Error(`"${item.name}"'s content runs ${Math.round(item.spill - item.bottom)}px past its row`);
      if (!item.iconInRow) throw new Error(`"${item.name}"'s glyph escapes its row`);
      if (at > 0 && item.top < menu[at - 1].spill - 0.5)
        throw new Error(`"${item.name}" prints over "${menu[at - 1].name}"`);
    });
    await api.screenshot(`${OUT}/skill-order-menu.png`);
    console.log(`PASS the menu stacks ${menu.length} Skills in the person's order, one line each`);

    // The same tab, left open while the order changes somewhere else: coming
    // back to it must show the new order without a reload.
    await api.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await api.send("Target.createTarget", { url: "about:blank" });
    await api.sleep(600);
    const rotated = [...turned.slice(1), turned[0]];
    await post("/v1/skills/reorder", { order: rotated });
    await api.send("Page.bringToFront", {});
    await api.sleep(1500);
    // The refetch races the read: coming back triggers one context fetch,
    // and the bar redraws when it lands. Two rounds, because the promise is
    // "the return shows the new order", not "it shows it within 1200ms" —
    // a freshly started browser missed the first read once (2026-09-02).
    const wantOnReturn = JSON.stringify((await barNames(preferred)).slice(0, 2));
    let shownOnReturn = JSON.stringify(null);
    for (let round = 0; round < 2 && shownOnReturn !== wantOnReturn; round += 1) {
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
