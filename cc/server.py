#!/usr/bin/env python3
"""
Context Center — a one-file server. No dependencies, no database.

    python3 server.py            # http://127.0.0.1:8788
    python3 server.py 9000       # a different port

What it does:

  * serves this directory, so index.html and shots/*.png just work
  * GET  /api/events   keeps a stream open and pushes tasks.json, runs, and
    config whenever any of them changes on disk — an agent editing the file
    shows up in the browser within half a second, with nothing to reload
  * PUT  /api/tasks    writes tasks.json, atomically
  * POST /api/upload   a pasted or dropped image, into shots/
  * POST /api/ask      hands a message to a Claude Code session, which updates
    tasks.json through the /cc skill
  * GET  /api/sessions lists this project's Claude Code sessions, so Settings
    can offer them instead of asking for a UUID
  * PUT  /api/config   the chosen session, project, and claude binary

tasks.json is the only source of truth. Both writers — the browser and whoever
edits the file — go through the same bytes, and neither can silently overwrite
the other: a PUT carries the revision it was based on, and a stale one is
rejected with the current contents rather than applied.
"""

import http.server
import json
import os
import re
import shlex
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "tasks.json"
CONFIG = HERE / "config.json"
RUNS = HERE / "runs.json"
SHOTS = HERE / "shots"
POLL_SECONDS = 0.5
MAX_UPLOAD = 10 * 1024 * 1024
RUNS_KEPT = 50

# One writer at a time, so two browsers cannot interleave a read and a write.
LOCK = threading.Lock()
# One Claude Code turn at a time. The session is a single conversation; two
# processes appending to it at once would interleave into nonsense.
ASK_LOCK = threading.Lock()

DEFAULT_CONFIG = {
    "project": {"label": "Logue", "cwd": str(HERE.parent)},
    "claude": {
        "bin": "claude",
        "session_id": "",
        "model": "",
        # It only ever needs to run one command. A page-triggered process
        # should not be able to do more than the one thing it is for.
        "allowed_tools": "Bash(python3 ~/.claude/skills/cc/cc.py *)",
        "permission_mode": "dontAsk",
    },
}


# ---------------------------------------------------------------------- files
def read():
    """Returns (revision, parsed). The revision is the file's mtime in ns."""
    raw = DATA.read_bytes()
    return DATA.stat().st_mtime_ns, json.loads(raw.decode("utf-8"))


def write_json(path, obj):
    """Write via a temp file and rename, so a reader never sees half a file."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return path.stat().st_mtime_ns


def load(path, fallback):
    try:
        return json.loads(path.read_text("utf-8"))
    except (OSError, ValueError):
        return json.loads(json.dumps(fallback))  # a fresh copy


def config():
    cfg = load(CONFIG, DEFAULT_CONFIG)
    for section, defaults in DEFAULT_CONFIG.items():
        cfg.setdefault(section, {})
        for k, v in defaults.items():
            cfg[section].setdefault(k, v)
    return cfg


def runs():
    return load(RUNS, {"runs": []})["runs"]


def put_run(run):
    with LOCK:
        current = runs()
        for i, r in enumerate(current):
            if r["id"] == run["id"]:
                current[i] = run
                break
        else:
            current.insert(0, run)
        write_json(RUNS, {"runs": current[:RUNS_KEPT]})


def stamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def state_mtimes():
    """One number that changes when anything the page renders changes."""
    return tuple(p.stat().st_mtime_ns if p.exists() else 0 for p in (DATA, RUNS, CONFIG))


def snapshot():
    rev, data = read()
    return {"rev": str(rev), "data": data, "home": str(HERE),
            "runs": runs(), "config": config()}


# ------------------------------------------------------------------- sessions
def sessions_for(cwd):
    """Claude Code keeps one folder per project, named after the path with the
    separators flattened, and one .jsonl per session named by its id. Read the
    first user message out of each so Settings can show something a person
    recognises instead of a UUID."""
    folder = Path.home() / ".claude" / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(cwd))
    if not folder.is_dir():
        return []

    out = []
    for f in sorted(folder.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:25]:
        preview = ""
        try:
            with f.open("r", encoding="utf-8", errors="replace") as fh:
                for _ in range(40):
                    line = fh.readline()
                    if not line:
                        break
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    text = rec.get("content")
                    if not isinstance(text, str):
                        msg = rec.get("message") or {}
                        content = msg.get("content")
                        if isinstance(content, str):
                            text = content
                        elif isinstance(content, list):
                            text = next((b.get("text") for b in content
                                         if isinstance(b, dict) and b.get("text")), None)
                    if isinstance(text, str) and text.strip():
                        preview = " ".join(text.split())[:90]
                        break
        except OSError:
            pass
        out.append({
            "id": f.stem,
            "at": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M"),
            "size_mb": round(f.stat().st_size / 1e6, 1),
            "preview": preview,
        })
    return out


# ------------------------------------------------------------------------ ask
def task_brief(task_id):
    """The task as it stands, so the session can act on it without a lookup —
    and so an instruction like "update this one" has something to refer to."""
    try:
        _, data = read()
    except (OSError, ValueError):
        return ""
    t = next((x for x in data.get("tasks", []) if x["id"] == task_id), None)
    if not t:
        return ""

    rows = [("title", t.get("title") or "(untitled)"),
            ("type", t.get("type") or "(none)"),
            ("status", t.get("status", "")),
            ("priority", t.get("priority", "")),
            ("confirmed", "yes" if t.get("confirmed") else "no"),
            ("tags", " ".join(t.get("tags") or []) or "(none)"),
            ("note", t.get("note") or "(empty)")]
    if t.get("blocked_on"):
        rows.append(("blocked on", t["blocked_on"]))
    return "\n".join(f"  {k:<10} {v}" for k, v in rows)


def build_prompt(task_id, text, images):
    """A briefing, not a narration.

    The first version said "He is looking at task N1 and said this…" and then
    prescribed the answer — "Record it with cc.py say". Two things wrong with
    that. It relayed the message as if from a third party when it had just been
    typed directly, and it decided in advance that every message is a quote to
    file. "更新一下现在这个item" is an instruction; filing it verbatim stores a
    line nobody will ever want to read and leaves the actual update undone.
    So: state the situation, show the task, and let the session work out what
    is being asked."""
    lines = ["A message came in through Context Center's composer."]

    if task_id:
        brief = task_brief(task_id)
        lines += ["", f"It was sent from task {task_id}" + (", which currently reads:" if brief else ".")]
        if brief:
            lines += ["", brief]

    lines += ["", "Message:", '"""', text.strip(), '"""']

    if images:
        lines += ["", "Screenshots attached to it — read them before deciding:"]
        lines += [f"  {SHOTS / Path(p).name}" for p in images]

    lines += ["", "Work out what it is asking for, then do it with cc.py:"]
    if task_id:
        lines += [
            f"  · a change to {task_id} itself (status, priority, type, title, note,"
            f" tags, order) → cc.py set",
            f"  · information, a report, a decision, a new requirement → cc.py say"
            f" --on {task_id}, which stores the text against the task word for word"
            f" (add --image <path> for each screenshot)",
            "  · about a different task, or a new one → cc.py list first, then cc.py"
            " add, or say --on <that id>",
            "",
            "It is often both: make the change and record what was said.",
        ]
    else:
        lines += [
            "  · a new task → cc.py add",
            "  · something belonging to a task that exists → cc.py say --on <id>",
            "  · a change to one → cc.py set",
            "",
            "Run cc.py list first to see what is already there.",
        ]

    lines += [
        "",
        "Whatever gets recorded goes in exactly as written — no translation, no"
        " tidying, no summarising. A message that is purely an instruction does not"
        " need recording at all; the change it asks for is the point.",
        "Reply with one short line saying what changed.",
    ]
    return "/cc " + "\n".join(lines)


def run_claude(run, prompt):
    cfg = config()
    c, project = cfg["claude"], cfg["project"]
    session = (c.get("session_id") or "").strip()

    if not session:
        return finish(run, "failed", error="No Claude Code session chosen. Open Settings and pick one.")
    cwd = Path(project.get("cwd") or HERE.parent)
    if not cwd.is_dir():
        return finish(run, "failed", error=f"Project folder does not exist: {cwd}")

    cmd = [c.get("bin") or "claude", "--resume", session, "-p", prompt,
           "--output-format", "json"]
    if c.get("allowed_tools"):
        cmd += ["--allowedTools", c["allowed_tools"]]
    if c.get("permission_mode"):
        cmd += ["--permission-mode", c["permission_mode"]]
    if c.get("model"):
        cmd += ["--model", c["model"]]

    run["command"] = " ".join(shlex.quote(x) for x in cmd[:4]) + " …"
    put_run(run)

    # One turn at a time: the session is a single conversation on disk.
    with ASK_LOCK:
        try:
            p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=900)
        except FileNotFoundError:
            return finish(run, "failed", error=f"{cmd[0]!r} is not on PATH for this server.")
        except subprocess.TimeoutExpired:
            return finish(run, "failed", error="Claude Code did not finish within 15 minutes.")

    reply, err = p.stdout.strip(), p.stderr.strip()
    try:
        parsed = json.loads(reply)
        if parsed.get("is_error"):
            return finish(run, "failed", error=parsed.get("result") or "Claude Code reported an error.")
        return finish(run, "done", result=(parsed.get("result") or "").strip())
    except ValueError:
        if p.returncode != 0:
            return finish(run, "failed", error=(err or reply or f"exit {p.returncode}")[:800])
        return finish(run, "done", result=reply[:800])


def finish(run, status, result="", error=""):
    run.update({"status": status, "result": result, "error": error, "ended": stamp()})
    put_run(run)


# -------------------------------------------------------------------- handler
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def log_message(self, *a):
        pass  # the request log is noise here; failures still print

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self, limit=MAX_UPLOAD):
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            return None
        return self.rfile.read(length)

    def local_origin(self):
        """Binding to the loopback keeps the network out; it does not keep out
        another tab in this browser. A write can start a process on this
        machine, so it has to come from this page."""
        origin = self.headers.get("Origin")
        if origin is None:
            return True  # curl, the /cc skill — not a browser, no ambient cookies
        host = self.headers.get("Host", "")
        return origin in (f"http://{host}", f"https://{host}")

    # -- GET
    def do_GET(self):
        if self.path == "/api/events":
            return self.events()
        if self.path == "/api/tasks":
            return self._json(200, snapshot())
        if self.path == "/api/sessions":
            return self._json(200, {"sessions": sessions_for(config()["project"]["cwd"])})
        return super().do_GET()

    def events(self):
        """Server-sent events. The first message is the current state, so the
        page needs no separate load — it just listens."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        sent = None
        try:
            while True:
                now = state_mtimes()
                if now != sent:
                    sent = now
                    self.wfile.write(f"data: {json.dumps(snapshot(), ensure_ascii=False)}\n\n".encode())
                    self.wfile.flush()
                time.sleep(POLL_SECONDS)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the tab went away
        except Exception as e:
            print(f"  stream ended: {e}")

    # -- PUT
    def do_PUT(self):
        if not self.local_origin():
            return self._json(403, {"error": "writes only from this page"})

        if self.path == "/api/config":
            body = self._body()
            try:
                cfg = json.loads(body.decode("utf-8"))
            except Exception as e:
                return self._json(400, {"error": f"body is not JSON: {e}"})
            merged = config()
            for section in ("project", "claude"):
                merged[section].update(cfg.get(section) or {})
            with LOCK:
                write_json(CONFIG, merged)
            return self._json(200, {"config": merged})

        if self.path != "/api/tasks":
            return self.send_error(404)

        try:
            body = json.loads(self._body().decode("utf-8"))
        except Exception as e:
            return self._json(400, {"error": f"body is not JSON: {e}"})
        if not isinstance(body.get("data"), dict):
            return self._json(400, {"error": "expected {rev, data}"})

        with LOCK:
            rev, current = read()
            # Based on something older than what is on disk: hand back what is
            # actually there instead of throwing that edit away.
            if body.get("rev") != str(rev):
                return self._json(409, {"rev": str(rev), "data": current})
            return self._json(200, {"rev": str(write_json(DATA, body["data"]))})

    # -- POST
    def do_POST(self):
        if not self.local_origin():
            return self._json(403, {"error": "writes only from this page"})
        if self.path == "/api/upload":
            return self.upload()
        if self.path == "/api/ask":
            return self.ask()
        return self.send_error(404)

    def upload(self):
        """Raw bytes in, a path under shots/ out. The filename rides a header so
        the body stays a plain image — no multipart parsing for one file."""
        raw = self._body()
        if raw is None:
            return self._json(413, {"error": "larger than the 10 MB limit"})
        if not raw:
            return self._json(400, {"error": "empty upload"})

        name = self.headers.get("X-Filename") or "paste.png"
        ext = Path(name).suffix.lower() or ".png"
        if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            return self._json(400, {"error": f"not an image: {ext}"})

        SHOTS.mkdir(exist_ok=True)
        dest = SHOTS / f"paste-{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:4]}{ext}"
        dest.write_bytes(raw)
        return self._json(200, {"path": f"shots/{dest.name}"})

    def ask(self):
        try:
            body = json.loads(self._body().decode("utf-8"))
        except Exception as e:
            return self._json(400, {"error": f"body is not JSON: {e}"})

        text = (body.get("text") or "").strip()
        images = body.get("images") or []
        if not text and not images:
            return self._json(400, {"error": "nothing to send"})

        run = {"id": uuid.uuid4().hex[:8], "at": stamp(), "task_id": body.get("task_id") or "",
               "text": text, "images": images, "status": "running",
               "result": "", "error": "", "ended": "", "command": ""}
        put_run(run)

        # The connection test is about whether the session answers at all, so it
        # goes in bare — wrapping it in the /cc briefing would ask it to change
        # files in the same breath as telling it not to.
        prompt = text if body.get("kind") == "test" else build_prompt(run["task_id"], text, images)
        threading.Thread(target=run_claude, args=(run, prompt), daemon=True).start()
        return self._json(200, {"run": run})


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    open_browser = "--no-open" not in sys.argv
    port = int(args[0]) if args else 8788

    if not DATA.exists():
        DATA.write_text('{\n  "version": 2,\n  "tasks": [],\n  "inputs": []\n}\n', encoding="utf-8")
        print(f"created {DATA.name}")
    if not CONFIG.exists():
        write_json(CONFIG, DEFAULT_CONFIG)
        print(f"created {CONFIG.name}")

    try:
        server = Server(("127.0.0.1", port), Handler)
    except OSError as e:
        print(f"cannot listen on 127.0.0.1:{port} — {e}")
        print(f"try another port:  python3 {Path(__file__).name} {port + 1}")
        return 1

    url = f"http://127.0.0.1:{port}/"
    print(f"Context Center  →  {url}")
    print(f"editing         →  {DATA}")
    session = config()["claude"]["session_id"]
    print(f"session         →  {session or 'not chosen yet — open Settings'}")
    print("ctrl-c to stop")
    if open_browser:
        threading.Timer(0.3, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
