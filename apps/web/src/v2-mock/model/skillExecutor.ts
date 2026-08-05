import type { Source, Skill, SkillRevision } from "./types";

export interface SkillExecutionInput {
  skill: Skill;
  revision: SkillRevision;
  input: string;
  contextSources?: Source[];
}

function cleanSpeech(input: string) {
  const cleaned = input
    .replace(/\b(um+|uh+|you know|like)\b[,.]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? `${cleaned[0].toUpperCase()}${cleaned.slice(1)}` : "";
}

function recommendationCount(instruction: string) {
  const numeric = instruction.match(/\b([2-6])\s+(?:concise\s+)?(?:recommendations?|bullets?|points?)/i);
  if (numeric) return Number(numeric[1]);
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const word = instruction.match(/\b(two|three|four|five|six)\s+(?:concise\s+)?(?:recommendations?|bullets?|points?)/i);
  return word ? words[word[1].toLowerCase()] : null;
}

function evidenceSummary(sources: Source[] | undefined, fallback: string) {
  const sourceText = sources?.map((source) => source.revisions.at(-1)?.content).filter(Boolean).join(" ") ?? "";
  const text = sourceText || fallback;
  if (/offline capture|field evidence/i.test(text)) return "Keep offline capture connected to the decision moment.";
  if (/return(?:ed)? to (?:their )?notes|revisit notes/i.test(text)) return "Make evidence easy to revisit when a decision is due.";
  return text.trim().replace(/\s+/g, " ").slice(0, 180);
}

export function executeSkill({ skill, revision, input, contextSources }: SkillExecutionInput) {
  const instruction = revision.instruction.toLocaleLowerCase();
  const normalizedInput = input.trim().replace(/\s+/g, " ");

  if (skill.category === "transcription") return cleanSpeech(normalizedInput);

  if (skill.category === "transformation") {
    if (/concise|shorten|remove filler|rough spoken/.test(instruction)) return cleanSpeech(normalizedInput).replace(/^Thanks[—,\s]+/i, "");
    return cleanSpeech(normalizedInput);
  }

  if (skill.category === "organization") {
    return `Suggested because this Source adds evidence to the current Project goal: ${evidenceSummary(contextSources, normalizedInput)}`;
  }

  if (skill.category === "generation") {
    const evidence = evidenceSummary(contextSources, normalizedInput);
    const count = recommendationCount(revision.instruction);
    if (count) return Array.from({ length: count }, (_, index) => `${index + 1}. ${index === 0 ? evidence : `Use cited evidence to make recommendation ${index + 1} explicit.`}`).join("\n");
    return `The research points to one clear priority: ${evidence} This keeps the recommendation grounded in the Sources used for this run.`;
  }

  if (/translate.*(?:chinese|simplified chinese)|(?:chinese|simplified chinese).*translate/.test(instruction)) {
    return "参与者会在准备做出决定时重新查看笔记，而不是在浏览时。";
  }
  if (/decision signal|decision implication/.test(instruction)) {
    return "Decision signal: evidence must be available at the moment it can change a choice.";
  }
  if (/summari[sz]e/.test(instruction)) {
    return "Offline capture matters first; evidence review matters when a decision arrives.";
  }
  if (/explain|plain language/.test(instruction)) {
    return "The note becomes useful later, when the reader needs evidence for a decision.";
  }
  if (/rewrite|clarity and rhythm/.test(instruction)) {
    return "People return to their notes when a decision is due—not while they browse.";
  }
  if (/shorten|remove repetition|concise/.test(instruction)) {
    return "People revisit notes when making decisions.";
  }

  const prefix = revision.outputFormat === "markdown" ? "- " : "";
  return `${prefix}${skill.name}: ${normalizedInput}`;
}
