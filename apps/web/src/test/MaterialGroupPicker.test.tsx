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
  material("capture-a", "voice", "同一段资料", "alpha.example"),
  material("capture-b", "voice", "同一段资料", "beta.example"),
  material("separate", "text", "同一段资料", "text.example"),
];

describe("MaterialGroupPicker", () => {
  it("collapses exact same-kind content and keeps every capture selectable after expansion", () => {
    const onChange = vi.fn();
    render(<MaterialGroupPicker materials={duplicates} selectedIds={[]} onChange={onChange} getLabel={(item) => item.content} getMeta={(item) => item.source?.domain ?? ""} />);

    expect(screen.getByText("2 次")).toBeTruthy();
    expect(screen.queryByText(/第 1 次/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "展开2 次捕获" }));
    expect(screen.getByText("第 1 次 · alpha.example")).toBeTruthy();
    expect(screen.getByText("第 2 次 · beta.example")).toBeTruthy();

    fireEvent.click(screen.getByText("2 次").closest("button")!);
    expect(onChange).toHaveBeenCalledWith(["capture-a"]);
  });

  it("adds one representative by default and exposes a specific underlying capture", () => {
    const onAdd = vi.fn();
    render(<MaterialGroupAddList materials={duplicates.slice(0, 2)} onAdd={onAdd} getLabel={(item) => item.content} getMeta={(item) => item.source?.domain ?? ""} />);

    fireEvent.click(screen.getByText("2 次").closest("button")!);
    expect(onAdd).toHaveBeenLastCalledWith("capture-a");

    fireEvent.click(screen.getByRole("button", { name: "展开2 次捕获" }));
    fireEvent.click(screen.getByText("第 2 次 · beta.example").closest("button")!);
    expect(onAdd).toHaveBeenLastCalledWith("capture-b");
  });
});
