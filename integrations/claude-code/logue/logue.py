#!/usr/bin/env python3
"""Logue from the outside: one document, read and written over the Host's API.

An agent that is not ours gets handed a link and nothing else — no key, no
config file naming a port. So the link has to carry everything: which Host,
which document. That is what `resolve` is for, and why a base that does not
answer falls back to the loopback address the Host is installed on.

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
from html.parser import HTMLParser
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
            die(f"Refused: {detail}\nRead the document again and rewrite against the version it reports.")
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


# -- the document's markup, both ways ---------------------------------------
#
# Logue stores what its own editor stores: HTML. An agent writes Markdown. So
# both directions are needed, and they have to agree — an agent that reads,
# changes one paragraph and writes the whole thing back must not reformat the
# rest of the document on its way past.
#
# One line in, one block out. Not CommonMark: a blank line is a blank line and
# two adjacent lines are two paragraphs, which is exactly how the editor
# behaves and therefore the only mapping that round-trips.
#
# Two things this got wrong when it was run over the 49 documents actually in
# the workspace, and both are in here as rules now:
#
# * **A blank line is a `<br>`, never a tag boundary.** Ending one block and
#   starting the next used to emit an empty line between them, so a full
#   rewrite quietly double-spaced the person's document.
# * **Text that merely looks like Markdown is escaped.** Real documents have
#   lines typed as `## 需求` and `1. X11` that are plain text, because the
#   editor has no headings. Left alone they came back as real headings and a
#   renumbered list — markup the person never asked for, in the middle of an
#   edit they asked for somewhere else.

INLINE_TAGS = {"strong": "**", "b": "**", "em": "*", "i": "*", "code": "`", "mark": "=="}
BLOCK_TAGS = {"p", "div", "li", "blockquote", "pre", "tr", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6"}

#: A line starting like this would be read back as markup, so it is escaped —
#: the backslash going in front of the punctuation, never in front of a digit,
#: because `\1` is not an escape and would still be a backslash on the way back.
LOOKS_LIKE_MARKUP = re.compile(r"(#{1,6}\s|[-+]\s|>\s)")
LOOKS_LIKE_NUMBERING = re.compile(r"^(\d+)([.)]\s)")


def _protect(text: str) -> str:
    """Text that is only text, kept that way.

    A document holding the characters `**bold**` — typed, or written by a model
    into a document nobody has edited since — is not holding bold. Reading it
    as Markdown and writing it back would make it bold, which is a change to
    somebody's document that nobody asked for.
    """
    text = text.replace("\\", "\\\\")
    text = re.sub(r"([*`])", r"\\\1", text)
    return text.replace("==", "\\=\\=")


class _AsMarkdown(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[str] = []
        self.line = ""
        self.prefix = ""
        self.lists: list[list[Any]] = []
        self.hrefs: list[str] = []
        # Inside `<code>` there is no such thing as an escape: a backslash is a
        # backslash and `===` is three characters. Escaping in there turned
        # `tab === "talk"` into `tab \=\== "talk"` on the way out.
        self.code_depth = 0
        self.code_at = 0

    def _flush(self, *, keep_empty: bool = False) -> None:
        """End the current block. Empty ones are dropped unless a `<br>` meant it."""
        # Only ASCII whitespace: a leading `&nbsp;` is indentation somebody typed.
        text = re.sub(r"[ \t]+", " ", self.line).strip(" \t\r\n")
        if not text and not keep_empty:
            self.line = ""
            self.prefix = ""
            return
        if text and not self.prefix:
            if LOOKS_LIKE_MARKUP.match(text):
                text = f"\\{text}"
            else:
                text = LOOKS_LIKE_NUMBERING.sub(r"\1\\\2", text, count=1)
        self.blocks.append(f"{self.prefix}{text}" if text else "")
        self.line = ""
        self.prefix = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "br":
            self._flush(keep_empty=True)
            return
        if tag in {"ul", "ol"}:
            self.lists.append([tag, 0])
            return
        if tag == "a":
            self.hrefs.append(dict(attrs).get("href") or "")
            self.line += "["
            return
        if tag == "code":
            if not self.code_depth:
                self.code_at = len(self.line)
            self.code_depth += 1
            return
        if tag in INLINE_TAGS:
            self.line += INLINE_TAGS[tag]
            return
        if tag in BLOCK_TAGS:
            self._flush()
            if tag.startswith("h") and len(tag) == 2 and tag[1].isdigit():
                self.prefix = "#" * int(tag[1]) + " "
            elif tag == "li" and self.lists:
                self.lists[-1][1] += 1
                self.prefix = f"{self.lists[-1][1]}. " if self.lists[-1][0] == "ol" else "- "
            elif tag == "li":
                self.prefix = "- "
            elif tag == "blockquote":
                self.prefix = "> "

    def handle_endtag(self, tag: str) -> None:
        if tag in {"ul", "ol"}:
            if self.lists:
                self.lists.pop()
            return
        if tag == "a":
            href = self.hrefs.pop() if self.hrefs else ""
            self.line += f"]({href})"
            return
        if tag == "code":
            self.code_depth = max(0, self.code_depth - 1)
            if not self.code_depth:
                inside = self.line[self.code_at :]
                # Long enough to hold whatever is in there, as Markdown fences.
                runs = [len(run) for run in re.findall(r"`+", inside)]
                fence = "`" * ((max(runs) + 1) if runs else 1)
                self.line = f"{self.line[: self.code_at]}{fence}{inside}{fence}"
            return
        if tag in INLINE_TAGS:
            self.line += INLINE_TAGS[tag]
            return
        if tag in BLOCK_TAGS:
            self._flush()

    def handle_data(self, data: str) -> None:
        # A newline inside text is a real line: Logue's stored HTML has no
        # pretty-printing whitespace in it, and documents made straight from a
        # generation are plain text with newlines and no tags at all.
        #
        # Unless it is *only* whitespace sitting between two tags — which is
        # what `append` leaves behind, joining the old body to the new one with
        # a blank line the browser never renders. Reading that as two blank
        # lines would put them into the document on the next rewrite.
        if not data.strip() and not self.line:
            return
        lines = data.split("\n")
        for index, part in enumerate(lines):
            if index:
                self._flush(keep_empty=True)
            self.line += part if self.code_depth else _protect(part)

    def result(self) -> str:
        self._flush()
        lines = self.blocks
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        return "\n".join(lines)


def html_to_markdown(content: str) -> str:
    parser = _AsMarkdown()
    parser.feed(content or "")
    parser.close()
    return parser.result()


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _hold_code(text: str, held: list[str]) -> str:
    """Lift code spans out, pairing runs of backticks by length.

    A regex looking for the next backtick pairs a stray ``` with whatever
    backtick comes later in the line and swallows everything between — which is
    how `**49/50 篇往返零差异**` ended up inside a code span. A run only closes
    against a run of its own length; one that never closes stays text.
    """
    out: list[str] = []
    at = 0
    while at < len(text):
        if text[at] != "`":
            out.append(text[at])
            at += 1
            continue
        fence = re.match(r"`+", text[at:]).group(0)  # type: ignore[union-attr]
        close = at + len(fence)
        while True:
            close = text.find(fence, close)
            if close == -1 or text[close + len(fence) : close + len(fence) + 1] != "`":
                break
            close += 1
        if close == -1:
            out.append(fence)
            at += len(fence)
            continue
        held.append(text[at + len(fence) : close])
        out.append(f"\x00{len(held) - 1}\x00")
        at = close + len(fence)
    return "".join(out)


def _inline(text: str) -> str:
    """Markdown's inline marks, into tags. Escaped first: this is somebody's page.

    Code spans are lifted out before anything else runs, and a lone backtick is
    left as a backtick — a document holding a ``` fence used to come back with
    an empty `<code>` in the middle of it.
    """
    held: list[str] = []
    literal: list[str] = []

    def keep(match: re.Match[str]) -> str:
        literal.append(match.group(1))
        return f"\x01{len(literal) - 1}\x01"

    # `\*` means a star, and nothing below may look at it again. Punctuation
    # only, as Markdown has it: `C:\path` is a path, not an escaped `p`.
    text = re.sub(r"\\([\\`*_{}\[\]()#+\-.!>=~|])", keep, text)
    out = _escape(_hold_code(text, held))
    out = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', out)
    out = re.sub(r"\*\*(?=\S)(.+?)(?<=\S)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"==(?=\S)(.+?)(?<=\S)==", r"<mark>\1</mark>", out)
    out = re.sub(r"(?<![\*\w])\*(?=\S)([^\*]+?)(?<=\S)\*(?!\*)", r"<em>\1</em>", out)
    out = re.sub(r"(?<![_\w])_(?=\S)([^_]+?)(?<=\S)_(?!\w)", r"<em>\1</em>", out)
    out = re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{_escape(held[int(m.group(1))])}</code>", out)
    return re.sub(r"\x01(\d+)\x01", lambda m: _escape(literal[int(m.group(1))]), out)


def markdown_to_html(text: str) -> str:
    out: list[str] = []
    open_list: str | None = None

    def close() -> None:
        nonlocal open_list
        if open_list:
            out.append(f"</{open_list}>")
            open_list = None

    for raw in (text or "").replace("\r\n", "\n").split("\n"):
        # ASCII only: a trailing `&nbsp;` is a character in the document.
        line = raw.rstrip(" \t")
        if not line.strip():
            close()
            out.append("<div><br></div>")
            continue
        # An escaped line — `\## 需求`, `1\. 执行前验证` — matches none of the
        # patterns below, falls through to the plain block, and `_inline` takes
        # the backslashes off there. That is the whole mechanism.
        heading = re.match(r"(#{1,6})\s+(.*)$", line)
        bullet = re.match(r"\s*[-*+]\s+(.*)$", line)
        numbered = re.match(r"\s*(\d+)[.)]\s+(.*)$", line)
        quoted = re.match(r"\s*>\s?(.*)$", line)
        if heading:
            close()
            level = len(heading.group(1))
            out.append(f"<h{level}>{_inline(heading.group(2))}</h{level}>")
        elif bullet or numbered:
            wanted = "ul" if bullet else "ol"
            if open_list != wanted:
                close()
                out.append(f"<{wanted}>")
                open_list = wanted
            body = bullet.group(1) if bullet else numbered.group(2)  # type: ignore[union-attr]
            out.append(f"<li>{_inline(body)}</li>")
        elif quoted:
            close()
            out.append(f"<blockquote>{_inline(quoted.group(1))}</blockquote>")
        else:
            close()
            out.append(f"<div>{_inline(line)}</div>")
    close()
    return "".join(out)


# -- reading the text an agent hands over -----------------------------------


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


def body_for(args: argparse.Namespace, text: str) -> str:
    """What actually gets stored: the agent's HTML verbatim, or its Markdown converted."""
    return text if args.html else markdown_to_html(text)


# -- commands ---------------------------------------------------------------


def cmd_read(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    answer = call(base, "GET", f"/v1/documents/{document_id}")
    document = answer["document"]
    sources = answer.get("sources") or []
    content = str(document.get("content") or "")
    body = content if args.raw else html_to_markdown(content)
    if args.body:
        print(body)
        return
    print("---")
    print(f"id: {document_id}")
    print(f"title: {document.get('title') or 'Untitled'}")
    print(f"revision: {document.get('revision')}")
    print(f"link: {link_to(base, document_id)}")
    print(f"format: {'html (stored form)' if args.raw else 'markdown'}")
    print(f"sources: {len(sources)}")
    print("---")
    print(body)
    if sources:
        print()
        print("--- Sources (referred to as [Source n] in the body) ---")
        for index, source in enumerate(sources, start=1):
            origin = (source.get("source") or {}).get("url") or "this Mac"
            title = (source.get("source") or {}).get("title") or str(source.get("content") or "")[:70]
            print(f"[Source {index}] {title} — {origin}")


def cmd_write(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    if args.revision is None and not args.force:
        die(
            "A replacing write must say which version it read: --revision N "
            "(the number `read` printed), or --force to write regardless.\n"
            "Without it, an edit the person made while you were thinking is lost silently."
        )
    changes: dict[str, Any] = {"content": body_for(args, incoming(args))}
    if args.title:
        changes["title"] = args.title
        changes["title_state"] = "edited"
    if args.revision is not None:
        changes["expected_revision"] = int(args.revision)
    document = call(base, "PATCH", f"/v1/documents/{document_id}", changes)["document"]
    print(f"Written. Now revision {document.get('revision')} — {link_to(base, document_id)}")


def cmd_append(args: argparse.Namespace) -> None:
    base, document_id = resolve(args.document)
    text = body_for(args, incoming(args))
    document = call(base, "POST", f"/v1/documents/{document_id}/append", {"text": text})["document"]
    print(f"Appended. Now revision {document.get('revision')} — {link_to(base, document_id)}")


def cmd_create(args: argparse.Namespace) -> None:
    base = default_base()
    text = "" if (args.text is None and not args.file) else body_for(args, incoming(args))
    document = call(base, "POST", "/v1/documents", {"title": args.title or "", "content": text})["document"]
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
        mark = "now" if version.get("current") else "   "
        summary = version.get("summary") or version.get("line") or ""
        print(f"{mark} r{version.get('revision')}  {version.get('created_at')}  {summary}")


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
        sub.add_argument("--text", help="the text itself")
        sub.add_argument("--file", help="a file holding the text; - for stdin")
        sub.add_argument("--html", action="store_true", help="the text is already Logue's HTML, do not convert")

    read = subs.add_parser("read", help="print a document as Markdown")
    read.add_argument("document", help="document link or doc_ id")
    read.add_argument("--body", action="store_true", help="the body alone, no header")
    read.add_argument("--raw", action="store_true", help="the stored HTML rather than Markdown")
    read.set_defaults(run=cmd_read)

    write = subs.add_parser("write", help="replace a document's whole body")
    write.add_argument("document")
    write.add_argument("--revision", type=int, help="the revision `read` reported")
    write.add_argument("--force", action="store_true", help="write without checking the revision")
    write.add_argument("--title", help="rename it at the same time")
    with_text(write)
    write.set_defaults(run=cmd_write)

    append = subs.add_parser("append", help="add to the end of a document")
    append.add_argument("document")
    with_text(append)
    append.set_defaults(run=cmd_append)

    create = subs.add_parser("create", help="make a new document")
    create.add_argument("--title", help="its title")
    with_text(create)
    create.set_defaults(run=cmd_create)

    listing = subs.add_parser("list", help="documents, newest edit first")
    listing.add_argument("query", nargs="?", help="only titles containing this")
    listing.add_argument("--limit", type=int, default=30)
    listing.set_defaults(run=cmd_list)

    versions = subs.add_parser("versions", help="a document's history")
    versions.add_argument("document")
    versions.set_defaults(run=cmd_versions)

    subs.add_parser("status", help="is the Host answering, and with which model").set_defaults(run=cmd_status)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
