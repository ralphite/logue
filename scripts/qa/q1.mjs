// Q1 — one empty state everywhere, said once, and the error where it can be
// seen rather than pressed against the composer.
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  const panel = `chrome-extension://${new URL(w.url).host}/sidepanel.html`;
  await api.goto(panel);
  await api.sleep(2000);
  await api.eval(`chrome.storage.local.remove(['logue:thread','logue:pending-voice'])`);
  await api.goto(panel);
  await api.sleep(2500);

  const talk = JSON.parse(await api.eval(`(() => {
    const body = document.body;
    const empty = [...body.querySelectorAll('p')].find(p => /Nothing said yet/.test(p.textContent ?? ''));
    const box = document.querySelector('[aria-label="What to ask"]');
    const r = empty?.getBoundingClientRect();
    return JSON.stringify({
      empty: Boolean(empty),
      // Centred in the space above the composer, not pinned to its edge.
      middle: r ? Math.round(r.top + r.height / 2) : null,
      composerTop: box ? Math.round(box.getBoundingClientRect().top) : null,
      viewport: window.innerHeight,
      duplicates: (body.textContent.match(/Ask about this page/g) ?? []).length,
    });
  })()`));
  check("Chat says something when it is empty", talk.empty === true, JSON.stringify(talk));
  check("…in the middle of the space, not against the composer",
    talk.middle !== null && talk.middle < talk.composerTop - 60, `line ${talk.middle}, composer ${talk.composerTop}`);
  check("…and the sentence is not printed twice", talk.duplicates <= 1, `${talk.duplicates}× "Ask about this page"`);

  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /Project/.test(b.textContent)).click()`);
  await api.sleep(900);
  const project = JSON.parse(await api.eval(`(() => {
    const empty = [...document.querySelectorAll('p')].find(p => /Choose a Project/.test(p.textContent ?? ''));
    const r = empty?.getBoundingClientRect();
    return JSON.stringify({ empty: Boolean(empty), centred: r ? Math.abs((r.top + r.height/2) - window.innerHeight/2) < 220 : null, chars: empty?.textContent.length ?? 0 });
  })()`));
  check("Project's empty state is the same shape", project.empty === true && project.centred === true, JSON.stringify(project));
  check("…and shorter than the paragraph it replaced", project.chars < 90, `${project.chars} chars`);

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) throw new Error(`${failed} checks failed`);
}
