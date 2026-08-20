/**
 * The panel with an entry in it, at the width a side panel has.
 *
 * The panel is never the page it is about — it reads the active tab. So the
 * page it is about is opened from the panel itself, in the background, the way
 * `cuj-panel` does it.
 */
import { extensionId } from "./extension-id.mjs";
const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";
const PAGE = `${HOST}/skills`;

export async function run(api) {
  const id = await extensionId(PORT);
  await api.goto(`chrome-extension://${id}/sidepanel.html`);
  await api.sleep(800);
  await api.eval(`chrome.storage.local.set({ "logue:server": ${JSON.stringify(HOST)} }).then(() => "ok")`);
  await api.eval(`chrome.tabs.create({ url: ${JSON.stringify(PAGE)}, active: false }).then((t) => String(t.id))`);
  await api.sleep(5000);
  console.log("seed:", await api.eval(`fetch('${HOST}/v1/materials', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Logue-Client': 'extension' },
    body: JSON.stringify({
      kind: 'selection',
      content: 'A passage kept from this page, so the panel has something to show while its layout is checked.',
      source: { kind: 'selection', url: ${JSON.stringify(PAGE)}, title: 'Skills' },
      tags: ['qa-panel-shot'],
    }),
  }).then(r => r.status)`));
  await api.send("Emulation.setDeviceMetricsOverride", { width: 400, height: 900, deviceScaleFactor: 2, mobile: false });
  await api.goto(`chrome-extension://${id}/sidepanel.html`);
  await api.sleep(4000);
  console.log(await api.eval(`document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200)`));
  await api.screenshot(`${OUT}/panel-entry.png`);
  await api.send("Emulation.clearDeviceMetricsOverride");
}
