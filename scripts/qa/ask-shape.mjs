// What is actually on the Project page after an ask — read, not assumed.
const APP = "http://127.0.0.1:8787";

export async function run(api) {
  await api.goto(APP);
  await api.sleep(2000);
  const project = await api.eval(
    `fetch('/v1/projects').then(r => r.json()).then(d => JSON.stringify({ id: d.projects.find(p => p.name === 'Logue QA')?.id }))`,
  );
  const { id } = JSON.parse(project);
  await api.goto(`${APP}/projects/${id}`);
  await api.sleep(2500);

  console.log(
    "before:",
    await api.eval(`(() => {
    const main = document.querySelector('main');
    return JSON.stringify({
      textareas: main.querySelectorAll('textarea').length,
      inputs: main.querySelectorAll('input').length,
      buttons: [...main.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean).slice(0, 12),
    });
  })()`),
  );

  await api.eval(`(() => {
    const main = document.querySelector('main');
    const box = main.querySelector('textarea') ?? main.querySelector('input[type="text"]');
    const proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    box.focus();
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(box, 'Write one short sentence about this Project.');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const go = [...main.querySelectorAll('button')].find(b => /^(Ask|Run|Send)/i.test((b.textContent || '').trim()) && !b.disabled);
    if (!go) return 'no button';
    go.click();
    return 'asked';
  })()`);

  for (const wait of [4000, 8000, 25000]) {
    await api.sleep(wait);
    console.log(
      `after ${wait}ms:`,
      await api.eval(`(() => {
      const main = document.querySelector('main');
      const long = [...main.querySelectorAll('*')].filter(el => el.children.length === 0 && el.textContent.trim().length > 60);
      return JSON.stringify({
        busy: Boolean(main.querySelector('[class*="animate-"]')),
        longestLeaf: long.sort((a,b) => b.textContent.length - a.textContent.length)[0]?.textContent.trim().slice(0, 140) ?? null,
        leafCount: long.length,
      });
    })()`),
    );
  }

  // Where does the answer actually live? Open the newest row and look.
  console.log("opened:", await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...main.querySelectorAll('button')].find(b => /Answer questions/.test(b.textContent || ''));
    if (!row) return 'no row';
    row.click();
    return 'clicked';
  })()`));
  await api.sleep(2500);
  console.log("dialog:", await api.eval(`(() => {
    const scope = document.querySelector('[role="dialog"]') ?? document.querySelector('main');
    const leaves = [...scope.querySelectorAll('*')].filter(el => !el.children.length && el.textContent.trim().length > 40);
    return JSON.stringify({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      longest: leaves.sort((a,b) => b.textContent.length - a.textContent.length)[0]?.textContent.trim().length ?? 0,
      sample: leaves[0]?.textContent.trim().slice(0, 120) ?? null,
    });
  })()`));
}
