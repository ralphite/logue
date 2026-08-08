"""Which build of the extension is installed on this machine.

Read from the installed extension's own manifest rather than baked into the
Host at start-up. A deploy replaces the folder, and the Host reports the new
build the moment it does — with no second copy of the number to go stale, and
nothing to pass through a launch agent.

A browser running an older build asks for this and reloads itself, which is how
"one version on this machine" stays true without anyone visiting
chrome://extensions.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

DEFAULT_INSTALL_ROOT = "~/.local/share/logue"


def installed_extension_build() -> str:
    """The installed build, or "" when nothing is installed here.

    Empty is the honest answer for a Host run straight from a checkout: there is
    no deployed folder to be behind, so no browser should reload for it.
    """
    root = os.environ.get("LOGUE_INSTALL_ROOT") or DEFAULT_INSTALL_ROOT
    manifest = Path(root).expanduser() / "extension" / "manifest.json"
    try:
        loaded = json.loads(manifest.read_text("utf-8"))
    except (OSError, ValueError):
        return ""
    name = loaded.get("version_name")
    return name if isinstance(name, str) else ""
