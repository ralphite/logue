// Transcription quality, straight to the Host. No browser.
//
// The browser is not in the way of this question and cannot answer it: what
// the model does with real speech is between the audio and the Host. Keeping
// it out also keeps this check honest, because the browser's fake microphone
// turned out to be feeding silence (see mic-level.mjs) while every voice check
// reported passes.
//
//   node scripts/qa/speech.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOST = "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "\n        " + detail : ""}`);
};

/** macOS speaks it; nothing here depends on a recording made by hand. */
function speak(text, name) {
  const path = join(tmpdir(), name);
  execFileSync("say", ["-o", path, "--data-format=LEI16@48000", text]);
  return path;
}

function silence(seconds) {
  const rate = 48000;
  const samples = rate * seconds;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(samples * 2)]);
}

async function transcribe(audio, seconds) {
  const reply = await fetch(`${HOST}/v1/transcribe`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Logue-Client": "web" },
    body: JSON.stringify({ audio: audio.toString("base64"), media_type: "audio/wav", seconds }),
  });
  if (!reply.ok) throw new Error(`${reply.status} ${await reply.text()}`);
  return (await reply.json()).text ?? "";
}

const SAID =
  "So, um, the thing is, I I think we should, you know, basically just ship the panel " +
  "first, and then, uh, worry about the anchors later, right?";

// Two lists, because a real model is only reliable about one of them.
//
// "um", "uh", "you know" and a stuttered word are tics by any reading, and
// they go every time. "basically", "the thing is", "So", "right?" are softer
// — one run took them out, the next left them in. Asserting on those makes
// this check a coin flip, so they are reported instead and the judgement is
// the owner's, which is what S3 is for.
const TICS = ["um", "uh", "you know"];
const SOFTER = [
  { label: "basically", pattern: /\bbasically\b/i },
  { label: "the thing is", pattern: /the thing is/i },
  { label: "right?", pattern: /right\?/i },
  { label: "opening So,", pattern: /^so,/i },
];
const MEANING = ["ship", "panel", "anchors", "later"];

const heard = await transcribe(readFileSync(speak(SAID, "logue-filler.wav")), 9.6);
console.log(`\n  said:  ${SAID}\n  heard: ${heard}\n`);

check("the words that carry the meaning all survived", MEANING.every((word) => new RegExp(word, "i").test(heard)),
  MEANING.filter((word) => !new RegExp(word, "i").test(heard)).join(", ") || "all present");
check("every verbal tic is gone", !TICS.some((word) => new RegExp(`\\b${word}\\b`, "i").test(heard)),
  TICS.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(heard)).join(", ") || "none left");
check("the stutter was not kept", !/\bI I\b/.test(heard), heard.includes("I I") ? "\"I I\" survived" : "collapsed");
const soft = SOFTER.filter((one) => one.pattern.test(heard)).map((one) => one.label);
console.log(`        (softer filler left in this run: ${soft.length ? soft.join(", ") : "none"} — your call)`);
check("nothing was added — it is shorter than what was said", heard.length < SAID.length,
  `${heard.length} vs ${SAID.length} characters`);

// The one that mattered: silence is not an invitation to write something.
for (const seconds of [5, 8]) {
  const empty = await transcribe(silence(seconds), seconds);
  check(`${seconds}s of silence transcribes to nothing`, empty.trim() === "", JSON.stringify(empty));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed > 0) process.exit(1);
