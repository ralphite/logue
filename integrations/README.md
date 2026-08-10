# Logue for agents that are not ours

The Host has always had an HTTP API and no password for anything running as
this user. What was missing was the other half: something that tells an outside
agent *which* calls to make, and turns Logue's editor markup into the Markdown
an agent actually writes.

That is what lives here. One integration so far.

| | What it is | Install |
|---|---|---|
| [claude-code](claude-code/) | A `/logue` skill. Hand Claude Code a document link and it can read, append to, replace and create documents. | `./integrations/claude-code/install.sh` |

## What an integration may assume

- **The link carries everything.** `http://127.0.0.1:8787/documents/doc_1a2b`
  names the Host and the document. No key, no config file, nothing to set up
  first.
- **A local tool is allowed in.** The Host refuses browser origins it does not
  know, and demands `X-Logue-Client` of web pages. A caller that arrives with no
  `Origin` is a local tool, not a page, and may read and write.
- **Markdown outside, the editor's HTML inside.** Converting is the
  integration's job, in both directions. Documents are edited by a person in a
  browser afterwards; leaving `##` sitting in their text is not acceptable.
- **A replacing write carries `expected_revision`.** A second writer is refused,
  never silently overwritten — the same rule the app itself lives under.
- **Reads happen; destruction does not.** Read, append, replace, create.
  Deleting is the person's, the way it already is for the agent inside the
  product.
