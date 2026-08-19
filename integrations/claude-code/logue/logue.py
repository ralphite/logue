#!/usr/bin/env python3
"""Logue from the outside: one document, read and written over the Host's API.

An agent that is not ours gets handed a link and nothing else — no key, no
config file naming a port. So the link has to carry everything: which Host,
which document. That is what `resolve` is for, and why a base that does not
answer falls back to the loopback address the Host is installed on.

Documents are Markdown, stored as written. There is no conversion in here any
more: the converter this tool shipped with was built when Logue stored its
editor's HTML, and after the editor became a Markdown editor it was writing
HTML into a Markdown workspace and escaping Markdown on the way out.

A replacing write follows the Host's agent protocol. `begin` fixes the version
the work starts from — the Host saves the person's unsaved edits as a user
version first — and `commit` lands the whole result as an agent version. If
the person edited while the agent worked, nothing is overwritten: the result
waits beside the document for them to apply or discard.

Stdlib only, like the Host itself. Anything that needs installing is something
that can fail on someone else's machine at the moment they wanted to write a
paragraph.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

DEFAULT_BASE = "http://127.0.0.1:8787"
CLIENT = "claude-code"
TIMEOUT = 30


def die(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


# -- reaching the Host -------------------------------------------------------


def default_base() -> str:
    """Where the Host lives when the link did not say.

    `LOGUE_HOST` may be written either way round — a full URL or a bare
    `host:port` — because both are what a person types.
    """
    configured = (os.environ.get("LOGUE_HOST") or "").strip().rstrip("/")
    if not configured:
        return DEFAULT_BASE
    return configured if "://" in configured else f"http://{configured}"


def answering(base: str) -> bool:
    try:
        request = urllib.request.Request(f"{base}/v1/status", method="GET")
        request.add_header("X-Logue-Client", CLIENT)
        with urllib.request.urlopen(request, timeout=3) as response:
            return json.loads(response.read()).get("ok") is True
    except Exception:
        return False


def call(base: str, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(f"{base}{path}", data=body, method=method)
    # Not required of a caller with no Origin — the Host only demands it of web
    # pages — but sent anyway, so a Host log can tell who wrote this.
    request.add_header("X-Logue-Client", CLIENT)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            raw = response.read().decode("utf-8")
            media = response.headers.get("Content-Type", "")
            return raw if "json" not in media else (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        try:
            detail = json.loads(detail).get("error") or detail
        except Exception:
            pass
        if error.code == 409:
            die(f"Refused: {detail}\nRead the document again and rewrite against the revision it reports.")
        die(f"Logue answered {error.code}: {detail}")
    except urllib.error.URLError as error:
        die(
            f"No Logue Host is answering at {base} ({error.reason}).\n"
            "Start it, or point LOGUE_HOST at the machine that runs it."
        )
    return None


def read_link(target: str) -> tuple[str, str] | None:
    """`(base, document id)` as the link states them, or None if it states none."""
    target = target.strip()
    if target.startswith("http://") or target.startswith("https://"):
        parsed = urlparse(target)
        found = re.search(r"/documents/(doc_[0-9a-zA-Z_-]+)", parsed.path)
        return (f"{parsed.scheme}://{parsed.netloc}", found.group(1)) if found else None
    return ("", target) if re.fullmatch(r"doc_[0-9a-zA-Z_-]+", target) else None


def resolve(target: str) -> tuple[str, str]:
    """A link — or a bare id — turned into the Host to call and the document to call about."""
    read = read_link(target)
    if read is None:
        die(
            f"Not a Logue document link or id: {target}\n"
            f"A document link looks like {DEFAULT_BASE}/documents/doc_1a2b3c."
        )
        raise AssertionError  # unreachable; keeps type checkers happy
    base, document_id = read
    # The web app is sometimes served from somewhere the API is not — a dev
    # server on another port. The document id is still the document id.
    return (base if base and answering(base) else default_base()), document_id


def link_to(base: str, document_id: str) -> str:
    return f"{base}/documents/{document_id}"


# -- the text an agent hands over --------------------------------------------


def incoming(args: argparse.Namespace) -> str:
    if args.text is not None:
        return args.text
    if args.file == "-":
        return sys.stdin.read()
    if args.file:
        try:
            with open(args.file, encoding="utf-8") as handle:
                return handle.read()
        except OSError as error:
            die(f"Cannot read {args.file}: {error}")
    die("Give the text with --text or --file (use --file - for stdin).")
    raise AssertionError


# -- commands ---------------------------------------------------------------


def cmd_read(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    answer = call(base, "GET", f"/v1/documents/{document_id}")
    document = answer["document"]
    sources = answer.get("sources") or []
    body = str(document.get("content") or "")
    if args.body:
        print(body)
        return
    print("---")
    print(f"id: {document_id}")
    print(f"title: {document.get('title') or 'Untitled'}")
    print(f"revision: {document.get('revision')}")
    print(f"link: {link_to(base, document_id)}")
    print(f"sources: {len(sources)}")
    if document.get("pending_agent"):
        print("pending: an agent result is waiting for the person's review")
    print("---")
    print(body)
    if sources:
        print()
        print("--- Sources (referred to as [Source n] in the body) ---")
        for index, source in enumerate(sources, start=1):
            origin = (source.get("source") or {}).get("url") or "this Mac"
            title = (source.get("source") or {}).get("title") or str(source.get("content") or "")[:70]
            print(f"[Source {index}] {title} — {origin}")


def report_commit(answer: dict[str, Any], base: str, document_id: str) -> None:
    """What a commit came to, in words the agent should repeat to the person."""
    result = str(answer.get("result") or "")
    if result == "applied":
        version = answer.get("version") or {}
        print(f"Applied as v{version.get('revision')} (agent version) — {link_to(base, document_id)}")
        return
    if result == "unchanged":
        print("No change against the base; no version was written.")
        return
    # The first line is the report; the second is for you, the agent.
    print(
        "The person edited this document while you worked. Nothing was overwritten; "
        "your result is waiting on the document for them to apply or discard.\n"
        "(Report that and stop — do not try to force the change in.)"
    )


def cmd_write(args: argparse.Namespace) -> None:
    """Replace the body: begin against what was read, commit the whole result."""
    base, document_id = resolve(args.document)
    if args.revision is None and not args.force:
        die(
            "A replacing write must say which revision it read: --revision N "
            "(the number `read` printed), or --force to write regardless.\n"
            "Without it, an edit made since you read is built over instead of read again."
        )
    text = incoming(args)
    payload: dict[str, Any] = {} if args.revision is None else {"expected_revision": int(args.revision)}
    begun = call(base, "POST", f"/v1/documents/{document_id}/agent/begin", payload)
    answer = call(
        base,
        "POST",
        f"/v1/documents/{document_id}/agent/commit",
        {"base_version_id": begun["base_version"]["id"], "content": text, "label": args.label or ""},
    )
    report_commit(answer, base, document_id)


def cmd_begin(args: argparse.Namespace) -> None:
    """Fix the version to work from, for work too long to hold a read open."""
    base, document_id = resolve(args.document)
    payload: dict[str, Any] = {} if args.revision is None else {"expected_revision": int(args.revision)}
    begun = call(base, "POST", f"/v1/documents/{document_id}/agent/begin", payload)
    version = begun["base_version"]
    base_id = str(version.get("id") or "")
    print("---")
    print(f"id: {document_id}")
    print(f"base: {base_id or '(none — the document is empty and unsaved)'}")
    print(f"link: {link_to(base, document_id)}")
    print("---")
    print(str(version.get("content") or ""))


def cmd_commit(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    answer = call(
        base,
        "POST",
        f"/v1/documents/{document_id}/agent/commit",
        {"base_version_id": args.base or "", "content": incoming(args), "label": args.label or ""},
    )
    report_commit(answer, base, document_id)


def cmd_append(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    document = call(
        base, "POST", f"/v1/documents/{document_id}/append", {"text": incoming(args), "author": "agent"}
    )["document"]
    print(f"Appended, as an agent version. Now revision {document.get('revision')} — {link_to(base, document_id)}")


def cmd_create(args: argparse.Namespace) -> None:
    base = default_base()
    text = "" if (args.text is None and not args.file) else incoming(args)
    document = call(
        base, "POST", "/v1/documents", {"title": args.title or "", "content": text, "author": "agent"}
    )["document"]
    print(f"Created {document['id']} — {link_to(base, str(document['id']))}")


def cmd_list(args: argparse.Namespace) -> None:
    base = default_base()
    documents = call(base, "GET", "/v1/documents")["documents"]
    if args.query:
        wanted = args.query.lower()
        documents = [d for d in documents if wanted in str(d.get("title") or "").lower()]
    if not documents:
        print("No documents.")
        return
    for document in documents[: args.limit]:
        title = str(document.get("title") or "Untitled")
        print(f"{link_to(base, str(document['id']))}  rev {document.get('revision')}  {title}")


def cmd_versions(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    for version in call(base, "GET", f"/v1/documents/{document_id}/versions")["versions"]:
        when = str(version.get("created_at") or "")
        if version.get("current"):
            state = "unsaved changes" if version.get("unsaved") else "as saved"
            print(f"now          {when}  working copy — {state}")
            continue
        who = str(version.get("author") or "user")
        summary = str(version.get("summary") or "")
        if not summary:
            # No written line: the counts are the row's own description here,
            # the way the +a −r marks carry it in the app.
            added, removed = int(version.get("added") or 0), int(version.get("removed") or 0)
            summary = " ".join(([f"+{added}"] if added else []) + ([f"−{removed}"] if removed else []))
        label = str(version.get("label") or "")
        tail = f"  [{label}]" if label else ""
        number = "v" + str(version.get("revision"))
        print(f"{number:<5} {who:<6} {when}  {summary}{tail}")


def cmd_status(_: argparse.Namespace) -> None:
    base = default_base()
    status = call(base, "GET", "/v1/status")
    model = status.get("model") or {}
    print(f"Host {base} — ok, data in {status.get('data_dir')}")
    print(f"model {model.get('model')} — generation {model.get('generation')}, voice {model.get('voice')}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="logue.py", description="Read and write Logue documents from a link.")
    subs = parser.add_subparsers(dest="command", required=True)

    def with_text(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--text", help="the text itself, as Markdown")
        sub.add_argument("--file", help="a file holding the text; - for stdin")

    read = subs.add_parser("read", help="print a document as stored — it is Markdown")
    read.add_argument("document", help="document link or doc_ id")
    read.add_argument("--body", action="store_true", help="the body alone, no header")
    read.set_defaults(run=cmd_read)

    write = subs.add_parser("write", help="replace a document's whole body, as an agent version")
    write.add_argument("document")
    write.add_argument("--revision", type=int, help="the revision `read` reported")
    write.add_argument("--force", action="store_true", help="write without checking the revision")
    write.add_argument("--label", help="a few words `versions` shows beside your version")
    with_text(write)
    write.set_defaults(run=cmd_write)

    begin = subs.add_parser("begin", help="fix the version to work from; prints the base id and body")
    begin.add_argument("document")
    begin.add_argument("--revision", type=int, help="refuse if the document has moved past this")
    begin.set_defaults(run=cmd_begin)

    commit = subs.add_parser("commit", help="land the finished result against the base `begin` printed")
    commit.add_argument("document")
    commit.add_argument("--base", required=True, help="the base id `begin` printed (empty string when it printed none)")
    commit.add_argument("--label", help="a few words `versions` shows beside your version")
    with_text(commit)
    commit.set_defaults(run=cmd_commit)

    append = subs.add_parser("append", help="add to the end of a document")
    append.add_argument("document")
    with_text(append)
    append.set_defaults(run=cmd_append)

    create = subs.add_parser("create", help="make a new document")
    create.add_argument("--title", help="its title, written in as the first line")
    with_text(create)
    create.set_defaults(run=cmd_create)

    listing = subs.add_parser("list", help="documents, newest edit first")
    listing.add_argument("query", nargs="?", help="only titles containing this")
    listing.add_argument("--limit", type=int, default=30)
    listing.set_defaults(run=cmd_list)

    versions = subs.add_parser("versions", help="a document's history, and who saved each state")
    versions.add_argument("document")
    versions.set_defaults(run=cmd_versions)

    subs.add_parser("status", help="is the Host answering, and with which model").set_defaults(run=cmd_status)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
