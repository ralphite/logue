export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1200);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(2500);
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /This page/.test(b.textContent)).click()`);
  await api.sleep(1000);
  console.log(await api.eval(`(() => {
    const audio = document.querySelector('audio');
    if (!audio) return 'no audio';
    const row = audio.parentElement?.parentElement?.parentElement;
    return JSON.stringify({ ps: row?.querySelectorAll('p').length, tail: (row?.outerHTML ?? '').slice(-420) });
  })()`));
}
