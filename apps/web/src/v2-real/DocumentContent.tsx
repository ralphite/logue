import { useEffect, type RefObject } from "react";
import { sanitizeEditorHTML, toEditorHTML } from "../components/DocumentWorkspace";

export function normalizedDocumentHTML(value: string, title: string) {
  return toEditorHTML(value, title);
}

export function replaceDocumentTextRange(value: string, title: string, start: number, end: number, replacement: string) {
  const template = document.createElement("template");
  template.innerHTML = normalizedDocumentHTML(value, title);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startNode: Text | undefined;
  let endNode: Text | undefined;
  let startOffset = 0;
  let endOffset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const next = offset + node.data.length;
    if (!startNode && start >= offset && start <= next) { startNode = node; startOffset = start - offset; }
    if (!endNode && end >= offset && end <= next) { endNode = node; endOffset = end - offset; }
    offset = next;
  }
  if (!startNode || !endNode) return normalizedDocumentHTML(replacement, "");
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  range.deleteContents();
  range.insertNode(document.createTextNode(replacement));
  return sanitizeEditorHTML(template.innerHTML);
}

export function documentSelectionOffsets(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return undefined;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return undefined;
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length, text: range.toString() };
}

export function DocumentContent({ value, title, readOnly = false, editorRef, onChange, onCitationClick }: {
  value: string;
  title: string;
  readOnly?: boolean;
  editorRef?: RefObject<HTMLDivElement | null>;
  onChange?: (value: string) => void;
  onCitationClick?: (sourceNumber: number) => void;
}) {
  const html = normalizedDocumentHTML(value, title);
  useEffect(() => {
    const editor = editorRef?.current;
    if (!editor || document.activeElement === editor) return;
    if (sanitizeEditorHTML(editor.innerHTML) !== sanitizeEditorHTML(html)) editor.innerHTML = html;
  }, [editorRef, html]);
  if (readOnly) {
    const interactiveHTML = onCitationClick
      ? html.replace(/<mark>\[Source (\d+)\]<\/mark>/g, '<button type="button" class="v2-citation" data-source-number="$1" aria-label="Open Source $1">$1</button>')
      : html;
    return <div className="v2-document-content" onClick={(event) => { const target = event.target as HTMLElement; const sourceNumber = Number(target.closest<HTMLElement>("[data-source-number]")?.dataset.sourceNumber); if (sourceNumber) onCitationClick?.(sourceNumber); }} dangerouslySetInnerHTML={{ __html: interactiveHTML }} />;
  }
  return <div ref={editorRef} className="v2-document-content is-editable" contentEditable suppressContentEditableWarning role="textbox" aria-label="Document content" aria-multiline="true" onInput={(event) => onChange?.(sanitizeEditorHTML(event.currentTarget.innerHTML))} dangerouslySetInnerHTML={{ __html: html }} />;
}
