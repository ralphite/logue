export async function run(api) {
  await api.goto("http://127.0.0.1:8787/documents");
  await api.sleep(2500);
  console.log(await api.eval(`fetch('/v1/documents', { headers: { 'X-Logue-Client': 'web' } })
    .then(r => r.json())
    .then(d => {
      const bad = d.documents.find(x => !Array.isArray(x.source_ids));
      if (!bad) return 'no such record any more';
      let oldWay, newWay;
      try { oldWay = 'returned ' + bad.source_ids.length; } catch (e) { oldWay = e.constructor.name + ': ' + e.message; }
      try { newWay = 'returned ' + (bad.source_ids?.length ?? 0); } catch (e) { newWay = 'threw'; }
      return JSON.stringify({ record: bad.id, oldWay, newWay });
    })`));
}
