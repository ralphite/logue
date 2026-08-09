import { CornerDownLeft, FileText } from "lucide-react";
import { useState } from "react";
import { Answer, Button, ErrorNote, OriginMark, Select, Spinner, Textarea, originOf } from "@logue/ui";
import { ApiError, api, type Material, type Run, type Skill } from "../api";
import { useAction } from "./useHost";

/**
 * Ask, and see the Sources the answer stands on. The answer is never shown
 * without them — a claim you cannot trace is the failure this product exists
 * to prevent.
 */
export function GenerateBox({
  project,
  skills,
  onDone,
  onOpenDocument,
  onStale,
}: {
  project: string;
  skills: Skill[];
  onDone: () => void;
  onOpenDocument: (documentId: string) => void;
  onStale?: () => void;
}) {
  // Asking is not transcribing or filing: only Skills that produce something to
  // read belong in this picker, and Ask leads because it is what people reach for.
  const usable = skills
    .filter(
      (skill) =>
        skill.enabled &&
        skill.contexts.includes("project") &&
        ["insert", "document", "qa"].includes(skill.output),
    )
    .toSorted((a, b) => Number(Boolean(b.built_in_key)) - Number(Boolean(a.built_in_key)));

  const [skillId, setSkillId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<{ run: Run; sources: Material[] }>();
  const [openSource, setOpenSource] = useState<number>();
  const action = useAction();

  const skill =
    usable.find((item) => item.id === skillId) ??
    usable.find((item) => item.built_in_key === "ask") ??
    usable[0];
  const cited = openSource === undefined ? undefined : result?.sources[openSource - 1];

  const submit = async () => {
    if (!instruction.trim() || !skill) return;
    const ok = await action.run(async () => {
      try {
        setResult(await api.createRun({ skill_id: skill.id, instruction: instruction.trim(), project }));
      } catch (cause) {
        // The Skill list can be out of date if it changed in another window.
        // Reload it and let the person try again rather than stranding them.
        if (cause instanceof ApiError && cause.status === 404) {
          setSkillId("");
          onStale?.();
        }
        throw cause;
      }
    });
    if (ok) {
      setInstruction("");
      onDone();
    }
  };

  return (
    <section className="grid gap-1.5">
      <Textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={`Ask about ${project}…`}
        className="min-h-16"
        aria-label="What to ask"
      />
      <div className="flex items-center gap-1">
        <Select
          className="w-44"
          value={skill?.id ?? ""}
          onChange={(event) => setSkillId(event.target.value)}
          aria-label="Skill"
        >
          {usable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <span className="flex-1" />
        <Button
          variant="primary"
          disabled={!instruction.trim() || action.busy || !skill}
          onClick={() => void submit()}
        >
          {action.busy ? <Spinner size={13} /> : <CornerDownLeft size={13} />} Run
        </Button>
      </div>

      {action.error && <ErrorNote>{action.error}</ErrorNote>}

      {result && (
        <div className="mt-1 grid gap-2 rounded-lg border border-line bg-surface p-3">
          <OriginMark origin="ai" detail={`${result.run.skill_name} · ${result.sources.length} Sources`} />
          <p className="text-[13px] leading-[1.6] whitespace-pre-wrap text-ink">
            <Answer
              text={result.run.original_output ?? ""}
              onCite={setOpenSource}
              open={openSource}
              sources={result.sources}
            />
          </p>

          {cited && (
            <div className="rounded-md bg-surface-muted p-2">
              <OriginMark origin={originOf(cited.kind)} detail={cited.source?.domain || "This Mac"} />
              <p className="mt-1 line-clamp-6 text-xs leading-[1.5] text-ink-soft">{cited.content}</p>
            </div>
          )}

          <div className="flex justify-end gap-1">
            {result.run.output_type === "document" && (
              <Button
                onClick={() =>
                  void action.run(async () => {
                    const { document } = await api.runToDocument(result.run.id);
                    await api.adoptRun(
                      result.run.id,
                      result.run.original_output ?? "",
                      "document",
                      document.id,
                    );
                    onOpenDocument(document.id);
                  })
                }
              >
                <FileText size={13} /> Open as Document
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() =>
                void action.run(() => api.adoptRun(result.run.id, result.run.original_output ?? ""))
              }
            >
              Keep
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
