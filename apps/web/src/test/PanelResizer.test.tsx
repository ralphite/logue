import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PanelResizer, usePersistentPanelSize } from "../components/PanelResizer";

function PersistentHarness() {
  const { size, setSize } = usePersistentPanelSize({
    storageKey: "panel-test",
    defaultSize: 252,
    min: 200,
    max: 320,
  });
  return <><output>{size}</output><button type="button" onClick={() => setSize(280)}>Resize</button></>;
}

function ResizerHarness({ edge = "right" }: { edge?: "left" | "right" }) {
  const { size, setSize } = usePersistentPanelSize({
    storageKey: `resizer-${edge}`,
    defaultSize: 300,
    min: 240,
    max: 420,
  });
  return (
    <PanelResizer
      label="Resize test panel"
      value={size}
      min={240}
      max={420}
      defaultValue={300}
      edge={edge}
      onChange={setSize}
    />
  );
}

function DynamicLimitHarness({ max }: { max: number }) {
  const { size } = usePersistentPanelSize({
    storageKey: "dynamic-panel",
    defaultSize: 300,
    min: 240,
    max,
  });
  return <output>{size}</output>;
}

describe("PanelResizer", () => {
  beforeEach(() => window.localStorage.clear());

  it("clamps stored sizes and persists later changes", async () => {
    window.localStorage.setItem("panel-test", "999");
    render(<PersistentHarness />);

    expect(screen.getByText("320")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resize" }));

    await waitFor(() => expect(window.localStorage.getItem("panel-test")).toBe("280"));
  });

  it("re-clamps a persisted size when the container-derived maximum shrinks", () => {
    window.localStorage.setItem("dynamic-panel", "400");
    const { rerender } = render(<DynamicLimitHarness max={420} />);
    expect(screen.getByText("400")).toBeTruthy();

    rerender(<DynamicLimitHarness max={280} />);
    expect(screen.getByText("280")).toBeTruthy();
  });

  it("supports precise keyboard resizing, limits, and reset", () => {
    render(<ResizerHarness />);
    const separator = screen.getByRole("separator", { name: "Resize test panel" });

    expect(separator.getAttribute("aria-valuenow")).toBe("300");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator.getAttribute("aria-valuenow")).toBe("308");
    fireEvent.keyDown(separator, { key: "ArrowLeft", shiftKey: true });
    expect(separator.getAttribute("aria-valuenow")).toBe("276");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator.getAttribute("aria-valuenow")).toBe("240");
    fireEvent.keyDown(separator, { key: "End" });
    expect(separator.getAttribute("aria-valuenow")).toBe("420");
    fireEvent.doubleClick(separator);
    expect(separator.getAttribute("aria-valuenow")).toBe("300");
  });

  it("reverses horizontal movement for a panel on the right side", () => {
    render(<ResizerHarness edge="left" />);
    const separator = screen.getByRole("separator", { name: "Resize test panel" });

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator.getAttribute("aria-valuenow")).toBe("292");
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator.getAttribute("aria-valuenow")).toBe("300");
  });

  it("captures pointer drags and restores page selection styles", () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    Object.assign(HTMLElement.prototype, { setPointerCapture, releasePointerCapture, hasPointerCapture });
    render(<ResizerHarness />);
    const separator = screen.getByRole("separator", { name: "Resize test panel" });

    fireEvent.pointerDown(separator, { button: 0, pointerId: 4, clientX: 100 });
    fireEvent.pointerMove(separator, { pointerId: 4, clientX: 140 });
    expect(separator.getAttribute("aria-valuenow")).toBe("340");
    expect(document.body.style.userSelect).toBe("none");
    fireEvent.pointerUp(separator, { pointerId: 4, clientX: 140 });

    expect(setPointerCapture).toHaveBeenCalledWith(4);
    expect(releasePointerCapture).toHaveBeenCalledWith(4);
    expect(document.body.style.userSelect).toBe("");
  });
});
