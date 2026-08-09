/**
 * Grant the extension the microphone, the way the person did once by clicking
 * Allow. --use-fake-ui-for-media-stream answers the page prompt but does not
 * cover an extension's offscreen document.
 */
const PORT = Number(process.argv[2] ?? 9888);
const ID = process.argv[3] ?? "dmoloijacfpekebfmnddpjcgooplbcfe";

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

await call("Browser.grantPermissions", {
  origin: `chrome-extension://${ID}`,
  permissions: ["audioCapture"],
});
console.log("microphone granted to the extension");
ws.close();
