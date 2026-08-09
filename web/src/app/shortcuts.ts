/**
 * Every key the app answers to, written once.
 *
 * The badge on a button and the row in the help sheet read from here, so a
 * badge can never promise a key that was renamed or removed somewhere else.
 */
export const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "⌘K", what: "Find anything" },
  { keys: "⌘\\", what: "Show or hide the sidebar" },
  { keys: "⌘1 – ⌘5", what: "Go to a section" },
  { keys: "⌥⌘↑ / ⌥⌘↓", what: "Previous or next in the list" },
  { keys: "Right-click", what: "A row's own actions" },
  { keys: "⇧F10", what: "The same actions, from the keyboard" },
  { keys: "?", what: "This list" },
];

export const FIND_KEYS = "⌘K";
export const RAIL_KEYS = "⌘\\";
