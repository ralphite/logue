# Material search

## Existing pattern

Stream already has one compact search field beside its filters. Material pickers use the
same quiet, inline field. The product has no visible search-agent choice.

## Proposed interaction

After a short debounce, a natural-language query is ranked by the local Gemini service
against a bounded set of current Materials. The list filters to matching rows and orders
them by relevance. Explicit text matches always remain, ahead of any semantic additions.
A result that is related rather than a literal content match shows one short reason below
its title. There is no mode switch, assistant surface, progress card, or success message.

## Data and failure handling

Only the query and bounded Material metadata/content are sent to the existing local Gemini
service. Candidate text is untrusted and can never provide instructions. Gemini may return
only supplied IDs. If Gemini is unavailable or returns invalid data, the server silently
uses deterministic direct matching and labels non-content matches precisely (for example,
"Matches project"). A valid semantic no-result stays empty; it never mixes in apparently
random Materials. While a current query is pending, the UI does not claim that no results
exist.

## Open scope

This batch supplies the shared Material search API and Stream integration. Document-title
search is a separate object search and should use the same API contract in its own batch.
