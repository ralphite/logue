#!/usr/bin/env python3
"""
Write into Context Center from a Claude Code session.

Two ways in, tried in this order:

  1. the running server (http://127.0.0.1:8788). Writes go through PUT with the
     revision they were based on, so nothing typed in the open browser tab can
     be clobbered by this script.
  2. the file directly, when no server answers.

Finding tasks.json without a server: $CC_DIR, then the `location` file next to
this script, then `cc/tasks.json` searched upward from the working directory.
"""

import argparse
import json
import os
import shutil
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_PORT = 8788

# One shape for a task, so a diff shows the edit and not a reshuffle.
FIELD_ORDER = ["id", "title", "type", "status", "priority", "confirmed",
               "tags", "note", "blocked_on", "input_ids", "created", "updated"]
STATUSES = ["queued", "doing", "blocked", "done"]
PRIORITIES = ["P0", "P1", "P2", "P3"]
# Only a default; type is an open vocabulary and any word is allowed.
TYPE_PREFIX = {"bug": "X", "feature": "F", "question": "Q", "test": "T"}


# --------------------------------------------------------------------- store
class Store:
    """Reads and writes the one JSON file, through the server when it is up."""

    def __init__(self, port=DEFAULT_PORT, path=None):
        self.url = f"http://127.0.0.1:{port}/api/tasks"
        self.rev = None
        self.path = None
        self.home = None
        self.via = None
        self._load(path)

    def _load(self, path):
        if path is None:
            try:
                with urllib.request.urlopen(self.url, timeout=2) as r:
                    payload = json.load(r)
                self.rev = payload["rev"]
                self.data = payload["data"]
                self.home = Path(payload["home"])
                self.via = "server"
                return
            except (urllib.error.URLError, OSError, KeyError, ValueError):
                pass  # not running, or too old to report home — fall through

        self.path = Path(path) if path else find_file()
        self.data = json.loads(self.path.read_text("utf-8"))
        self.home = self.path.parent
        self.via = "file"

    def save(self):
        for t in self.data.get("tasks", []):
            ordered = {k: t[k] for k in FIELD_ORDER if k in t}
            ordered.update({k: v for k, v in t.items() if k not in ordered})
            t.clear()
            t.update(ordered)

        if self.via == "server":
            body = json.dumps({"rev": self.rev, "data": self.data}).encode()
            req = urllib.request.Request(self.url, data=body, method="PUT",
                                         headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=5) as r:
                    self.rev = json.load(r)["rev"]
                return
            except urllib.error.HTTPError as e:
                if e.code == 409:
                    die("someone else wrote tasks.json while this ran. "
                        "Nothing was changed — read it again and redo the edit.")
                raise

        text = json.dumps(self.data, ensure_ascii=False, indent=2) + "\n"
        tmp = self.path.with_name(self.path.name + ".tmp")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, self.path)

    # -- lookups
    def task(self, task_id):
        for t in self.data["tasks"]:
            if t["id"].lower() == task_id.lower():
                return t
        die(f"no task {task_id!r}. Run `list` to see the ids.")

    def next_id(self, kind):
        prefix = TYPE_PREFIX.get(kind, "N")
        taken = {t["id"].lower() for t in self.data["tasks"]}
        n = 1
        while f"{prefix}{n}".lower() in taken:
            n += 1
        return f"{prefix}{n}"

    def next_input_id(self, text):
        # A readable stem beats a counter when the id shows up in input_ids.
        # ASCII words only: Chinese has no spaces, so `isalnum` splitting turned
        # a whole sentence into one "word" and the id became the message.
        words = [w for w in "".join(c if c.isascii() and c.isalnum() else " "
                                    for c in text.lower()).split() if len(w) > 1][:3]
        stem = "_".join(words)[:28] or datetime.now().strftime("%Y%m%d")
        taken = {i["id"] for i in self.data["inputs"]}
        cand, n = f"in_{stem}", 2
        while cand in taken:
            cand, n = f"in_{stem}_{n}", n + 1
        return cand


def find_file():
    if os.environ.get("CC_DIR"):
        p = Path(os.environ["CC_DIR"]).expanduser() / "tasks.json"
        if p.exists():
            return p
    loc = HERE / "location"
    if loc.exists():
        p = Path(loc.read_text().strip()).expanduser() / "tasks.json"
        if p.exists():
            return p
    for d in [Path.cwd(), *Path.cwd().parents]:
        p = d / "cc" / "tasks.json"
        if p.exists():
            return p
    die("cannot find tasks.json. Start the server, or set CC_DIR to the cc folder.")


def die(msg):
    print(f"cc: {msg}", file=sys.stderr)
    raise SystemExit(1)


def today():
    return datetime.now().strftime("%Y-%m-%d")


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


# --------------------------------------------------------------------- parts
def add_images(store, paths):
    """Copy screenshots into shots/ and return the relative paths to record."""
    out = []
    shots = store.home / "shots"
    for raw in paths or []:
        src = Path(raw).expanduser()
        if not src.exists():
            die(f"no such image: {src}")
        shots.mkdir(exist_ok=True)
        dest, n = shots / src.name, 2
        while dest.exists() and dest.stat().st_size != src.stat().st_size:
            dest = shots / f"{src.stem}-{n}{src.suffix}"
            n += 1
        if not dest.exists():
            shutil.copy2(src, dest)
        out.append(f"shots/{dest.name}")
    return out


def make_input(store, text, images, at):
    inp = {"id": store.next_input_id(text), "at": at or now(),
           "text": text, "images": add_images(store, images)}
    store.data["inputs"].append(inp)
    return inp


def place(store, task, where):
    """Default is the end: a new ask does not jump the one in hand."""
    tasks = store.data["tasks"]
    if task in tasks:
        tasks.remove(task)
    if where in (None, "end"):
        tasks.append(task)
    elif where == "top":
        tasks.insert(0, task)
    elif where.startswith("after:"):
        anchor = store.task(where[6:])
        tasks.insert(tasks.index(anchor) + 1, task)
    else:
        die(f"position must be end, top, or after:<id> — got {where!r}")


def line(t, inputs_by_id):
    n = len(t.get("input_ids", []))
    bits = [t["id"].ljust(5), (t.get("type") or "-").ljust(8),
            t.get("priority", "").ljust(3), t.get("status", "").ljust(7),
            "ok " if t.get("confirmed") else "?  ", f"{n}in".ljust(4),
            t.get("title") or "(untitled)"]
    return "  ".join(bits)


# ------------------------------------------------------------------ commands
def cmd_list(store, a):
    tasks = store.data["tasks"]
    if not a.all:
        tasks = [t for t in tasks if t.get("status") != "done"]
    print(f"# {len(tasks)} shown, {len(store.data['tasks'])} total   (via {store.via})")
    print("# id     type      pri  status   ok  inputs  title")
    for t in tasks:
        print(line(t, None))


def cmd_show(store, a):
    t = store.task(a.id)
    print(json.dumps(t, ensure_ascii=False, indent=2))
    print("\n# messages filed against it")
    for iid in t.get("input_ids", []):
        inp = next((i for i in store.data["inputs"] if i["id"] == iid), None)
        if not inp:
            print(f"  {iid}  (missing)")
            continue
        also = [x["id"] for x in store.data["tasks"]
                if iid in x.get("input_ids", []) and x["id"] != t["id"]]
        print(f"  {inp['id']}  {inp['at']}" + (f"  also on {', '.join(also)}" if also else ""))
        print(f"    {inp['text']}")
        for img in inp.get("images", []):
            print(f"    [{img}]")


def cmd_add(store, a):
    task = {
        "id": a.id or store.next_id(a.type),
        "title": a.title,
        "type": (a.type or "").lower(),
        "status": a.status,
        "priority": a.priority,
        # He said it, so it is confirmed. Pass --unconfirmed when the task is
        # your own reading rather than the request itself.
        "confirmed": not a.unconfirmed,
        "tags": a.tag or [],
        "note": a.note or "",
        "blocked_on": a.blocked_on or "",
        "input_ids": [],
        "created": today(),
        "updated": today(),
    }
    if store.data["tasks"] and any(t["id"].lower() == task["id"].lower() for t in store.data["tasks"]):
        die(f"id {task['id']} is taken")

    if a.said:
        task["input_ids"].append(make_input(store, a.said, a.image, a.at)["id"])
    elif a.image:
        die("--image needs --said: an image belongs to a message")

    place(store, task, a.position)
    store.save()
    print(f"added {task['id']}  {task['title']}")
    if a.said:
        print(f"  input {task['input_ids'][0]}"
              + (f"  +{len(a.image)} image(s)" if a.image else ""))


def cmd_say(store, a):
    targets = [store.task(i) for i in a.on]
    inp = make_input(store, a.text, a.image, a.at)
    for t in targets:
        t.setdefault("input_ids", []).append(inp["id"])
        t["updated"] = today()
    store.save()
    print(f"recorded {inp['id']} on {', '.join(t['id'] for t in targets)}")
    for img in inp["images"]:
        print(f"  {img}")


def cmd_set(store, a):
    t = store.task(a.id)
    changed = []
    for key, val in [("title", a.title), ("note", a.note), ("blocked_on", a.blocked_on)]:
        if val is not None:
            t[key] = val
            changed.append(key)
    if a.type is not None:
        t["type"] = a.type.lower()
        changed.append("type")
    if a.status:
        t["status"] = a.status
        changed.append("status")
    if a.priority:
        t["priority"] = a.priority
        changed.append("priority")
    if a.confirmed is not None:
        t["confirmed"] = a.confirmed == "true"
        changed.append("confirmed")
    for tag in a.add_tag or []:
        if tag not in t.setdefault("tags", []):
            t["tags"].append(tag)
            changed.append(f"+#{tag}")
    for tag in a.rm_tag or []:
        if tag in t.get("tags", []):
            t["tags"].remove(tag)
            changed.append(f"-#{tag}")
    if a.position:
        place(store, t, a.position)
        changed.append(f"position={a.position}")

    if not changed:
        die("nothing to change")
    t["updated"] = today()
    store.save()
    print(f"{t['id']}  {', '.join(changed)}")


def cmd_rm(store, a):
    t = store.task(a.id)
    store.data["tasks"].remove(t)
    # inputs[] is left alone: an input may belong to other tasks, and even when
    # it belongs to none it is still something that was said.
    store.save()
    print(f"removed {t['id']}  {t.get('title', '')}")


# ---------------------------------------------------------------------- main
def main():
    p = argparse.ArgumentParser(prog="cc.py", description="Update Context Center's tasks.json")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--file", help="path to tasks.json (skips the server)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("list", help="the queue, one line each")
    s.add_argument("--all", action="store_true", help="include done")
    s.set_defaults(fn=cmd_list)

    s = sub.add_parser("show", help="one task in full, with the messages filed against it")
    s.add_argument("id")
    s.set_defaults(fn=cmd_show)

    s = sub.add_parser("add", help="a new task, optionally with the message behind it")
    s.add_argument("title")
    s.add_argument("--type", default="", help="bug | feature | question | test | any word")
    s.add_argument("--status", default="queued", choices=STATUSES)
    s.add_argument("--priority", default="P2", choices=PRIORITIES)
    s.add_argument("--note", help="why this matters, one or two sentences")
    s.add_argument("--blocked-on", help="what it waits on (with --status blocked)")
    s.add_argument("--tag", action="append")
    s.add_argument("--said", help="the message, verbatim, not your summary")
    s.add_argument("--image", action="append", help="screenshot to copy into shots/")
    s.add_argument("--at", help='when it was said, "YYYY-MM-DD HH:MM"')
    s.add_argument("--position", help="end (default) | top | after:<id>")
    s.add_argument("--unconfirmed", action="store_true")
    s.add_argument("--id", help="override the generated id")
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("say", help="file a message against existing tasks")
    s.add_argument("text")
    s.add_argument("--on", action="append", required=True, help="task id, repeatable")
    s.add_argument("--image", action="append")
    s.add_argument("--at")
    s.set_defaults(fn=cmd_say)

    s = sub.add_parser("set", help="change fields on a task")
    s.add_argument("id")
    s.add_argument("--title")
    s.add_argument("--type")
    s.add_argument("--status", choices=STATUSES)
    s.add_argument("--priority", choices=PRIORITIES)
    s.add_argument("--confirmed", choices=["true", "false"])
    s.add_argument("--note")
    s.add_argument("--blocked-on")
    s.add_argument("--add-tag", action="append")
    s.add_argument("--rm-tag", action="append")
    s.add_argument("--position")
    s.set_defaults(fn=cmd_set)

    s = sub.add_parser("rm", help="delete a task (inputs are kept)")
    s.add_argument("id")
    s.set_defaults(fn=cmd_rm)

    a = p.parse_args()
    store = Store(port=a.port, path=a.file)
    a.fn(store, a)


if __name__ == "__main__":
    main()
