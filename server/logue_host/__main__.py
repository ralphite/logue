"""Entry point: `python3.13 -m logue_host --address 127.0.0.1:8787`."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from .app import App
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
    server = serve(app.router, host or "127.0.0.1", int(port))

    print(f"Logue Host on http://{host or '127.0.0.1'}:{port}  data: {app.store.root}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
