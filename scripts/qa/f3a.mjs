// F3 part one — ⌘⇧K opens the panel and starts listening; Esc cancels,
// Enter accepts; what you said becomes a message in the conversation.
//
// Chrome will not synthesise its own shortcut into the browser process, so
// the key itself is proved the only way it can be: by asking Chrome whether
// it bound it. Everything after the key — the flag, the panel starting on
// its own, real audio, the message — runs for real.
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const LISTEN = "logue:listen-at";

export async function run(api) {
  // A sleeping service worker is not listed, so wake it the way a person
  // does — by visiting a page the content script runs on — and then ask.
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2000);
  const targets = await (await fetch("http://127.0.0.1:9899/json")).json();
  const worker = targets.find((t) => t.url.endsWith("/background.js"));
  if (!worker) throw new Error("the extension's worker never woke — is it installed in this profile?");
  const id = new URL(worker.url).host;
  const panel = `chrome-extension://${id}/sidepanel.html`;

  await api.goto(panel);
  await api.sleep(2500);

  const bound = await api.eval(`chrome.commands.getAll().then(all => all.map(c => c.name + '=' + (c.shortcut || 'NOTHING')))`);
  const conversation = bound.find((c) => c.startsWith("start-conversation="));
  // Chrome prints the modifiers in its own order (⇧⌘K), so match the parts,
  // not the spelling — asserting the string I expected would have failed a
  // shortcut that is perfectly bound.
  const keys = (conversation ?? "").split("=")[1] ?? "";
  check(
    "⌘⇧K is declared and Chrome actually bound it",
    keys.includes("⌘") && keys.includes("⇧") && keys.endsWith("K"),
    String(conversation),
  );

  // What the key does first: leave a flag, then open the panel. Prove the
  // flag path by writing it and re-opening the panel exactly as Chrome would.
  await api.eval(`chrome.storage.local.remove(['${LISTEN}', 'logue:thread'])`);
  await api.eval(`chrome.storage.local.set({ '${LISTEN}': Date.now() })`);
  await api.goto(panel);
  await api.sleep(3500);

  const started = await api.eval(`(() => {
    const body = document.body.textContent;
    return { listening: /Listening/.test(body), reaching: /Reaching the microphone/.test(body), head: body.slice(0, 100) };
  })()`);
  check("the panel starts listening on its own", started.listening || started.reaching, JSON.stringify(started));

  const consumed = await api.eval(`chrome.storage.local.get('${LISTEN}').then(s => Boolean(s['${LISTEN}']))`);
  check("the flag is consumed, so re-opening does not record again", consumed === false);

  // Esc cancels, and leaves nothing behind.
  await api.sleep(2500);
  await api.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await api.sleep(1200);
  const afterEsc = await api.eval(`({ listening: /Listening/.test(document.body.textContent), thread: /From this page/.test(document.body.textContent) })`);
  check("Esc cancels the recording", afterEsc.listening === false, JSON.stringify(afterEsc));
  check("…and a cancelled recording says nothing", afterEsc.thread === false);

  // The microphone button starts one too — the shortcut is not the only way.
  await api.eval(`[...document.querySelectorAll('button')].find(b => /Talk to Logue/.test(b.getAttribute('aria-label') || '')).click()`);
  await api.sleep(3500);
  check("the microphone button starts one too", (await api.eval(`/Listening/.test(document.body.textContent)`)) === true);

  // Enter accepts. Real audio goes to the Host and comes back as a message.
  await api.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))`);
  let said = null;
  for (let i = 0; i < 40; i++) {
    await api.sleep(1000);
    said = await api.eval(`(() => {
      const section = [...document.querySelectorAll('section')].find(s => /From this page/.test(s.textContent));
      if (!section) return null;
      const lines = [...section.querySelectorAll('p')].map(p => p.textContent.trim()).filter(Boolean);
      return lines[lines.length - 1] ?? null;
    })()`);
    if (said && /really arrived/.test(said)) break;
  }
  check("Enter accepts, and what you said joins the conversation", Boolean(said && /really arrived/.test(said)), String(said).slice(0, 90));

  const kept = await api.eval(`chrome.storage.local.get('logue:thread').then(s => (s['logue:thread'] || []).map(m => m.from))`);
  check("the message is kept, not only drawn", kept.includes("you"), JSON.stringify(kept));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
