const optOutValues = new Set(["disabled", "off", "true"]);
const logueWebAppDescription = "Logue 本机资料与跨网页输入工作台";

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

/**
 * The stable document marker identifies Logue without claiming a common local
 * development origin that may also host unrelated apps.
 */
export function isLogueExtensionDisabledDocument(document: Document, _href: string) {
  if (hasLogueExtensionOptOut(document.documentElement) || hasLogueExtensionOptOut(document.body)) {
    return true;
  }

  const directive = document.querySelector<HTMLMetaElement>('meta[name="logue-extension"]');
  if (optsOut(directive?.content ?? null)) return true;

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
  return description === logueWebAppDescription && Boolean(document.getElementById("root"));
}
