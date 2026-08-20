/** The drawn bullet is still text: the caret opens it, and typing works. */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const DOC = process.env.LOGUE_DOC;

export async function run(api) {
  await api.goto(`${HOST}/documents/${DOC}`);
  await api.sleep(3200);
  const before = await api.eval(`(() => {
    const line = [...document.querySelectorAll('main .cm-line')].find((l) => /^[•◦▪]\\s/.test(l.textContent));
    return line ? line.textContent.slice(0, 12) : 'no drawn bullet';
  })()`);
  console.log("at rest:", JSON.stringify(before));

  // Put the caret in that line, the way a person would.
  const spot = JSON.parse(await api.eval(`(() => {
    const line = [...document.querySelectorAll('main .cm-line')].find((l) => /^[•◦▪]\\s/.test(l.textContent));
    const r = line.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.right - 4), y: Math.round(r.top + r.height / 2) });
  })()`));
  await api.click(spot.x, spot.y);
  await api.sleep(600);
  const inside = await api.eval(`(() => {
    const line = [...document.querySelectorAll('main .cm-line')].find((l) => /one$|one[^a-z]/.test(l.textContent));
    return line ? line.textContent.slice(0, 12) : 'gone';
  })()`);
  console.log("caret inside:", JSON.stringify(inside));

  for (const text of ["!"]) {
    await api.send("Input.dispatchKeyEvent", { type: "keyDown", text });
    await api.send("Input.dispatchKeyEvent", { type: "keyUp", text });
  }
  await api.sleep(900);
  const typed = await api.eval(`document.querySelector('main .cm-content').textContent.includes('one!')`);
  console.log("typing lands:", typed);
  /*
   * Put it back through the Host, not through the keyboard.
   *
   * A backspace typed here raced the editor's own autosave and lost: the
   * document was left with the check's exclamation mark in it, which is a
   * check editing the thing it is measuring. The document is restored from
   * the text that was read before anything was typed.
   */
  // Leave the page first: the editor autosaves on a pause, and a restore
  // written while it is still open is overwritten by what it still holds.
  await api.goto(`${HOST}/documents`);
  await api.sleep(1500);
  await api.eval(`(async () => {
    const url = '/v1/documents/' + ${JSON.stringify(DOC)};
    const head = { 'content-type': 'application/json', 'X-Logue-Client': 'web' };
    const { document: doc } = await fetch(url, { headers: head }).then((r) => r.json());
    if (!doc.content.includes('one!')) return 'already clean';
    await fetch(url, { method: 'PATCH', headers: head, body: JSON.stringify({ content: doc.content.replace('one!', 'one') }) });
    return 'restored';
  })()`);
  await api.sleep(600);
  const ok = /^[•◦▪]\s/.test(before) && inside.startsWith("- ") && typed === true;
  console.log(`${ok ? "PASS" : "FAIL"} the bullet is drawn away from the caret and written under it`);
  if (!ok) throw new Error("the drawn bullet is not still text");
}
