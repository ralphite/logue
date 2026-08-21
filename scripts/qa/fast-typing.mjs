/**
 * Fast typing loses nothing and the caret stays put.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/fast-typing.mjs
 *
 * The controlled value's round trip used to race the keyboard: React could
 * render with the text from two keystrokes ago, the editor called that a
 * replacement, rolled the newest characters back and threw the caret. The
 * burst below is sent without waiting between keystrokes — tighter than
 * hands — and every character must land, in order, with the caret at the
 * end of them.
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const HEADERS = `{ 'X-Logue-Client': 'web', 'Content-Type': 'application/json' }`;

const TITLE = "QA fast typing (safe to delete)";
// A page with rendering weight: the race needs React to be busy, and an
// empty page never is. Quotes, lists and fences all carry paint.
const FILLER = Array.from({ length: 160 }, (_, i) => `- item ${i} with a tail\n  its continuation line\n> a quote line ${i}`).join("\n");
const FIXTURE = `${TITLE}\n\n${FILLER}\n\nThe line being extended.`;
const BURST = "abcdefghijklmnopqrstuvwxyz0123456789".repeat(2);

export async function run(api) {
  await api.goto(`${HOST}/stream`);
  await api.sleep(1000);
  const eva = (code) => api.eval(code);
  const found = await eva(
    `fetch('/v1/documents', { headers: ${HEADERS} }).then(r => r.json()).then(d => d.documents.find(x => (x.title ?? '') === ${JSON.stringify(TITLE)})?.id)`,
  );
  const docId =
    found ??
    (await eva(
      `fetch('/v1/documents', { method: 'POST', headers: ${HEADERS}, body: JSON.stringify({ content: ${JSON.stringify(FIXTURE)} }) }).then(r => r.json()).then(d => d.document.id)`,
    ));
  await eva(
    `fetch('/v1/documents/${docId}', { method: 'PATCH', headers: ${HEADERS}, body: ${JSON.stringify(JSON.stringify({ content: FIXTURE }))} }).then(r => r.status)`,
  );
  await api.goto(`${HOST}/documents/${docId}`);
  await api.sleep(3000);

  // Put the caret at the end of the target line, and prove it landed
  // there before typing a single character: under throttle and a long
  // document, a stale click coordinate once sent the whole burst into a
  // different line, and the check blamed the editor.
  const place = async () => {
    const spot = JSON.parse(
      await eva(`(async () => {
        // The editor grows to its full height; the pane around it is what
        // scrolls (the cm-scroller's own scrollHeight equals its client
        // height here, and scrolling it moved nothing).
        const scroller = document.querySelector('main .cm-content').closest('.logue-scroll')
          ?? document.querySelector('main .cm-scroller');
        scroller.scrollTop = scroller.scrollHeight;
        await new Promise((r) => setTimeout(r, 600));
        const line = [...document.querySelectorAll('main .cm-line')].find((l) => l.textContent === 'The line being extended.');
        if (!line) return JSON.stringify(null);
        line.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 300));
        const r2 = line.getBoundingClientRect();
        return JSON.stringify({ x: Math.round(r2.right - 4), y: Math.round(r2.top + r2.height / 2) });
      })()`),
    );
    if (!spot) return false;
    await api.click(spot.x, spot.y);
    await api.sleep(400);
    const at = await eva(`(() => {
      const node = getSelection().anchorNode;
      const line = node && (node.nodeType === 3 ? node.parentElement : node).closest('.cm-line');
      return line ? line.textContent : null;
    })()`);
    return at === "The line being extended.";
  };
  let ready = await place();
  if (!ready) ready = await place();
  if (!ready) throw new Error("could not put the caret on the target line — the check cannot say anything");

  // Slowed fourfold: the race needs the render to lag the keyboard, which a
  // fast idle machine hides. The burst is sent without waiting between
  // keystrokes — tighter than hands.
  await api.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await Promise.all([...BURST].map((ch) => api.send("Input.insertText", { text: ch })));
  await api.sleep(2500);
  await api.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  // The caret's own line, read where the caret is — virtualization cannot
  // hide the line the selection sits in.
  const read = await eva(`(() => {
    const node = getSelection().anchorNode;
    const line = node && (node.nodeType === 3 ? node.parentElement : node).closest('.cm-line');
    return line ? JSON.stringify(line.textContent) : JSON.stringify(null);
  })()`);
  const wanted = `The line being extended.${BURST}`;
  if (JSON.parse(read) !== wanted)
    throw new Error(`characters were lost or reordered:\n  got  ${read}\n  want ${JSON.stringify(wanted)}`);
  console.log("PASS every character landed, in order");

  // The caret is where typing left it: one more keystroke appends, exactly.
  await api.send("Input.insertText", { text: "!" });
  await api.sleep(600);
  const tail = await eva(`(() => {
    const node = getSelection().anchorNode;
    const line = node && (node.nodeType === 3 ? node.parentElement : node).closest('.cm-line');
    return line ? line.textContent : '';
  })()`);
  if (tail !== wanted + "!") throw new Error(`the caret moved: the next keystroke landed as ${JSON.stringify(tail.slice(-12))}`);
  console.log("PASS the caret stayed at the end of the typing");

  // And the pause still saves the whole of it.
  await api.sleep(2600);
  const stored = await eva(
    `fetch('/v1/documents/${docId}', { headers: ${HEADERS} }).then(r => r.json()).then(d => d.document.content)`,
  );
  if (!stored.includes(wanted + "!")) throw new Error("the autosave lost part of the burst");
  console.log("PASS the pause saved every character");
}
