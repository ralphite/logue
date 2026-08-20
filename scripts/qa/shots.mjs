/**
 * The screens a UI review needs, captured from the running product.
 *
 *   ./scripts/qa/browser.sh 9899 http://127.0.0.1:8787
 *   LOGUE_SHOTS=<dir> node scripts/qa/cdp.mjs 9899 ./scripts/qa/shots.mjs
 *
 * Writes PNGs to LOGUE_SHOTS (never into the repo: they are the session's,
 * and a screenshot has no business in a commit).
 */
import { extensionId } from "./extension-id.mjs";

const PORT = process.env.LOGUE_QA_PORT ?? "9899";
const HOST = process.env.LOGUE_HOST ?? "http://127.0.0.1:8787";
const OUT = process.env.LOGUE_SHOTS ?? "/tmp/logue-shots";

const firstRow = `(() => {
  const row = document.querySelector('main a[href], main [role="listitem"] a, main li a, main button[data-open]');
  if (row) { row.click(); return row.textContent.trim().slice(0, 60); }
  return 'no row';
})()`;

export async function run(api) {
  const id = await extensionId(PORT);
  const shot = async (name, note) => {
    await api.screenshot(`${OUT}/${name}.png`);
    console.log(`shot ${name}  ${note ?? ""}`);
  };

  for (const route of ["stream", "projects", "documents", "skills", "settings"]) {
    await api.goto(`${HOST}/${route}`);
    await api.sleep(2500);
    await shot(`web-${route}`);
    if (route !== "settings" && route !== "skills") {
      const clicked = await api.eval(firstRow);
      await api.sleep(2200);
      await shot(`web-${route}-detail`, clicked);
    }
  }

  await api.goto(`chrome-extension://${id}/sidepanel.html`);
  await api.sleep(3000);
  await shot("panel");
}
