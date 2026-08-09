/**
 * CUJ 7 — the Side Panel: capture this page, put it in a Project, ask about it.
 *
 * The panel is an ordinary extension page, so it is driven directly rather than
 * through the browser's side-panel chrome, which CDP cannot open.
 */
const HOST = "http://127.0.0.1:8787";

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const READ = `(() => {
  const alert = document.querySelector('[role="alert"]');
  const selects = [...document.querySelectorAll('select')].map(s => s.getAttribute('aria-label'));
  const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
  const chips = [...document.querySelectorAll('button')].filter(b => /^\\d+$/.test(b.textContent.trim()));
  const answer = [...document.querySelectorAll('p')].map(p => p.textContent).find(t => t && t.length > 40);
  return JSON.stringify({
    error: alert ? alert.textContent : null,
    selects, buttons,
    chips: chips.map(c => c.textContent.trim()),
    answer: answer ? answer.slice(0, 140) : null,
    savedHeading: (document.body.textContent.match(/Saved from this page/) || [])[0] || null,
  });
})()`;

async function until(a, test, label, timeout = 90000) {
  const started = Date.now();
  for (;;) {
    const state = JSON.parse(await a.eval(READ));
    if (test(state)) return state;
    if (Date.now() - started > timeout) throw new Error(`${label}: ${JSON.stringify(state)}`);
    await a.sleep(600);
  }
}

export async function run(a) {
  const targets = await (await fetch("http://127.0.0.1:9666/json")).json();
  // The worker sleeps; any of our own extension pages reveals the same
  // id and release directory.
  const mine = targets.find((t) => t.url.startsWith("chrome-extension://") && t.url.includes("logue") === false && /offscreen\.html|background\.js|sidepanel\.html/.test(t.url));
  if (!mine) throw new Error("no extension page to derive the panel path from");
  const panel = mine.url.replace(/[^/]+$/, "sidepanel.html");
  console.log("panel:", panel);

  await a.goto(panel);
  await a.sleep(2500);

  const first = await until(a, (s) => s.selects.length > 0, "panel never rendered");
  check("CUJ 7a — the panel renders its controls", first.selects.includes("Project"), JSON.stringify(first.selects));
  check("CUJ 7b — the panel lists what is saved from this page", Boolean(first.savedHeading));
  if (first.error) console.log("panel error:", first.error);

  // The panel reads the active tab; in this window that is the panel itself,
  // which is enough to prove the Host round-trip and the Ask path.
  const projects = JSON.parse(await a.eval(`fetch("${HOST}/v1/projects").then(r => r.text())`)).projects;
  check("CUJ 7c — Projects reach the panel", projects.length > 0, `${projects.length} Projects`);

  await a.eval(`(() => {
    const area = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, 'What is this Project about? One sentence, citing a Source.');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    const select = document.querySelector('select[aria-label="Project"]');
    const setSelect = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setSelect.call(select, ${JSON.stringify("Logue")});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return 'typed';
  })()`);
  await a.sleep(1200);

  await a.eval(`(() => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Ask')).click();
    return 'asked';
  })()`);

  const answered = await until(a, (s) => Boolean(s.answer) || Boolean(s.error), "answer never arrived", 150000);
  if (answered.error) {
    check("CUJ 7d — the panel answers with Sources", false, answered.error);
  } else {
    console.log("answer:", JSON.stringify(answered.answer));
    check("CUJ 7d — the panel answers with Sources", Boolean(answered.answer));
    check("CUJ 7e — the answer carries citations", answered.chips.length > 0, JSON.stringify(answered.chips));
  }

  await a.screenshot(new URL("./cuj7-panel.png", import.meta.url).pathname);
}
