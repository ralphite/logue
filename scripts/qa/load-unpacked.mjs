/**
 * Install the extension the way a person does — "Load unpacked" — rather than
 * with --load-extension.
 *
 * It matters: a command-line extension that calls chrome.runtime.reload() is
 * disabled by Chrome, because there is nothing to re-add it. The self-update
 * path can only be tested against a profile-managed unpacked install.
 */
const PORT = Number(process.argv[2] ?? 9777);
const PATH = process.argv[3] ?? `${process.env.HOME}/.local/share/logue/extension`;

const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error("browser socket refused"));
});

let id = 0;
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 15000);
    const on = (e) => {
      const d = JSON.parse(e.data);
      if (d.id !== i) return;
      clearTimeout(timer);
      ws.removeEventListener("message", on);
      d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result);
    };
    ws.addEventListener("message", on);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const result = await call("Extensions.loadUnpacked", { path: PATH });
console.log("loaded:", JSON.stringify(result));

// Written down, because finding it again is otherwise guesswork: Chrome runs
// component extensions of its own, their targets look like ours, and the
// worker that would identify us is asleep most of the time. Every check reads
// this file rather than sifting the target list.
if (result?.id) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(new URL(`./.extension-${PORT}`, import.meta.url), result.id);
}
ws.close();
