const optOutValues = new Set(["disabled", "off", "true"]);

function optsOut(value: string | null) {
  return Boolean(value && optOutValues.has(value.trim().toLowerCase()));
}

/** Allows a page or one editable subtree to explicitly suppress the extension UI. */
export function hasLogueExtensionOptOut(element: Element | null) {
  let current = element;
  while (current) {
    if (optsOut(current.getAttribute("data-logue-extension"))) return true;
    current = current.parentElement;
  }
  return false;
}

/** A host page can explicitly suppress the extension for the whole document. */
export function isLogueExtensionDisabledDocument(document: Document, _href: string) {
  if (hasLogueExtensionOptOut(document.documentElement) || hasLogueExtensionOptOut(document.body)) {
    return true;
  }

  const directive = document.querySelector<HTMLMetaElement>('meta[name="logue-extension"]');
  return optsOut(directive?.content ?? null);
}
