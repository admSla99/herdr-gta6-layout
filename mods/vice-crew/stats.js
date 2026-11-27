// Model, effort and context use, read off an agent's screen: Herdr doesn't report them.
// Status lines sit at the bottom, so the last lines count, newest match first.

const TAIL_LINES = 14;
const EFFORT = { low: "low", med: "medium", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

const MODEL_PATTERNS = [
  // Claude Code's status line ("Opus5.5·med") or banner ("Opus 5.5 with high effort").
  /\b(Opus|Sonnet|Haiku|Fable) ?(\d+(?:\.\d+)?)(?:\s*[·•]\s*(low|med|medium|high|xhigh|max)\b| with (\w+) effort)?/,
  // Codex and others.
  /\b(gpt-[\w.-]+)(?:\s+(low|medium|high|xhigh))?/,
  /\b(gemini-[\w.-]+)/,
  // pi's footer: "(openai-codex) gpt-6.1-sol • medium".
  /\([\w.-]+\)\s+(\S+)\s+•\s*(\w+)?/,
];

const USED = [/\bctx\b[^\d%]*(\d{1,3})%/, /[▰▓█]{1,}[▱░]*\s*(\d{1,3})%/];
const LEFT = [/Context left until auto-compact:\s*(\d{1,3})%/i, /(\d{1,3})% context left/i];

const tail = (text) => (text ?? "").split("\n").filter((l) => l.trim()).slice(-TAIL_LINES).reverse();

/** { name: "Opus 5.5", effort: "medium" | null } or null when the screen doesn't say. */
export function parseModel(text) {
  const lines = tail(text);
  const all = [...lines, ...(text ?? "").split("\n")];
  for (const line of all) {
    const m = line.match(MODEL_PATTERNS[0]);
    if (m) return { name: `${m[1]} ${m[2]}`, effort: EFFORT[m[3] ?? m[4]] ?? null };
  }
  for (const line of lines) {
    for (const p of MODEL_PATTERNS.slice(1)) {
      const m = line.match(p);
      if (m) return { name: m[1], effort: EFFORT[m[2]] ?? null };
    }
  }
  return null;
}

/** Percent of the context window used, 0..100, or null. */
export function parseContext(text) {
  for (const line of tail(text)) {
    for (const p of USED) { const m = line.match(p); if (m) return Math.min(100, Number(m[1])); }
    for (const p of LEFT) { const m = line.match(p); if (m) return Math.max(0, 100 - Number(m[1])); }
  }
  return null;
}
