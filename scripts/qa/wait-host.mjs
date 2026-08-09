export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  for (let i = 0; i < 30; i++) {
    await api.sleep(1000);
    const ok = await api.eval(`Boolean(document.getElementById('logue-host'))`);
    if (ok) { console.log("content script alive after", i + 1, "s"); return; }
  }
  console.log("no content script — is the extension installed in this profile?");
}
