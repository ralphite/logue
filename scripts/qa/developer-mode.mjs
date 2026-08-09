/**
 * Turn Developer mode on in a test profile.
 *
 * It lives in Secure Preferences, which Chrome signs, so it cannot be written
 * by hand. The chrome://extensions page owns the toggle and can be driven
 * directly — which is exactly what a person clicking it does.
 */
const PORT = Number(process.argv[2] ?? 9777);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const target = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const call = (method, params) =>
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

await call("Page.enable", {});
await call("Page.navigate", { url: "chrome://extensions" });
await sleep(2500);

const r = await call("Runtime.evaluate", {
  expression: `(async () => {
    try {
      await chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true });
      const config = await chrome.developerPrivate.getProfileConfiguration();
      return JSON.stringify({ inDeveloperMode: config.inDeveloperMode });
    } catch (e) { return "ERR " + e.message; }
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log("developer mode:", r.result?.value, r.exceptionDetails?.exception?.description ?? "");
ws.close();
