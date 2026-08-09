// X30 — after an insert there is only undo, and it leaves on its own: five
// seconds, a click anywhere else, or the first keystroke.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const SR = `document.getElementById('logue-host').shadowRoot`;
const RECEIPT = `(() => {
  const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
  if (!bar) return null;
  const undo = [...bar.querySelectorAll('button')].find(b => /Undo/.test(b.getAttribute('aria-label') || ''));
  return undo ? JSON.stringify({ buttons: [...bar.querySelectorAll('button')].map(b => b.getAttribute('aria-label')) }) : null;
})()`;

/** Put the bar into its inserted state the way a real insert does. */
async function insert(api) {
  await api.eval(`(() => {
    const editor = document.querySelector('main [contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  })()`);
  await api.sleep(1200);
  // The page's own handshake: dictate through the bar, which ends in an
  // insert and the receipt. Uses the stand-in transcript, so no microphone.
  await api.eval(`(() => {
    const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
    const mic = [...bar.querySelectorAll('button')].find(b => /^Voice ·/.test(b.getAttribute('aria-label') || ''));
    mic.click();
  })()`);
  // Let it actually record something. Accepting the moment the tick appears
  // takes about seven tenths of a second of audio, and a fragment that short
  // transcribes to nothing — which looks exactly like the feature being
  // broken. Four seconds is a sentence.
  await api.sleep(4000);
  await api.eval(`(() => {
    const bar = [...${SR}.querySelectorAll('[role="group"]')].find(b => b.getAttribute('aria-label') === 'Logue voice');
    [...bar.querySelectorAll('button')].find(b => /Transcribe and insert/.test(b.getAttribute('aria-label') || '')).click();
  })()`);
  for (let i = 0; i < 60; i++) {
    await api.sleep(700);
    if (await api.eval(RECEIPT)) return true;
  }
  return false;
}

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const docId = await api.eval(`fetch('/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify({ title: 'Logue QA — the receipt', content: '<p>Dictated into by the receipt check.</p>' }) }).then(r => r.json()).then(d => d.document.id)`);

  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(3500);
  const arrived = await insert(api);
  check("an insert leaves a receipt", arrived === true);
  const shown = JSON.parse((await api.eval(RECEIPT)) ?? "null");
  check("…and it is undo alone — no tick, no cross",
    shown && shown.buttons.filter(b => !/^Move/.test(b || "")).length === 1 && /Undo/.test(shown.buttons.join()),
    JSON.stringify(shown));
  check("…with the handle still there", shown && shown.buttons.some(b => /^Move/.test(b || "")), JSON.stringify(shown?.buttons));

  // ① five seconds
  await api.sleep(6000);
  check("it leaves after five seconds", (await api.eval(RECEIPT)) === null);

  // ② a click somewhere else
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(2500);
  if (await insert(api)) {
    await api.eval(`document.querySelector('main')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: 40, clientY: 400 }))`);
    await api.sleep(600);
    check("a click anywhere else sends it away", (await api.eval(RECEIPT)) === null);
  } else {
    check("a click anywhere else sends it away", false, "no receipt to test");
  }

  // ③ typing
  await api.goto(`http://127.0.0.1:8787/documents/${docId}`);
  await api.sleep(2500);
  if (await insert(api)) {
    await api.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))`);
    await api.sleep(600);
    check("the first keystroke sends it away", (await api.eval(RECEIPT)) === null);
  } else {
    check("the first keystroke sends it away", false, "no receipt to test");
  }

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
