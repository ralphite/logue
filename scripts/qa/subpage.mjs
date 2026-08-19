// The subpage model over the real Host. No browser.
//
// The editor's half — the `/` menu, the drawn block, the caret landing in the
// new page — was verified by hand on 2026-08-19; what a script can hold is the
// model: a child born under its parent, and a rename reaching every link that
// wears the old name while leaving chosen words alone.
//
//   node scripts/qa/subpage.mjs
//
// Writes into documents it creates, deletes nothing.

const HOST = process.env.LOGUE_HOST || "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "\n        " + detail : ""}`);
};

async function call(method, path, body) {
  const answer = await fetch(`${HOST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Logue-Client": "qa-subpage" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = await answer.json();
  if (!answer.ok) throw new Error(parsed.error || answer.status);
  return parsed;
}

const { document: parent } = await call("POST", "/v1/documents", { content: "# QA subpage run" });
const { document: child } = await call("POST", "/v1/documents", { parent_id: parent.id });

check("a child is born under its parent", child.parent_id === parent.id && child.title === "Untitled");

{
  const tree = (await call("GET", "/v1/documents?tree=1")).documents;
  const row = tree.find((one) => one.id === child.id);
  check("and the tree files it there", row?.parent_id === parent.id);
}

// The link the /page item writes, plus one whose words the person chose.
await call("PATCH", `/v1/documents/${parent.id}`, {
  content: `# QA subpage run\n\n[Untitled](/documents/${child.id})\n\nsee [my notes](/documents/${child.id})`,
});

{
  await call("PATCH", `/v1/documents/${child.id}`, { content: "# Named at last" });
  const told = (await call("GET", `/v1/documents/${parent.id}`)).document.content;
  check(
    "naming the child renames the link that wore Untitled",
    told.includes(`[Named at last](/documents/${child.id})`),
  );
  check("and leaves the words somebody chose", told.includes(`[my notes](/documents/${child.id})`));
}

{
  await call("PATCH", `/v1/documents/${child.id}`, { content: "# Named again" });
  const told = (await call("GET", `/v1/documents/${parent.id}`)).document.content;
  check("a second rename follows from the first name, not from Untitled", told.includes(`[Named again](/documents/${child.id})`));
}

console.log(`\n${results.filter((one) => one.ok).length}/${results.length} — ${HOST}/documents/${parent.id}`);
process.exit(results.every((one) => one.ok) ? 0 : 1);
