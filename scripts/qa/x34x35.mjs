// X34 + X35 — the audio sits on the line the domain vacated, and the link
// goes to this Source in Logue rather than back to the page it came from.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(3000);
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /This page/.test(b.textContent)).click()`);
  await api.sleep(1200);

  const row = JSON.parse(await api.eval(`(() => {
    const audio = document.querySelector('audio');
    if (!audio) return JSON.stringify({ audio: false });
    // The row, read from the markup rather than guessed: player → its span →
    // the flex line → the row.
    const line = audio.parentElement?.parentElement ?? null;
    const holder = line?.parentElement ?? null;
    const text = holder?.querySelector('p') ?? null;
    const meta = [...(holder?.querySelectorAll('span') ?? [])].find(s => /ago|now/.test(s.textContent ?? ''));
    const y = (el) => el ? Math.round(el.getBoundingClientRect().top) : null;
    return JSON.stringify({ audio: true, audioTop: y(line), textTop: y(text), metaTop: y(meta) });
  })()`));
  check("a row has its recording", row.audio === true, JSON.stringify(row));
  check("the recording sits above the text", row.textTop !== null && row.audioTop < row.textTop, `audio ${row.audioTop} vs text ${row.textTop}`);

  const link = JSON.parse(await api.eval(`(() => {
    const button = document.querySelector('button[aria-label="Open this in Logue"]');
    return JSON.stringify({ present: Boolean(button), label: button?.getAttribute('aria-label') ?? null });
  })()`));
  check("the link says it opens this in Logue", link.present === true, JSON.stringify(link));

  const target = await api.eval(`(() => {
    let asked = null;
    const real = window.open;
    window.open = (url) => { asked = url; return null; };
    document.querySelector('button[aria-label="Open this in Logue"]').click();
    window.open = real;
    return asked;
  })()`);
  check("…and it goes to the Source's own page", /127\.0\.0\.1:8787\/stream\/mat_/.test(String(target)), String(target));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
