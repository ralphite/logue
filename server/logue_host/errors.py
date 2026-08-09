"""The error vocabulary shared by every handler.

Handlers raise these; the transport turns them into status codes. Nothing else
in the package decides an HTTP status.
"""

from __future__ import annotations


class HostError(Exception):
    """An error with an HTTP status the client can act on."""

    status = 500

    def __init__(self, message: str, **details: object) -> None:
        super().__init__(message)
        self.message = message
        #: Anything the client needs in order to offer a way forward. A failed
        #: transcription carries the id of the recording it kept, without which
        #: the audio is saved and unreachable — which is the same as lost.
        self.details = details


class BadRequest(HostError):
    status = 400


class NotFound(HostError):
    status = 404


class Conflict(HostError):
    """The request was valid but the current state refuses it."""

    status = 409


class Unavailable(HostError):
    """A capability the request needs is not configured or not healthy."""

    status = 503
