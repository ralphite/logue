import { AudioLines, Sparkles } from "lucide-react";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { getEditableText, insertIntoElement, isEditableElement, isEditableTargetAvailable } from "./dom";
import { isLogueExtensionDisabledDocument } from "./eligibility";
import { clampLauncherPosition, defaultLauncherPosition } from "./launcherPosition";
import type { CaptureIntent, CaptureSource } from "./capturePrimitives";
import styles from "./extension.css?inline";

interface ContentMessage {
  type: "logue:insert-text" | "logue:get-page-context";
  text?: string;
}

function pageSource(): CaptureSource {
  return {
    url: window.location.href,
    title: document.title || window.location.hostname,
    domain: window.location.hostname,
  };
}

function ExtensionLauncher() {
  const [targetRect, setTargetRect] = useState<DOMRect>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const targetRef = useRef<HTMLElement | null>(null);
  const targetPageHrefRef = useRef("");

  const clearTarget = useCallback(() => {
    targetRef.current = null;
    targetPageHrefRef.current = "";
    setTargetRect(undefined);
    setKeyboardActive(false);
  }, []);

  const refreshTarget = useCallback(() => {
    const target = targetRef.current;
    if (!isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href)) {
      clearTarget();
      return;
    }
    setTargetRect(target.getBoundingClientRect());
  }, [clearTarget]);

  const openSidePanel = useCallback((intent: CaptureIntent, autoStartRecording = false) => {
    const target = targetRef.current;
    const selectionText = window.getSelection()?.toString().trim() || undefined;
    void chrome.runtime.sendMessage({
      type: "logue:open-side-panel",
      intent,
      source: pageSource(),
      selectionText,
      targetText: target ? getEditableText(target) : undefined,
      autoStartRecording,
    });
  }, []);

  useEffect(() => {
    const host = document.getElementById("logue-extension-host");
    const onFocusIn = (event: FocusEvent) => {
      if (host && event.composedPath().includes(host)) {
        setKeyboardActive(true);
        return;
      }
      if (!isEditableElement(event.target)) {
        clearTarget();
        return;
      }
      targetRef.current = event.target;
      targetPageHrefRef.current = window.location.href;
      setKeyboardActive(false);
      refreshTarget();
    };
    const onViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      refreshTarget();
    };
    const onRoute = () => clearTarget();
    let href = window.location.href;
    const routeTimer = window.setInterval(() => {
      if (href === window.location.href) return;
      href = window.location.href;
      onRoute();
    }, 250);
    const observer = new MutationObserver(() => {
      if (targetRef.current && !targetRef.current.isConnected) clearTarget();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    return () => {
      observer.disconnect();
      window.clearInterval(routeTimer);
      document.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("scroll", onViewport, true);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("hashchange", onRoute);
      window.removeEventListener("popstate", onRoute);
    };
  }, [clearTarget, refreshTarget]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ||
        event.isComposing || document.activeElement !== targetRef.current
      ) return;
      const button = document.getElementById("logue-extension-host")?.shadowRoot
        ?.querySelector<HTMLButtonElement>('button[aria-label="Open Logue voice capture"]');
      if (!button) return;
      event.preventDefault();
      setKeyboardActive(true);
      button.focus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    const listener = (message: ContentMessage, _sender: chrome.runtime.MessageSender, sendResponse: (value: unknown) => void) => {
      if (message?.type === "logue:insert-text") {
        const target = targetRef.current;
        const inserted = Boolean(
          message.text &&
          isEditableTargetAvailable(target, targetPageHrefRef.current, window.location.href) &&
          insertIntoElement(target, message.text),
        );
        sendResponse({ ok: inserted });
        return false;
      }
      if (message?.type === "logue:get-page-context") {
        sendResponse({
          ok: true,
          value: {
            source: pageSource(),
            selectionText: window.getSelection()?.toString().trim() || undefined,
            targetText: targetRef.current ? getEditableText(targetRef.current) : undefined,
          },
        });
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const defaultPosition = targetRect ? defaultLauncherPosition(targetRect, viewport) : undefined;
  const position = defaultPosition ? clampLauncherPosition(defaultPosition, viewport) : undefined;
  const visible = Boolean(
    targetRect && position &&
    (document.activeElement === targetRef.current || keyboardActive) &&
    targetRect.width > 80 && targetRect.height > 18,
  );

  if (!visible) return null;
  return (
    <div className="logue-launcher-group" style={{ top: position?.top, left: position?.left }} role="group" aria-label="Logue">
      <button
        type="button"
        className="logue-launcher logue-launcher-voice"
        aria-label="Open Logue voice capture"
        title="Start voice capture"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => openSidePanel("input", true)}
      >
        <AudioLines size={17} strokeWidth={2.1} />
      </button>
      <button
        type="button"
        className="logue-launcher"
        aria-label="Open Logue generation"
        title="Generate with Logue"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => openSidePanel("generate")}
      >
        <Sparkles size={17} strokeWidth={1.9} />
      </button>
    </div>
  );
}

if (!isLogueExtensionDisabledDocument(document, window.location.href) && !document.getElementById("logue-extension-host")) {
  const host = document.createElement("div");
  host.id = "logue-extension-host";
  host.dataset.logueExtension = "disabled";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  document.documentElement.append(host);
  createRoot(mount).render(<StrictMode><ExtensionLauncher /></StrictMode>);
}
