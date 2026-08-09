// Minimal CDP client on Node's built-in WebSocket. Usage:
//   node cdp.mjs <port> <script.mjs-exporting-run>
const port = process.argv[2];
// Resolved against where you ran it, not against this file: a bare relative
// import resolves next to cdp.mjs, so `node scripts/qa/cdp.mjs 9899
// ./scripts/qa/f7.mjs` went looking for scripts/qa/scripts/qa/f7.mjs.
const { pathToFileURL } = await import("node:url");
const { resolve } = await import("node:path");
const mod = await import(pathToFileURL(resolve(process.cwd(), process.argv[3])).href);

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();

let seq = 0;
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  const waiting = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    } else {
      const w = waiting.findIndex((x) => x.method === msg.method);
      if (w >= 0) waiting.splice(w, 1)[0].resolve(msg);
      else events.push(msg);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const waitEvent = (method, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const hit = events.findIndex((e) => e.method === method);
      if (hit >= 0) return resolve(events.splice(hit, 1)[0]);
      const t = setTimeout(() => reject(new Error(`timeout waiting ${method}`)), timeout);
      waiting.push({ method, resolve: (v) => { clearTimeout(t); resolve(v); } });
    });
  const open = new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  return { ws, send, waitEvent, open };
}

const pageTarget = targets.find((t) => t.type === "page");
const c = connect(pageTarget.webSocketDebuggerUrl);
await c.open;

// helpers bound to the root page session
const api = {
  send: c.send,
  waitEvent: c.waitEvent,
  async goto(url) {
    await c.send("Page.enable");
    await c.send("Page.navigate", { url });
    await c.waitEvent("Page.loadEventFired", 15000);
  },
  async eval(expression) {
    const r = await c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  },
  async click(x, y) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    }
  },
  async screenshot(path) {
    const { writeFile } = await import("node:fs/promises");
    const shot = await c.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path, Buffer.from(shot.data, "base64"));
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

try {
  await mod.run(api);
  process.exit(0);
} catch (error) {
  console.error("FAILED:", error.message);
  process.exit(1);
}
