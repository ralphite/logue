export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1200);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(2200);
  console.log(await api.eval(`(() => {
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length || !(el.textContent ?? '').trim() || el.tagName === 'STYLE') continue;
      const s = getComputedStyle(el);
      if (s.fontSize === '16px' || s.color === 'rgb(0, 0, 0)') {
        out.push({ tag: el.tagName, cls: (el.className || '').toString().split(' ')[0], size: s.fontSize, color: s.color, text: el.textContent.trim().slice(0, 30) });
      }
    }
    return JSON.stringify(out, null, 1);
  })()`));
}
