/**
 * One writer, one 409 — and the stream stops there.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   node scripts/qa/cdp.mjs 9899 ./scripts/qa/save-conflict.mjs
 *
 * The night this was written, a slow Host let a queued autosave overtake an
 * unfinished one carrying an older expected_revision — the editor conflicted
 * with itself, and every pause after that sent another doomed PATCH (a 409
 * per keystroke pause, forever). This check types into its own fixture,
 * forces a genuine conflict from outside, and holds the editor to: one
 * notice, a stopped stream, and a clean recovery through "Keep mine".
 */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const HEADERS = `{ 'X-Logue-Client': 'web', 'Content-Type': 'application/json' }`;

const TITLE = "QA save conflict (safe to delete)";
const FIXTURE = `${TITLE}\n\nA line to edit under.\n`;

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

  const revisionOf = async () =>
    Number(await eva(`fetch('/v1/documents/${docId}', { headers: ${HEADERS} }).then(r => r.json()).then(d => d.document.revision)`));

  // Put the caret at the end of the last line, the way a person edits.
  const spot = JSON.parse(
    await eva(`(() => {
      const lines = [...document.querySelectorAll('main .cm-line')];
      const r = lines[lines.length - 1].getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.right - 8), y: Math.round(r.top + r.height / 2) });
    })()`),
  );
  await api.click(spot.x, spot.y);
  await api.sleep(300);

  // 1. Typing autosaves: the pause writes, the revision moves.
  const before = await revisionOf();
  await api.send("Input.insertText", { text: " first" });
  await api.sleep(2600);
  const afterSave = await revisionOf();
  if (afterSave !== before + 1) throw new Error(`autosave did not land: revision ${before} -> ${afterSave}`);
  console.log("PASS the pause saves");

  // 2. A genuine second writer, then more typing: exactly one refusal, said
  //    once, and no stream of doomed writes after it.
  await eva(
    `fetch('/v1/documents/${docId}', { method: 'PATCH', headers: ${HEADERS}, body: JSON.stringify({ content: ${JSON.stringify(FIXTURE)}.replace('A line', 'Another writer took a line') }) }).then(r => r.status)`,
  );
  const moved = await revisionOf();
  await api.send("Input.insertText", { text: " mine" });
  await api.sleep(2600);
  const notice = await eva(
    `Boolean([...document.querySelectorAll('main *')].find((el) => el.childElementCount === 0 && el.textContent.trim() === 'This document changed somewhere else. Your edits are still here, unsaved.'))`,
  );
  if (!notice) throw new Error("no conflict notice after the second writer");
  console.log("PASS the refusal is said once, on screen");
  // Keep typing through two more autosave windows: a stopped stream writes
  // nothing, so the revision holds where the other writer left it.
  await api.send("Input.insertText", { text: " and more" });
  await api.sleep(2600);
  await api.send("Input.insertText", { text: " again" });
  await api.sleep(2600);
  const held = await revisionOf();
  if (held !== moved) throw new Error(`the stream did not stop: revision ${moved} -> ${held} while conflicted`);
  console.log("PASS the doomed writes stopped");

  // 3. Keep mine: one forced save, the words on screen win, the notice goes.
  const pressed = JSON.parse(
    await eva(`(() => {
      const button = [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Keep mine');
      if (!button) return JSON.stringify(null);
      const r = button.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
    })()`),
  );
  if (!pressed) throw new Error("no Keep mine to press");
  await api.click(pressed.x, pressed.y);
  await api.sleep(2000);
  const kept = await eva(
    `fetch('/v1/documents/${docId}', { headers: ${HEADERS} }).then(r => r.json()).then(d => d.document.content)`,
  );
  if (!kept.includes("first mine and more again")) throw new Error(`Keep mine lost the words: ${JSON.stringify(kept.slice(-60))}`);
  if (kept.includes("Another writer")) throw new Error("Keep mine kept the other writer's text instead");
  const gone = await eva(
    `!Boolean([...document.querySelectorAll('main *')].find((el) => el.childElementCount === 0 && el.textContent.trim().startsWith('This document changed somewhere else')))`,
  );
  if (!gone) throw new Error("the notice stayed after Keep mine");
  console.log("PASS Keep mine writes the words on screen and clears the notice");

  // 4. Typing after recovery saves again — the editor is not stuck.
  const recovered = await revisionOf();
  await api.send("Input.insertText", { text: " onward" });
  await api.sleep(2600);
  const onward = await revisionOf();
  if (onward !== recovered + 1) throw new Error(`the editor stayed stuck after recovery: ${recovered} -> ${onward}`);
  console.log("PASS the editor saves again after recovery");
}
