import { render, screen } from "@testing-library/react";
import { MoreHorizontal } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "../ui/Button";

describe("shared action primitives", () => {
  it("keeps a loading action stable and exposes its state", () => {
    render(<Button loading loadingLabel="Saving">Save</Button>);

    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Saving" });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".invisible")?.textContent).toBe("Save");
  });

  it("gives icon-only actions an accessible label and native tooltip", () => {
    render(<IconButton label="More actions" variant="ghost"><MoreHorizontal size={16} /></IconButton>);

    const button = screen.getByRole("button", { name: "More actions" });
    expect(button.getAttribute("title")).toBe("More actions");
  });
});
