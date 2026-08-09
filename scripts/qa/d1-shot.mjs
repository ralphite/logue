export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1200);
  const t = await (await fetch("http://127.0.0.1:9899/json")).json();
  const w = t.find(x => x.url.endsWith("/background.js"));
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(2000);
  await api.eval(`chrome.storage.local.set({ 'logue:pending-voice': [
    { id: 's1', audio: 'AAAA', mediaType: 'audio/webm', at: new Date(Date.now()-90000).toISOString(), seconds: 22, tries: 0 }
  ], 'logue:thread': [
    { from: 'you', text: 'Does this page contradict what I saved last week?', at: '2026-08-09T19:20:00Z' },
    { from: 'skill', text: 'One thing disagrees: this page says recordings stop at 5 minutes, while what you saved in July says 10. The other four line up.', at: '2026-08-09T19:20:04Z', steps: [ { did: 'find_sources', detail: 'Agent Harness — 6 Sources' } ] }
  ] })`);
  await api.goto(`chrome-extension://${new URL(w.url).host}/sidepanel.html`);
  await api.sleep(2500);
  await api.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 2, mobile: false });
  await api.sleep(700);
  await api.screenshot("/private/tmp/claude-501/-Users-yadong-dev2-logue/8645db08-78a3-40b7-880b-e1409ffe21f5/scratchpad/panel-talk.png");
  await api.eval(`[...document.querySelectorAll('[role="tab"]')].find(b => /This page/.test(b.textContent)).click()`);
  await api.sleep(600);
  await api.screenshot("/private/tmp/claude-501/-Users-yadong-dev2-logue/8645db08-78a3-40b7-880b-e1409ffe21f5/scratchpad/panel-page.png");
  await api.eval(`chrome.storage.local.remove(['logue:pending-voice','logue:thread'])`);
  console.log("shots taken");
}
