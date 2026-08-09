/**
 * CUJ 6  — draft a document from a Project, with citations.
 * CUJ 8  — organize the Stream: search, assign, exclude, delete.
 * CUJ 9  — Skills: edit a prompt, and see the Run record which revision it used.
 * CUJ 10 — Settings: model status reads honestly; export contains the work.
 */
const WEB = "http://127.0.0.1:5173";
const HOST = "http://127.0.0.1:8787";

const api = (path, init) =>
  `fetch(${JSON.stringify(HOST + path)}, ${JSON.stringify(init ?? {})}).then(r => r.text())`;

async function get(a, path) {
  return JSON.parse(await a.eval(api(path)));
}

async function post(a, path, body, method = "POST") {
  return JSON.parse(
    await a.eval(
      `fetch(${JSON.stringify(HOST + path)}, {method:${JSON.stringify(method)},headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))}}).then(r => r.text())`,
    ),
  );
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

export async function run(a) {
  await a.goto(`${WEB}/#/stream`);
  await a.sleep(2500);

  // -- CUJ 8: the Stream lists what was captured, and can organize it ----
  const listed = await a.eval(`(() => {
    const rows = [...document.querySelectorAll('[role="button"]')];
    return JSON.stringify({ rows: rows.length, first: rows[0] ? rows[0].textContent.slice(0, 60) : null });
  })()`);
  const stream = JSON.parse(listed);
  check("CUJ 8a — Stream shows captured Sources", stream.rows > 0, `${stream.rows} rows`);

  const project = await post(a, "/v1/projects", { name: `CUJ check ${Date.now() % 100000}` });
  const projectName = project.project.name;
  const source = await post(a, "/v1/materials", {
    kind: "text",
    content: "Async studies finish more often than scheduled interviews.",
    projects: [projectName],
  });
  const excluded = await post(a, "/v1/materials", {
    kind: "text",
    content: "This note must never reach a generation.",
    projects: [projectName],
  });
  await post(a, `/v1/materials/${excluded.material.id}`, { excluded: true }, "PATCH");

  // -- CUJ 6: draft a document from the Project -------------------------
  const skills = (await get(a, "/v1/skills")).skills;
  const draft = skills.find((s) => s.built_in_key === "draft");
  const run = await post(a, "/v1/runs", {
    skill_id: draft.id,
    instruction: "Write two sentences on why asynchronous studies finish more often.",
    project: projectName,
  });

  check("CUJ 6a — draft completed", run.run.status === "complete", run.run.error ?? "");
  check(
    "CUJ 8b — an excluded Source never reaches generation",
    !run.run.sources.includes(excluded.material.id) && run.run.sources.includes(source.material.id),
  );
  check("CUJ 6b — the answer cites its Sources", (run.run.citations || []).length > 0, JSON.stringify(run.run.citations));

  const document = await post(a, `/v1/runs/${run.run.id}/document`, { title: "CUJ draft" });
  const opened = await get(a, `/v1/documents/${document.document.id}`);
  check(
    "CUJ 6c — the document carries the frozen Sources",
    opened.document.source_ids.length === run.run.sources.length && opened.sources.length > 0,
  );

  const markdown = await a.eval(api(`/v1/documents/${document.document.id}/markdown`));
  check("CUJ 6d — markdown export lists its Sources", markdown.includes("## Sources"));

  // -- CUJ 9: editing a Skill keeps old Runs explainable ----------------
  const before = draft.revision;
  const edited = await post(
    a,
    `/v1/skills/${draft.id}`,
    { instructions: `${draft.instructions} Keep it under 40 words.` },
    "PATCH",
  );
  check("CUJ 9a — editing a prompt bumps its revision", edited.skill.revision === before + 1);

  const reread = await get(a, `/v1/runs/${run.run.id}`);
  check(
    "CUJ 9b — the earlier Run still names the revision it used",
    reread.run.skill_revision === before,
    `run says ${reread.run.skill_revision}, skill is now ${edited.skill.revision}`,
  );

  // -- CUJ 10: Settings tells the truth, and export holds the work -------
  const status = await get(a, "/v1/status");
  check("CUJ 10a — model readiness is reported", status.model.generation_ready === true);

  const preview = await get(a, "/v1/backup/preview");
  check(
    "CUJ 10b — export preview counts real records",
    preview.counts.items > 0 && preview.counts.docs > 0,
    `${preview.counts.items} Sources, ${preview.counts.docs} Documents, ${preview.audio} recordings`,
  );

  // -- CUJ 8c: deleting a Source repoints what came from it -------------
  const parent = await post(a, "/v1/materials", { kind: "selection", content: "A quoted line." });
  const child = await post(a, "/v1/materials", {
    kind: "derived",
    content: "My note on it.",
    parent_ids: [parent.material.id],
  });
  await a.eval(
    `fetch(${JSON.stringify(`${HOST}/v1/materials/${parent.material.id}`)}, {method:'DELETE'}).then(r => r.text())`,
  );
  const orphan = await get(a, `/v1/materials/${child.material.id}`);
  check(
    "CUJ 8c — deleting a Source leaves no dangling child",
    orphan.material.parent_ids.length === 0 && orphan.material.orphaned === true,
  );

  // Leave the workspace as we found it.
  for (const id of [source.material.id, excluded.material.id, child.material.id]) {
    await a.eval(`fetch(${JSON.stringify(`${HOST}/v1/materials/${id}`)}, {method:'DELETE'}).then(r => r.text())`);
  }
  await a.eval(
    `fetch(${JSON.stringify(`${HOST}/v1/documents/${document.document.id}`)}, {method:'DELETE'}).then(r => r.text())`,
  );
  await a.eval(
    `fetch(${JSON.stringify(`${HOST}/v1/projects/${project.project.id}`)}, {method:'DELETE'}).then(r => r.text())`,
  );
  await post(a, `/v1/skills/${draft.id}`, { instructions: draft.instructions }, "PATCH");

  await a.screenshot(new URL("./cuj-web.png", import.meta.url).pathname);
  console.log("workspace restored");
}
