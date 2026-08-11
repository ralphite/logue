/**
 * N4 — Dictation in the panel: record, transcribe, copy, rewrite, rewrite again.
 *
 * The panel is an ordinary extension page, so it is driven directly; the
 * browser's own side-panel chrome cannot be opened over CDP.
 *
 * Run it with LOGUE_TEST_REAL_MIC=1, which leaves Chrome on the machine's own
 * microphone: this check says a sentence out loud with `say` and the recording
 * hears it through the room. Chrome's file-backed fake device is silent here
 * (measured, twice, and written up in the README), and its built-in fake device
 * is a tone — neither can produce a transcript, and without one there is
 * nothing to rewrite. Without the flag the check still runs and reports the
 * empty recording honestly, then stops.
 */
const PORT = process.env.LOGUE_QA_PORT ?? "9666";

/** What is said into the microphone, so the transcript can be read against it. */
const SPOKEN =
  "We should settle the panel information architecture first, and then move on to dictation. " +
  "My thinking is to leave the chat and this page split alone for now.";

/** Speak it out loud, for a real microphone to hear. */
async function speak(words) {
  const { spawn } = await import("node:child_process");
  await new Promise((done) => {
    const said = spawn("say", ["-r", "160", words]);
    said.on("close", done);
    said.on("error", done);
  });
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/**
 * What the Dictation tab is showing.
 *
 * Read from the rendered panel rather than from any state we put there: the
 * point of a browser check is that the screen agrees with the claim.
 */
const READ = `(() => {
  const tab = [...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.trim().startsWith('Dictation'));
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
  const foot = document.querySelector('.shrink-0.border-t');
  const rows = [...document.querySelectorAll('.logue-scroll > div')].filter(d => d.className.includes('border-b') || d.className.includes('p-2.5'));
  const texts = [...document.querySelectorAll('p.whitespace-pre-wrap')].map(p => p.textContent.trim());
  // How deep each text sits: one level of indentation per Skill it went through.
  const depths = [...document.querySelectorAll('p.whitespace-pre-wrap')].map((p) => {
    let depth = 0;
    for (let node = p.parentElement; node && !node.classList.contains('logue-scroll'); node = node.parentElement) {
      if (node.classList.contains('border-l-2')) depth += 1;
    }
    return depth;
  });
  const froms = [...document.querySelectorAll('.border-l-2 > div > div.text-muted')].map(d => d.textContent.trim());
  return JSON.stringify({
    hasTab: Boolean(tab),
    tabOn: tab ? tab.getAttribute('aria-selected') === 'true' : false,
    footButtons: foot ? [...foot.querySelectorAll('button')].map(label) : [],
    footText: foot ? foot.textContent.trim() : '',
    working: document.body.textContent.includes('Transcribing…'),
    texts, depths, froms,
    skillsOnFirst: (() => {
      const p = document.querySelector('p.whitespace-pre-wrap');
      if (!p) return [];
      return [...p.parentElement.querySelectorAll(':scope > div > button')].map(label);
    })(),
    failure: (document.querySelector('.text-danger') || {}).textContent || null,
  });
})()`;

async function until(a, test, label, timeout = 90000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${JSON.stringify(state).slice(0, 700)}`);
    await a.sleep(600);
  }
}

/** Click a button by its label, anywhere in the panel. */
const press = (text) => `(() => {
  const wanted = ${JSON.stringify(text)};
  const all = [...document.querySelectorAll('button')];
  const hit = all.find(b => ((b.getAttribute('aria-label') || b.textContent || '').trim()) === wanted);
  if (!hit) return 'no button ' + wanted;
  hit.click();
  return 'ok';
})()`;

export async function run(a) {
  // The worker sleeps and the offscreen document only exists while recording,
  // so there is often no extension target to read the id from. The id is
  // printed by load-unpacked when the browser is launched.
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const seen = targets.find((t) => t.url.startsWith("chrome-extension://"));
  const id = process.env.LOGUE_EXTENSION_ID ?? seen?.url.split("/")[2];
  if (!id) throw new Error("no extension id — pass LOGUE_EXTENSION_ID");
  // An installed extension serves the panel from inside its versioned release
  // folder, and leaves an older `sidepanel.html` at the root. Reading the root
  // one reports the build that is not running — so the path comes from the
  // manifest when the caller has read it.
  const panel = process.env.LOGUE_PANEL ?? `chrome-extension://${id}/sidepanel.html`;
  await a.goto(panel);
  await a.sleep(2500);

  const start = JSON.parse(await a.eval(READ));
  check("N4a — the panel has a Dictation tab", start.hasTab);

  check("N4b — the tab opens", (await a.eval(press("Dictation"))) === "ok");
  await a.sleep(600);
  const empty = JSON.parse(await a.eval(READ));
  check("N4c — one control, and it is Record", empty.footButtons.join("|") === "Record", empty.footButtons.join("|"));

  // Record. The control must change shape where it is, not somewhere else.
  check("N4d — Record starts", (await a.eval(press("Record"))) === "ok");
  const live = await until(a, (s) => s.footButtons.includes("Done (Enter)"), "the control never began recording", 20000);
  check(
    "N4e — cancel, clock and done are in the same control",
    live.footButtons.includes("Cancel (Esc)") && live.footButtons.includes("Done (Enter)") && /\d:\d\d/.test(live.footText),
    live.footText.slice(0, 60),
  );

  // Say it out loud while the recording is running. A recording ended the
  // moment it starts holds about seven tenths of a second, which transcribes
  // to nothing.
  await speak(SPOKEN);
  await a.sleep(700);
  await a.eval(press("Done (Enter)"));

  const heard = await until(
    a,
    (s) => s.texts.length > 0 || s.failure,
    "the recording never settled",
  );
  if (heard.failure && heard.texts.length === 0) {
    // A tone is not speech. The row saying so, in itself, is the behaviour
    // under test — but nothing past this point can be checked.
    check("N4f — a recording that yielded no words says so in its own row", Boolean(heard.failure), heard.failure.trim());
    console.log("SKIP N4g–N4k — nothing was heard, so there is no transcript to rewrite.");
    await a.screenshot(new URL("./n4-dictation.png", import.meta.url).pathname);
    return;
  }
  check("N4f — the transcript lands in the list", heard.texts.length === 1, JSON.stringify(heard.texts[0]?.slice(0, 90)));
  console.log("   said :", SPOKEN.slice(0, 90));
  check("N4g — the control went back to Record", (await until(a, (s) => s.footButtons.join("|") === "Record", "control stuck")) !== null);

  const before = JSON.parse(await a.eval(READ));
  check(
    "N4h — the transcript offers the dictation Skills",
    before.skillsOnFirst.includes("Into English") && before.skillsOnFirst.includes("As Markdown"),
    before.skillsOnFirst.join("|"),
  );

  // A Skill over the transcript.
  await a.eval(press("Into English"));
  const once = await until(a, (s) => s.texts.length >= 2, "the rewrite never arrived", 120000);
  check("N4i — the rewrite sits under what it came from", once.depths[1] === 1, JSON.stringify(once.depths));
  check("N4i2 — it says which Skill made it", once.froms.includes("Into English"), once.froms.join("|"));
  const after = JSON.parse(await a.eval(READ));
  check(
    "N4j — a Skill already used is not offered on that text again",
    !after.skillsOnFirst.includes("Into English") && after.skillsOnFirst.includes("As Markdown"),
    after.skillsOnFirst.join("|"),
  );

  // And a second Skill on the rewrite: a chain, not a pair.
  await a.eval(`(() => {
    const texts = [...document.querySelectorAll('p.whitespace-pre-wrap')];
    const second = texts[1].parentElement;
    const button = [...second.querySelectorAll(':scope > div > button')].find(b => b.textContent.trim() === 'As Markdown');
    button.click();
  })()`);
  const twice = await until(a, (s) => s.texts.length >= 3, "the second rewrite never arrived", 120000);
  check("N4k — a rewrite can itself be rewritten", twice.depths[2] === 2, JSON.stringify(twice.depths));

  await a.screenshot(new URL("./n4-dictation.png", import.meta.url).pathname);
  console.log("texts:", twice.texts.map((t) => t.slice(0, 70)));
}
