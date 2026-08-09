"""Entry point: `python3.13 -m logue_host --address 127.0.0.1:8787`."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from .app import App
from .build import installed_web
from .domain import organize, summaries
from .http import serve


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="logue_host", description="Run the Logue Host.")
    parser.add_argument("--address", default="127.0.0.1:8787", help="host:port to listen on")
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("LOGUE_DATA_DIR", ".logue-data"),
        help="workspace directory (default: $LOGUE_DATA_DIR or .logue-data)",
    )
    args = parser.parse_args(argv)

    host, _, port = args.address.rpartition(":")
    app = App(Path(args.data_dir).expanduser().resolve())
    # The Host serves the app itself once one is installed. A product that
    # needs a terminal window left open is a product you cannot check on.
    web = installed_web()
    server = serve(app.router, host or "127.0.0.1", int(port), web)

    # Anything a previous run was part-way through. Without this a Host
    # restarted mid-classification leaves Sources waiting for good.
    resumed = organize.catch_up(app.store, app.provider())
    if resumed:
        print(f"Resuming {resumed} Sources that were still being filed.", flush=True)

    # Same reason: a version stuck on "working out what changed" is worse than
    # the counted line it would have fallen back to.
    described = summaries.catch_up(app.store, app.provider())
    if described:
        print(f"Describing {described} document versions that were left unwritten.", flush=True)

    where = "app + API" if web else "API only — run `npm run dev:web` for the app"
    print(f"Logue Host on http://{host or '127.0.0.1'}:{port} ({where})  data: {app.store.root}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
