export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1200);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/manifest.json`);
  await api.sleep(800);
  console.log("panel build:", await api.eval(`JSON.parse(document.body.textContent).version_name`));
}
