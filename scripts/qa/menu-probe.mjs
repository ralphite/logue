export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(3000);
  console.log(await api.eval(`(() => {
    const main = document.querySelector('main');
    const row = [...document.querySelectorAll('button')].find(b => !main.contains(b) && (b.textContent ?? '').trim().length > 4);
    const r = row.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 40, clientY: r.top + 8 }));
    return 'sent';
  })()`));
  await api.sleep(900);
  console.log(await api.eval(`JSON.stringify({
    menus: document.querySelectorAll('[role="menu"]').length,
    anyMenuish: [...document.querySelectorAll('div')].filter(d => /Pin|Copy text|Delete/.test(d.textContent ?? '') && d.textContent.length < 120).length,
    items: document.querySelectorAll('[role="menuitem"]').length,
  })`));
}
