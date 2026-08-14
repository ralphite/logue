// F7 — the provider choice is real in the UI and round-trips to the Host.
//
// This check used to write `api_key: 'mock'` to prove the round trip, and put
// back... `api_key: 'mock'`. That was written when the workspace *had* the
// stand-in key. Run against a real one on 2026-08-13, it replaced the owner's
// Gemini key with the word "mock" and left it there; the key came back from a
// backup taken an hour earlier. `/v1/model` does not hand a key out — nothing
// does, on purpose — so a check cannot put one back, and therefore must not
// take one away. The round trip now runs **only** against the stand-in.
const APP = "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

export async function run(api) {
  await api.goto(`${APP}/settings`);
  await api.sleep(2500);

  // The provider control is a self-drawn dropdown, not a native <select> —
  // it has been since the four pages were rebuilt. Read it the way it is.
  const shown = await api.eval(`(() => {
    const pick = document.querySelector('main [aria-label="Provider"]');
    if (!pick) return null;
    return JSON.stringify({ value: (pick.textContent || '').trim(), name: pick.getAttribute('aria-label') });
  })()`);
  const seen = shown ? JSON.parse(shown) : null;
  check("Settings offers the provider choice", Boolean(seen), shown ?? "no provider control");
  check("and the current choice is shown, not hinted", Boolean(seen?.value), seen?.value ?? "");

  const model = JSON.parse(
    await api.eval(`fetch('/v1/model', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.text())`),
  );
  check("the model field carries its value", Boolean(model.model), String(model.model));

  if (model.model !== "mock") {
    // Not a skip to be quiet about: say why, so nobody reads a short run as a
    // clean one. The other half of this check needs the stand-in.
    console.log("SKIP  the provider round trip — this Host has a real key, and a key cannot be put back");
  } else {
    const flipped = await api.eval(`(async () => {
      const patch = (body) => fetch('/v1/model', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Logue-Client': 'web' }, body: JSON.stringify(body) }).then(r => r.json());
      const toOpenai = await patch({ provider: 'openai', api_key: 'mock' });
      const back = await patch({ provider: 'gemini', api_key: 'mock' });
      return JSON.stringify({ openai: { provider: toOpenai.provider, model: toOpenai.model }, back: { provider: back.provider, model: back.model } });
    })()`);
    const trip = JSON.parse(flipped);
    check("the choice round-trips to the Host", trip.openai.provider === "openai", JSON.stringify(trip.openai));
    check("and mock stays mock either way", trip.openai.model === "mock" && trip.back.model === "mock", JSON.stringify(trip));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) throw new Error(failed.map((f) => f.name).join("; "));
}
