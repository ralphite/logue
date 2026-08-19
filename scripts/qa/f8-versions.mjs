// The version model, walked over the real Host. No browser.
//
// The browser is not in the way of these questions: whether a save dedups,
// whether an agent commit lands atomically or waits, whether restore loses
// words — all of it is between the API and the store. The editor's half
// (⌘S, the banner, the dialog) was verified by hand on 2026-08-19; what a
// script can hold is held here so the model cannot drift back.
//
//   node scripts/qa/f8-versions.mjs
//
// Writes into one QA document it creates, deletes nothing.

const HOST = process.env.LOGUE_HOST || "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "\n        " + detail : ""}`);
};

async function call(method, path, body) {
  const answer = await fetch(`${HOST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Logue-Client": "qa-f8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await answer.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!answer.ok) throw Object.assign(new Error(parsed.error || answer.status), { status: answer.status });
  return parsed;
}

const versionsOf = async (id) => (await call("GET", `/v1/documents/${id}/versions`)).versions;
/** The saved versions, newest first — the order the API answers in. */
const rowsOf = (versions) => versions.filter((one) => !one.current);
const newest = (versions) => rowsOf(versions)[0];
const oldest = (versions) => rowsOf(versions).at(-1);
const wc = (versions) => versions.find((one) => one.current);

// -- the walk ---------------------------------------------------------------

const { document: doc } = await call("POST", "/v1/documents", {
  content: "# QA f8-versions run\n\none",
  author: "agent",
});
const id = doc.id;

{
  const versions = await versionsOf(id);
  check(
    "a document created by an agent starts with an agent version",
    rowsOf(versions).length === 1 && rowsOf(versions)[0].author === "agent" && !wc(versions).unsaved,
  );
}

let revision = (await call("GET", `/v1/documents/${id}`)).document.revision;
await call("PATCH", `/v1/documents/${id}`, { content: "# QA f8-versions run\n\none\n\ntyped", expected_revision: revision });
{
  const versions = await versionsOf(id);
  check("editing writes the working copy and no version", rowsOf(versions).length === 1 && wc(versions).unsaved);
}

{
  const first = await call("POST", `/v1/documents/${id}/versions`, {});
  const again = await call("POST", `/v1/documents/${id}/versions`, {});
  check("a save that changed something writes one version", first.saved === true && first.version.author === "user");
  check("a save that changed nothing is ignored", again.saved === false && again.version === null);
  check("after a save the working copy reads as its base", !wc(await versionsOf(id)).unsaved);
}

// The agent round: begin from a clean copy, the person types meanwhile, the
// commit waits instead of winning, applying keeps the person's words first.
const begun = await call("POST", `/v1/documents/${id}/agent/begin`, {});
revision = (await call("GET", `/v1/documents/${id}`)).document.revision;
await call("PATCH", `/v1/documents/${id}`, {
  content: begun.base_version.content + "\n\nthe person typed this meanwhile",
  expected_revision: revision,
});
{
  const answer = await call("POST", `/v1/documents/${id}/agent/commit`, {
    base_version_id: begun.base_version.id,
    content: begun.base_version.content + "\n\nthe agent wrote this",
    label: "qa: outrun commit",
  });
  const held = (await call("GET", `/v1/documents/${id}`)).document;
  check(
    "a commit the person outran waits instead of winning",
    answer.result === "pending" && held.content.includes("typed this meanwhile") && !!held.pending_agent,
  );
  const pending = await call("GET", `/v1/documents/${id}/pending`);
  check(
    "the pending change can be read as a diff",
    pending.lines.some((line) => line.kind === "added" && line.text.includes("agent wrote")),
  );
}
{
  const before = rowsOf(await versionsOf(id)).length;
  const applied = await call("POST", `/v1/documents/${id}/pending/apply`, {});
  const versions = await versionsOf(id);
  const authors = rowsOf(versions).map((one) => one.author);
  check(
    "applying saves the person's words first, then the agent's",
    applied.document.content.includes("agent wrote") &&
      applied.document.pending_agent === undefined &&
      rowsOf(versions).length === before + 2 &&
      authors[0] === "agent" &&
      authors[1] === "user",
    `authors newest-first: ${authors.join(",")}`,
  );
}

{
  const base = newest(await versionsOf(id));
  const fresh = await call("POST", `/v1/documents/${id}/agent/begin`, {});
  const answer = await call("POST", `/v1/documents/${id}/agent/commit`, {
    base_version_id: fresh.base_version.id,
    content: fresh.base_version.content,
  });
  check(
    "an agent that changed nothing leaves no version",
    answer.result === "unchanged" && newest(await versionsOf(id)).id === base.id,
  );
}

{
  // Restore the oldest version: the working copy goes back, nothing after it
  // disappears, and saving afterwards writes forward rather than in place.
  const rows = rowsOf(await versionsOf(id));
  await call("POST", `/v1/documents/${id}/versions/${rows.at(-1).revision}/restore`, {});
  const restored = (await call("GET", `/v1/documents/${id}`)).document;
  check(
    "restore fills the working copy and deletes nothing",
    rowsOf(await versionsOf(id)).length >= rows.length &&
      !restored.content.includes("agent wrote") &&
      restored.content.includes("one"),
  );
  const saved = await call("POST", `/v1/documents/${id}/versions`, {});
  check(
    "saving after a restore writes a new version",
    saved.saved === true && newest(await versionsOf(id)).revision === saved.version.revision,
  );
}

{
  // Discard: the waiting result goes, the person's words stay.
  const fresh = await call("POST", `/v1/documents/${id}/agent/begin`, {});
  revision = (await call("GET", `/v1/documents/${id}`)).document.revision;
  await call("PATCH", `/v1/documents/${id}`, {
    content: fresh.base_version.content + "\n\nkept through the discard",
    expected_revision: revision,
  });
  await call("POST", `/v1/documents/${id}/agent/commit`, {
    base_version_id: fresh.base_version.id,
    content: "should never land",
  });
  const dropped = (await call("POST", `/v1/documents/${id}/pending/discard`, {})).document;
  check(
    "discard drops the result and keeps the person's words",
    dropped.pending_agent === undefined && dropped.content.includes("kept through the discard"),
  );
}

{
  // An applied commit owns the one pending slot: an older waiting result
  // must not survive it, or its Apply would roll the document back.
  const fresh = await call("POST", `/v1/documents/${id}/agent/begin`, {});
  revision = (await call("GET", `/v1/documents/${id}`)).document.revision;
  await call("PATCH", `/v1/documents/${id}`, {
    content: fresh.base_version.content + "\n\ntyped before the older result",
    expected_revision: revision,
  });
  await call("POST", `/v1/documents/${id}/agent/commit`, {
    base_version_id: fresh.base_version.id,
    content: "the older result",
  });
  const second = await call("POST", `/v1/documents/${id}/agent/begin`, {});
  const applied = await call("POST", `/v1/documents/${id}/agent/commit`, {
    base_version_id: second.base_version.id,
    content: second.base_version.content + "\n\nthe newer result",
  });
  check(
    "an applied commit replaces an older waiting result",
    applied.result === "applied" && applied.document.pending_agent === undefined,
  );
}

{
  // An agent's append keeps both promises without needing a base.
  revision = (await call("GET", `/v1/documents/${id}`)).document.revision;
  const held = (await call("GET", `/v1/documents/${id}`)).document;
  await call("PATCH", `/v1/documents/${id}`, {
    content: held.content + "\n\nunsaved before the append",
    expected_revision: revision,
  });
  const before = rowsOf(await versionsOf(id)).length;
  await call("POST", `/v1/documents/${id}/append`, { text: "an appended section", author: "agent" });
  const versions = await versionsOf(id);
  check(
    "an agent append saves the person's words, then lands as an agent version",
    rowsOf(versions).length === before + 2 &&
      rowsOf(versions)[0].author === "agent" &&
      rowsOf(versions)[1].author === "user" &&
      !wc(versions).unsaved,
  );
}

{
  // A stale read is refused at begin, so an agent rewrites against now.
  let refused = false;
  try {
    await call("POST", `/v1/documents/${id}/agent/begin`, { expected_revision: 1 });
  } catch (error) {
    refused = error.status === 409;
  }
  check("a stale begin is refused with 409", refused);
}

console.log(`\n${results.filter((one) => one.ok).length}/${results.length} — ${HOST}/documents/${id}`);
process.exit(results.every((one) => one.ok) ? 0 : 1);
