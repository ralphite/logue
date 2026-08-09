// F7 — the provider choice is real in the UI and round-trips to the Host.
const APP = "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto(APP);
  await api.sleep(2500);
  await api.eval(`location.hash = '#/settings'`);
  await api.sleep(1800);

  const select = await api.eval(`(() => {
    const sel = [...document.querySelectorAll('main select')].find(s => [...s.options].some(o => o.value === 'openai'));
    if (!sel) return null;
    return JSON.stringify({ value: sel.value, options: [...sel.options].map(o => o.textContent.trim()) });
  })()`);
  const seen = select ? JSON.parse(select) : null;
  check("Settings offers the provider choice", Boolean(seen), select ?? "no select");
  check("with both wire formats named", Boolean(seen?.options.some(o => /Groq/.test(o))), (seen?.options ?? []).join(" | "));
  check("and the current choice shown", seen?.value === "gemini", String(seen?.value));

  // Round-trip on the Host without touching the browser state: switch to
  // openai (mock key keeps it ready), read it back, then restore.
  const flipped = await api.eval(`(async () => {
    const patch = (body) => fetch('/v1/model', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify(body) }).then(r => r.json());
    const toOpenai = await patch({ provider: 'openai', api_key: 'mock' });
    const back = await patch({ provider: 'gemini', api_key: 'mock' });
    return JSON.stringify({ openai: { provider: toOpenai.provider, model: toOpenai.model }, back: { provider: back.provider, model: back.model } });
  })()`);
  const trip = JSON.parse(flipped);
  check("the choice round-trips to the Host", trip.openai.provider === "openai", JSON.stringify(trip.openai));
  check("and mock stays mock either way", trip.openai.model === "mock" && trip.back.model === "mock", JSON.stringify(trip));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) throw new Error(failed.map((f) => f.name).join("; "));
}
