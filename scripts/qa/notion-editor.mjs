/** The editor's type and rhythm, measured against Notion's. */
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";

export async function run(api) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });
  // His own window, so the column is measured where Notion's 720 was.
  await api.send("Emulation.setDeviceMetricsOverride", { width: 1733, height: 950, deviceScaleFactor: 1, mobile: false });
  await api.goto(`${HOST}/documents`);
  await api.sleep(1800);
  const docId = process.env.LOGUE_DOC ?? await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } }).then(r => r.json()).then(d => { const rich = d.documents.filter(x => /^#\\s/m.test(x.content ?? '') && (x.content ?? '').length > 400); return (rich[0] ?? d.documents[0])?.id; })`);
  await api.goto(`${HOST}/documents/${docId}`);
  await api.sleep(3200);
  console.log(await api.eval(`(() => {
    const view = document.querySelector('main .cm-content');
    const box = view.getBoundingClientRect();
    const seen = {};
    for (const line of view.querySelectorAll('.cm-line')) {
      const r = line.getBoundingClientRect();
      const cs = getComputedStyle(line);
      const span = [...line.querySelectorAll('span')].toSorted((a, b) => b.textContent.length - a.textContent.length)[0];
      const sc = span && getComputedStyle(span);
      const kind = line.className.replace('cm-line', '').trim() || (line.textContent.trim() ? 'paragraph' : 'blank');
      if (seen[kind]) continue;
      seen[kind] = {
        text: line.textContent.trim().slice(0, 18),
        height: Math.round(r.height),
        pad: cs.paddingTop + '/' + cs.paddingBottom,
        font: sc ? sc.fontSize + '/' + sc.lineHeight + '/' + sc.fontWeight : cs.fontSize + '/' + cs.lineHeight,
      };
    }
    return JSON.stringify({ column: Math.round(box.width), left: Math.round(box.left), lines: seen }, null, 1);
  })()`));
  await api.screenshot(`${OUT}/notion-editor.png`);
  await api.send("Emulation.clearDeviceMetricsOverride");
}
