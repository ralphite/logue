"""The agent behind the panel's conversation: it reads freely, and asks to write.

Ours, not a black box. The prompt is here, the tools it may reach for are here,
and every step it takes comes back in the answer so a person can read what
happened. That is the whole point of building it rather than sending one long
prompt: an agent whose working is invisible cannot be trusted with someone's
notes, and this product's claim is that every sentence can be traced.

Two rules shape it, both from the owner:

* **Reads happen; writes are asked for.** Finding Sources, reading the page,
  running a Skill — these change nothing, so they run. Saving a Source, filing
  something into a Project, drafting a document — these change the workspace,
  so the agent may only *propose* them, and the proposal is carried back with
  the answer for a person to confirm or discard. A write that goes through by
  default is the difference between this and every other assistant.
* **Every output carries its Sources.** An answer with no `[Source n]` is a
  chat message; this product's answers are supposed to be traceable.

The loop is short on purpose: a handful of steps, then an answer. This is
"say a thing and have it done", not a chat companion.
"""

from __future__ import annotations

import json
from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..providers import Provider
from ..store import Record, Store
from . import documents, generation, materials, projects

#: Reads run; writes are proposed. Nothing outside this list can be reached.
READS = {"find_sources", "run_skill", "answer"}
WRITES = {"save_page", "add_to_project", "draft_document"}

#: Enough to look something up, use it, and answer. Beyond this a loop is
#: usually a model talking to itself.
MAX_STEPS = 4

#: How many Sources a search hands back — enough to answer from, few enough
#: that the prompt stays mostly the question.
FOUND_LIMIT = 6

SYSTEM = """You are Logue's assistant. You work inside someone's own workspace on their Mac.

Reply with one JSON object and nothing else. No prose, no code fences.

To look something up:
{"tool": "find_sources", "query": "<words to search for>"}

To use one of the person's configured Skills:
{"tool": "run_skill", "skill_id": "<id from the list>", "instruction": "<what to ask it>"}

To propose a change to the workspace (you may never make one yourself):
{"tool": "save_page", "reason": "<why>"}
{"tool": "add_to_project", "project": "<name>", "source_ids": ["<id>"], "reason": "<why>"}
{"tool": "draft_document", "title": "<title>", "body": "<the document>", "reason": "<why>"}

To answer:
{"tool": "answer", "text": "<your answer, citing [Source n] for every claim>"}

Rules you do not break:
- Cite [Source n] for anything that comes from a Source. An uncited claim is worthless here.
- Never claim to have changed anything. A change is a proposal until the person accepts it.
- If the Sources do not answer the question, say so plainly instead of guessing.
- Answer briefly. This is a narrow panel beside the page they are reading."""


def _catalogue(store: Store) -> str:
    """The Skills this conversation may reach for, by their own declaration."""
    usable = [
        s
        for s in store.skills.list(sort_key="name", reverse=False)
        if s.get("enabled") and str(s.get("instructions") or "").strip()
    ]
    lines = [
        f"- {s['id']}: {s.get('name')} — {s.get('purpose') or 'no description'}"
        for s in usable
        if "transcription" not in (s.get("contexts") or [])
    ]
    return "\n".join(lines) or "- (none configured)"


def _decide(provider: Provider, prompt: str) -> dict[str, Any]:
    """One turn of the model, read as an action.

    A model that answers with prose instead of JSON has still said something
    worth showing, so its words become the answer rather than an error. The
    alternative — "the model did not follow the format" — is a failure the
    person cannot act on.
    """
    reply = provider.generate(SYSTEM, prompt).strip()
    body = reply
    if body.startswith("```"):
        body = body.strip("`")
        body = body[body.find("\n") + 1 :] if "\n" in body else body
        body = body.rsplit("```", 1)[0]
    start, end = body.find("{"), body.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(body[start : end + 1])
            if isinstance(parsed, dict) and parsed.get("tool"):
                return parsed
        except json.JSONDecodeError:
            pass
    return {"tool": "answer", "text": reply}


#: Words too common to narrow anything down, in a question-shaped query.
STOP = {"the", "and", "for", "what", "when", "where", "who", "why", "how", "was",
        "were", "did", "does", "with", "from", "about", "this", "that", "there",
        "have", "has", "any", "all", "into", "your", "you", "our"}


def _search(store: Store, query: str, project: str = "") -> list[Record]:
    """The phrase first, then its words — an agent asks in sentences.

    The shared search matches a phrase, which is right for a person typing
    into Find and wrong here: an agent's query is a question, and no Source
    contains "when is the kickoff?" verbatim. So the phrase is tried, and if
    nothing comes back the words are, ranked by how many of them a Source
    carries. Widening the shared search instead would have changed Find for
    everyone to fix a caller.
    """
    phrase = materials.search(store, query=query, project=project)
    if phrase:
        return phrase[:FOUND_LIMIT]
    words = [w.strip("?.,!\"'“”") for w in query.casefold().split()]
    words = [w for w in words if len(w) > 2 and w not in STOP]
    if not words:
        return []
    scored: list[tuple[int, Record]] = []
    for record in materials.search(store, project=project):
        haystack = f"{record.get('content') or ''} {record.get('context') or ''}".casefold()
        hits = sum(1 for word in words if word in haystack)
        if hits:
            scored.append((hits, record))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [record for _, record in scored[:FOUND_LIMIT]]


def converse(
    store: Store,
    provider: Provider,
    *,
    message: str,
    page: dict[str, Any] | None = None,
    project: str = "",
    history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """One turn: what the agent did, what it answered, and what it wants to do.

    `steps` is not decoration. Everything the agent touched is in it, in order,
    in words a person reads — "I searched for X, I found four things, I ran the
    Translate Skill". An agent that quietly did three things and reported one
    would be a worse product than no agent.
    """
    message = message.strip()
    if not message:
        raise BadRequest("a message is required")

    page = page or {}
    known: list[Record] = []
    steps: list[dict[str, Any]] = []
    transcript: list[str] = []
    tried: set[str] = set()
    for older in (history or [])[-6:]:
        who = "You" if older.get("from") == "you" else "Logue"
        transcript.append(f"{who}: {str(older.get('text') or '').strip()}")

    for _ in range(MAX_STEPS):
        parts = [f"Skills you can run:\n{_catalogue(store)}"]
        if project:
            parts.append(f"The person is working in the Project “{project}”.")
        if page.get("url"):
            body = str(page.get("text") or "").strip()[:4000]
            parts.append(f"The page open beside you: {page.get('title') or ''} <{page['url']}>\n{body}")
        if known:
            parts.append("Sources you have found so far:\n" + generation.numbered(known))
        if transcript:
            parts.append("Earlier in this conversation:\n" + "\n".join(transcript))
        parts.append(f"Request: {message}")
        action = _decide(provider, "\n\n".join(parts))
        tool = str(action.get("tool") or "answer")

        if tool in WRITES:
            # The end of the turn, always. A proposal waits for a person; the
            # agent does not get to keep working past it and pile up changes.
            proposal = {**action, "id": new_id("proposal")}
            steps.append({"did": tool, "detail": str(action.get("reason") or ""), "proposed": True})
            return {
                "answer": str(action.get("reason") or "There is something I could do, if you want it."),
                "steps": steps,
                "sources": known,
                "proposal": proposal,
            }

        if tool == "find_sources":
            query = str(action.get("query") or message)
            if query.casefold() in tried:
                # Asking the same question again cannot produce a new answer.
                # Without this the loop spends every step on one empty search
                # and returns "I went round several times" — measured.
                steps.append({"did": "find_sources", "detail": f"“{query}” — already tried"})
                transcript.append(f"(You already searched for “{query}”. Answer from what you have.)")
                continue
            tried.add(query.casefold())
            hits = _search(store, query, project)
            for hit in hits:
                if hit not in known:
                    known.append(hit)
            steps.append({"did": "find_sources", "detail": f"“{query}” — {len(hits)} found"})
            transcript.append(f"(You searched for “{query}” and found {len(hits)} Sources.)")
            continue

        if tool == "run_skill":
            skill_id = str(action.get("skill_id") or "")
            skill = store.skills.find(skill_id)
            if not skill:
                steps.append({"did": "run_skill", "detail": f"no Skill called {skill_id}"})
                transcript.append(f"(There is no Skill with id {skill_id}.)")
                continue
            run = generation.run_skill(
                store,
                provider,
                skill_id=skill_id,
                instruction=str(action.get("instruction") or message),
                project=project,
                source_ids=[str(k["id"]) for k in known] or None,
            )
            steps.append({"did": "run_skill", "detail": str(skill.get("name") or skill_id), "run_id": run.get("id")})
            transcript.append(f"({skill.get('name')} answered: {str(run.get('original_output') or '')[:800]})")
            continue

        return {
            "answer": str(action.get("text") or "").strip() or "Nothing came back.",
            "steps": steps,
            "sources": known,
            "proposal": None,
        }

    return {
        "answer": "I went round several times without reaching an answer. Try asking it a different way.",
        "steps": steps,
        "sources": known,
        "proposal": None,
    }


def accept(store: Store, proposal: dict[str, Any], *, page: dict[str, Any] | None = None) -> dict[str, Any]:
    """Carry out a proposal, now that a person has said yes.

    Nothing here can be reached by the agent on its own: this is only ever
    called by a route a person's click arrives at.
    """
    tool = str(proposal.get("tool") or "")
    page = page or {}
    if tool == "save_page":
        if not page.get("url"):
            raise BadRequest("there is no page to save")
        material = materials.create(
            store,
            kind="page",
            content=str(page.get("text") or page.get("title") or page["url"]),
            source={"url": page["url"], "title": page.get("title") or "", "domain": page.get("domain") or ""},
        )
        return {"did": "save_page", "material": material}

    if tool == "add_to_project":
        name = str(proposal.get("project") or "")
        if not projects.by_name(store, name):
            raise BadRequest(f"there is no Project called {name}")
        touched = []
        for source_id in [str(i) for i in (proposal.get("source_ids") or [])]:
            material = store.materials.get(source_id)
            named = list(dict.fromkeys([*(material.get("projects") or []), name]))
            touched.append(materials.update(store, source_id, {"projects": named}))
        return {"did": "add_to_project", "materials": touched}

    if tool == "draft_document":
        # Through documents.create, not by hand. A record built here missed
        # `source_ids` and `title_state`, and the rail's preview card read
        # `source_ids.length` — so hovering that row took the whole page down.
        # Two writers of one kind of record is how a field goes missing.
        document = documents.create(
            store,
            title=str(proposal.get("title") or ""),
            content=str(proposal.get("body") or ""),
        )
        return {"did": "draft_document", "document": document}

    raise BadRequest("that is not something Logue can do")
