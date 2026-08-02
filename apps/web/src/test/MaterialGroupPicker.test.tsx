import { fireEvent, render, screen } from "@testing-library/react";
import type { Material } from "@logue/ui";
import { describe, expect, it, vi } from "vitest";
import { MaterialGroupAddList, MaterialGroupPicker } from "../components/MaterialGroupPicker";

function material(id: string, kind: Material["kind"], content: string, domain: string): Material {
  return {
    id,
    kind,
    status: "unfiled",
    content,
    projects: [],
    tags: [],
    createdAt: "2026-08-02T12:00:00Z",
    source: { domain, url: `https://${domain}/` },
  };
}

const duplicates = [
  material("capture-a", "voice", "Same material", "alpha.example"),
  material("capture-b", "voice", "Same material", "beta.example"),
  material("separate", "text", "Same material", "text.example"),
];

describe("MaterialGroupPicker", () => {
  it("collapses exact same-kind content and keeps every capture selectable after expansion", () => {
    const onChange = vi.fn();
    render(<MaterialGroupPicker materials={duplicates} selectedIds={[]} onChange={onChange} getLabel={(item) => item.content} getMeta={(item) => item.source?.domain ?? ""} />);

    expect(screen.getByText("2 captures")).toBeTruthy();
    expect(screen.queryByText(/Capture 1/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand 2 captures" }));
    expect(screen.getByText("Capture 1 / alpha.example")).toBeTruthy();
    expect(screen.getByText("Capture 2 / beta.example")).toBeTruthy();

    fireEvent.click(screen.getByText("2 captures").closest("button")!);
    expect(onChange).toHaveBeenCalledWith(["capture-a"]);
  });

  it("adds one representative by default and exposes a specific underlying capture", () => {
    const onAdd = vi.fn();
    render(<MaterialGroupAddList materials={duplicates.slice(0, 2)} onAdd={onAdd} getLabel={(item) => item.content} getMeta={(item) => item.source?.domain ?? ""} />);

    fireEvent.click(screen.getByText("2 captures").closest("button")!);
    expect(onAdd).toHaveBeenLastCalledWith("capture-a");

    fireEvent.click(screen.getByRole("button", { name: "Expand 2 captures" }));
    fireEvent.click(screen.getByText("Capture 2 / beta.example").closest("button")!);
    expect(onAdd).toHaveBeenLastCalledWith("capture-b");
  });
});
