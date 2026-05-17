export const aiModels = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", plan: "free" },
  { id: "gpt-4.1", label: "GPT-4.1", plan: "pro" },
  { id: "gpt-5-mini", label: "GPT-5 Mini", plan: "plus" },
  { id: "gpt-5", label: "GPT-5", plan: "ultra" }
];

export function buildSystemPrompt(memory: string[] = []) {
  return [
    "You are Syntrix AI, a premium AI assistant for writing, research, coding, and business strategy.",
    "Be accurate, concise, and practical. Use markdown, tables, and code blocks when helpful.",
    memory.length ? `Long-term conversation memory:\n${memory.join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}
