// What can a person actually reach in the panel? Names, not code.
export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(3000);
  console.log(await api.eval(`(() => {
    const named = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const controls = [...document.querySelectorAll('button, a, select, textarea, input, [role="button"]')].filter(visible);
    return JSON.stringify({
      controls: controls.map(el => el.tagName.toLowerCase() + ': ' + named(el)),
      withWords: controls.filter(el => (el.textContent || '').trim().length > 0).length,
      iconOnly: controls.filter(el => !(el.textContent || '').trim()).map(el => named(el)),
      sections: [...document.querySelectorAll('h2, h3')].map(h => h.textContent.trim()),
    }, null, 1);
  })()`));
}
