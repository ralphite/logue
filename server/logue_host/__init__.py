"""Logue Host: the local service that owns all of a person's data.

Standard library only, on purpose — installing Logue must never mean managing
a Python environment.
"""

from .app import App

__all__ = ["App"]
