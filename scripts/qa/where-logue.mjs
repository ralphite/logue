export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1200);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(2500);
  console.log(await api.eval(`(() => {
    const hits = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!/Logue/.test(n.textContent)) continue;
      const el = n.parentElement;
      hits.push(el.tagName.toLowerCase() + '.' + (el.className || '').split(' ')[0] + ' :: ' + n.textContent.trim().slice(0, 50));
    }
    return JSON.stringify(hits, null, 1);
  })()`));
}
