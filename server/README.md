# Logue Host

The local service that owns all of a person's data. Standard library only —
installing Logue must never mean managing a Python environment.

```bash
python3.13 -m logue_host --address 127.0.0.1:8787 --data-dir .logue-data
```

## Layout

| Path | Responsibility |
|---|---|
| `logue_host/http.py` | routing, JSON, CORS, errors → status codes |
| `logue_host/app.py` | the route table: one line of glue per endpoint |
| `logue_host/domain/` | the product rules, with no knowledge of HTTP |
| `logue_host/store.py` | one JSON file per record, atomic writes |
| `logue_host/providers/` | Gemini, with per-capability health |

Why no framework: the install story is "download one zip, run it with system
Python, on macOS or Linux". FastAPI's pydantic-core is a compiled extension,
which turns that into per-platform wheels. The routing this product needs is
150 lines. If OpenAPI or richer validation ever earns its keep, `http.py` is
the only file that changes — the domain layer never imports it.

## Tests

```bash
python3.13 -m unittest discover -s tests -t . -p 'test_*.py'
```

Thin on purpose: they pin the contracts the UI reads and the rules that would
silently corrupt data. The product itself is verified by running the ten CUJs
in a real browser.
