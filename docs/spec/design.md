# Design system

Notion's rules, not Notion's skin: quiet surfaces, content first, chrome that disappears until you reach for it.

## Density

| Token | Value | Used for |
|---|---|---|
| control height | 28px | buttons, selects, inputs, menu rows |
| bar height | 32px | floating toolbars |
| panel row | 36px | panel headers/footers |
| body | 13px / 1.5 | reading text, editors |
| ui | 12px | buttons, labels, meta |
| gaps | 2 · 4 · 6 · 8px | inside a control · between controls · inside a group · between groups |
| radius | 5 · 6 · 10px | menu row · control · panel |
| axes | 820 / 940 / 1180px | reading · list · settings |

Nothing gets 44px, 13px radius, or 20px padding. If a value isn't on this list, it's wrong.

## Color

Neutral ink on white; one accent (`#535fdb`) reserved for the single primary action per surface. Warnings amber, destructive red — never decorative.

```
ink #20211f   ink-soft #4e504b   muted #70726c   faint #73756f
line #e7e7e3  line-strong #d9dad5
surface #fff  surface-muted #f6f6f4
accent #535fdb  accent-soft #f0f1fd
```

Floating surfaces use a three-layer hairline shadow, never a border:
`0 0 0 1px rgb(15 15 15/6%), 0 3px 6px rgb(15 15 15/8%), 0 9px 24px rgb(15 15 15/12%)`

Every shadow-DOM root declares `color-scheme: light`, or native dropdowns render dark on dark pages.

## Rules

1. **One primary action per surface.** Everything else is quiet.
2. **Progressive disclosure.** Secondary controls live behind `▾` or `⋯`, closed by default. A surface at rest shows only what you need to act.
3. **Icons carry low-frequency actions**, with a `title`. Words are for the primary action and for content.
4. **No explanatory sentences in chrome.** "Applies once. Recording freezes these choices." → delete. If a control needs a paragraph, the control is wrong.
5. **No metadata stacking.** "Auto-detect · No known phrases · No avoided terms · Default formatting" → the label alone, detail into `title`.
6. **State replaces chrome.** A settled panel is one row, not a header + body + footer.
7. **One control vocabulary.** Same job → same widget. Never a `datalist` beside a `select`.
8. **Labels sit left, controls right**, in a two-column grid, so a group of settings reads as a table.
9. **Empty states are one line + one action.**
10. **Keyboard first**: ⌘↵ commits, Esc dismisses, Enter runs. Shortcuts shown as `<kbd>` on the primary action only.

## Provenance

Web / You / AI stay visually distinct wherever they appear together. Citations are `[Source n]`; the chip shows pressed state when its panel is open. Untitled documents are `Untitled`.
