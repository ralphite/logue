"""HTTP transport: a router, a request/response pair, and nothing else.

Handlers never see `BaseHTTPRequestHandler`. They receive a `Request` and
return JSON-able data or a `Response`, which keeps them unit-testable without
a socket.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urlparse

from .errors import BadRequest, HostError

MAX_BODY = 64 * 1024 * 1024

MEDIA_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}

LOCAL_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
CLIENT_HEADER = "X-Logue-Client"


def is_local_origin(origin: str) -> bool:
    """Whether a browser page is allowed to read this Host's answers.

    The workspace is everything the person has ever captured, and the Host has
    no password — so the only thing standing between it and a page they happen
    to be reading is this function. It used to answer "everyone".

    Extensions pass as a class. An extension with a host permission reaches
    local servers whether or not CORS says so, so refusing them here would buy
    nothing and break our own surfaces.
    """
    if origin.startswith("chrome-extension://") or origin.startswith("moz-extension://"):
        return True
    parsed = urlparse(origin)
    return parsed.scheme in {"http", "https"} and parsed.hostname in LOCAL_HOSTS


def is_local_host_header(value: str) -> bool:
    """Guards against a hostname that resolves to this machine.

    A page can point a name it controls at 127.0.0.1 and then talk to the Host
    same-origin, which skips CORS entirely. Requests must arrive addressed to a
    loopback name, not to `logue.attacker.example`.
    """
    return (urlparse(f"//{value}").hostname or "").lower() in LOCAL_HOSTS


@dataclass
class Request:
    method: str
    path: str
    query: dict[str, str]
    params: dict[str, str]
    headers: dict[str, str]
    body: bytes

    def json(self) -> dict[str, Any]:
        if not self.body:
            return {}
        try:
            payload = json.loads(self.body)
        except json.JSONDecodeError:
            raise BadRequest("Request body is not valid JSON") from None
        if not isinstance(payload, dict):
            raise BadRequest("Request body must be a JSON object")
        return payload

    def require(self, key: str) -> str:
        value = str(self.json().get(key, "")).strip()
        if not value:
            raise BadRequest(f"{key} is required")
        return value


@dataclass
class Response:
    body: Any = None
    status: int = 200
    media_type: str = "application/json"
    raw: bytes | None = None
    headers: dict[str, str] = field(default_factory=dict)


Handler = Callable[[Request], Any]


class Router:
    """Path templates with `{name}` segments, matched in registration order."""

    def __init__(self) -> None:
        self._routes: list[tuple[str, re.Pattern[str], Handler]] = []

    def add(self, method: str, template: str, handler: Handler) -> None:
        pattern = re.escape(template)
        pattern = re.sub(r"\\\{(\w+)\\\}", r"(?P<\1>[^/]+)", pattern)
        self._routes.append((method, re.compile(f"^{pattern}$"), handler))

    def route(self, method: str, template: str) -> Callable[[Handler], Handler]:
        def register(handler: Handler) -> Handler:
            self.add(method, template, handler)
            return handler

        return register

    def match(self, method: str, path: str) -> tuple[Handler, dict[str, str]] | None:
        for route_method, pattern, handler in self._routes:
            if route_method != method:
                continue
            found = pattern.match(path)
            if found:
                # Decoded here, once. A path segment can carry a space or a
                # non-ASCII character — a misheard word, for instance — and a
                # handler comparing it raw would simply never match.
                return handler, {key: unquote(value) for key, value in found.groupdict().items()}
        return None

    def allows(self, path: str) -> bool:
        return any(pattern.match(path) for _, pattern, _ in self._routes)


def web_file(root: Path, path: str) -> tuple[bytes, str] | None:
    """The built web app, resolved from a URL path.

    Anything that is not a real file is answered with `index.html`, because the
    app routes on real paths (`/documents/doc_1a2b`) and a deep link has to
    survive a reload.

    The containment check is not decoration: `..` in a URL path is how a local
    server gets talked into reading someone's SSH key.
    """
    wanted = (root / path.lstrip("/")).resolve() if path.strip("/") else root / "index.html"
    base = root.resolve()
    inside = wanted == base or base in wanted.parents
    if not inside or not wanted.is_file():
        wanted = base / "index.html"
        if not wanted.is_file():
            return None
    return wanted.read_bytes(), MEDIA_TYPES.get(wanted.suffix, "application/octet-stream")


def serve(router: Router, host: str, port: int, web: Path | None = None) -> ThreadingHTTPServer:
    """`web` is the built web app, served at `/` so the product needs no terminal."""

    class RequestHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "Logue"

        def log_message(self, *_: Any) -> None:
            """Silence per-request logging; the Host is a background service."""

        def _send(self, response: Response) -> None:
            payload = response.raw if response.raw is not None else b""
            if response.raw is None and response.body is not None:
                payload = json.dumps(response.body, ensure_ascii=False).encode("utf-8")
            self.send_response(response.status)
            self.send_header("Content-Type", response.media_type)
            self.send_header("Content-Length", str(len(payload)))
            # Nothing here may be reused. Without this the browser applies its
            # own heuristic to responses that carry no freshness information,
            # and a tab opened after an edit shows the list from before it.
            self.send_header("Cache-Control", "no-store")
            # The Web App and the Extension are separate origins from the Host,
            # so they need naming — but only they do. Reflecting the origin
            # rather than answering "*" is what keeps an unrelated page from
            # reading the workspace.
            origin = self.headers.get("Origin", "")
            if origin and is_local_origin(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", f"Content-Type, {CLIENT_HEADER}")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
                self.send_header("Access-Control-Max-Age", "600")
            for key, value in response.headers.items():
                self.send_header(key, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)

        def _refuse(self, why: str) -> None:
            self._send(Response({"error": why}, 403))

        def _guard(self) -> str | None:
            """What is wrong with this request, before a handler ever sees it."""
            if not is_local_host_header(self.headers.get("Host", "")):
                return "This Host only answers requests addressed to localhost."
            origin = self.headers.get("Origin", "")
            if origin and not is_local_origin(origin):
                return "This Host only answers Logue."
            # A *web page* can POST without a preflight, so blocking the read is
            # not enough — it could still write. Demanding a header the browser
            # must ask permission for turns those writes into preflights, and
            # the preflight is what the origin check refuses.
            #
            # Only web pages, though. An extension cannot have its origin forged
            # by a page, and a caller with no Origin at all is a local tool, not
            # a browser. Asking them for the header bought nothing and locked
            # out every client written before the rule existed.
            page = origin.startswith("http://") or origin.startswith("https://")
            if page and self.command not in SAFE_METHODS and CLIENT_HEADER.lower() not in {
                key.lower() for key in self.headers
            }:
                return "This page is not allowed to change anything in Logue."
            return None

        def _dispatch(self) -> None:
            refusal = self._guard()
            if refusal:
                self._refuse(refusal)
                return
            url = urlparse(self.path)
            match = router.match(self.command, url.path)
            if match is None:
                # Anything that is not the API is the app, when one is
                # installed. `/v1/…` is never handed to it: a typo in an API
                # path answering with a page of HTML is how a client ends up
                # reporting "unexpected token <" instead of "no such route".
                if web and self.command in {"GET", "HEAD"} and not url.path.startswith("/v1/"):
                    page = web_file(web, url.path)
                    if page is not None:
                        body, media = page
                        self._send(Response(raw=body, media_type=media))
                        return
                status = 405 if router.allows(url.path) else 404
                self._send(Response({"error": "not found" if status == 404 else "method not allowed"}, status))
                return

            handler, params = match
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                self._send(Response({"error": "request too large"}, 413))
                return
            request = Request(
                method=self.command,
                path=url.path,
                query={key: values[0] for key, values in parse_qs(url.query).items()},
                params=params,
                headers={key.lower(): value for key, value in self.headers.items()},
                body=self.rfile.read(length) if length else b"",
            )
            try:
                result = handler(request)
            except HostError as error:
                # Whatever the error carries goes out with it: a failure that
                # kept something needs to say where the something is, or it is
                # indistinguishable from a failure that lost it.
                self._send(Response({"error": error.message, **error.details}, error.status))
                return
            except Exception as error:  # noqa: BLE001 - last line of defence
                self._send(Response({"error": f"{type(error).__name__}: {error}"}, 500))
                return
            self._send(result if isinstance(result, Response) else Response(result))

        do_GET = _dispatch
        do_POST = _dispatch
        do_PATCH = _dispatch
        do_DELETE = _dispatch

        def do_OPTIONS(self) -> None:
            # The preflight itself must be refused for an origin we do not
            # know, or the browser goes on to send the write.
            refusal = self._guard()
            self._send(Response({"error": refusal}, 403) if refusal else Response(status=204))

    return ThreadingHTTPServer((host, port), RequestHandler)
