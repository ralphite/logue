import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, Input } from "@logue/ui";

/**
 * One question with one answer — renaming, mostly.
 *
 * A rename that happens in place in the rail means editing a 13px row in a
 * 200px column while the list under it keeps re-sorting. This takes the name
 * out of the list to change it.
 */
export function PromptDialog({
  open,
  title,
  label,
  initial = "",
  confirm = "Save",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirm?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);

  // Re-seeded per opening: the dialog is reused for every row in the rail, and
  // the second rename would otherwise start on the first row's name.
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <label className="grid gap-1.5 text-xs text-muted">
        {label}
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) onConfirm(value.trim());
          }}
        />
      </label>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          data-primary
          variant="primary"
          disabled={!value.trim()}
          onClick={() => onConfirm(value.trim())}
        >
          {confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
