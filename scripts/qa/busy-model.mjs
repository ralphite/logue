#!/usr/bin/env node
/**
 * A model that is busy — the one state a real model will not produce on demand.
 *
 * "This model is currently experiencing high demand" is what the owner was
 * handed, with a button to press. Everything built for it — the Host asking
 * again, the row saying so, the two further attempts — is only worth as much
 * as our ability to stand in front of it and watch, so this speaks the Gemini
 * wire format and answers 503 exactly the way Google does.
 *
 *   node scripts/qa/busy-model.mjs 8795            # busy forever
 *   node scripts/qa/busy-model.mjs 8795 --until 2  # busy twice, then answers
 *
 * The health probes (`ping`, and the silent-WAV "Reply with OK.") are always
 * answered, or the Host would mark the capability unhealthy and never reach
 * the model at all — which is a different failure than the one under test.
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] || 8795);
const at = process.argv.indexOf("--until");
/** How many real calls are refused before one is answered. Infinity by default. */
const until = at > 0 ? Number(process.argv[at + 1]) : Infinity;
/** Seconds to put in `Retry-After`, when asked for one. */
const after = process.argv.includes("--retry-after") ? 1 : 0;

let refused = 0;
let answered = 0;
/** How many refusals are left in this spike. Lowered by `GET /ease`. */
let ceiling = until;
const stopRefusing = () => {
  ceiling = refused;
};

const BUSY = {
  error: {
    code: 503,
    message:
      "This model is currently experiencing high demand. Spikes in demand are usually temporary. " +
      "Please try again later.",
    status: "UNAVAILABLE",
  },
};

const HEARD = {
  candidates: [{ content: { parts: [{ text: "A transcript from the stand-in model." }] } }],
};

createServer((request, response) => {
  // `GET /ease` — the spike passes. A check can then watch the recording
  // finish by itself, which is the whole claim being made.
  if (request.method === "GET") {
    stopRefusing();
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ refused, easing: true }));
    console.log(`${new Date().toISOString().slice(11, 23)}  ease   the spike passes`);
    return;
  }
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    // The Host's own health probes, which must pass or nothing else is reached.
    const probing = body.includes("Reply with OK.") || body.includes('"ping"');
    const busy = !probing && refused < ceiling;
    if (busy) refused += 1;
    else if (!probing) answered += 1;
    const status = busy ? 503 : 200;
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${status}  ${probing ? "probe" : "call"}  ` +
        `refused=${refused} answered=${answered}`,
    );
    const headers = { "Content-Type": "application/json" };
    if (busy && after) headers["Retry-After"] = String(after);
    response.writeHead(status, headers);
    response.end(JSON.stringify(busy ? BUSY : HEARD));
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`busy model on http://127.0.0.1:${port} — refusing ${until === Infinity ? "every" : until} call(s)`);
});
