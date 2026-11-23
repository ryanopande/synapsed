import { GEMINI_MODEL } from "@/lib/gemini-model";

/**
 * Resilient Gemini calls for pathway generation and explanations.
 *
 * Gemini is sometimes briefly overloaded (503 "high demand", 429). This retries with growing waits and,
 * because one model can stay busy while another is free, rotates through a short list of models:
 * GEMINI_MODEL first, then GEMINI_FALLBACK_MODEL (if set) and two known-good alternatives.
 * A model that has been retired (404 "no longer available") is skipped for the rest of the call.
 * Anything else (a bad request, a missing key) fails immediately, since retrying would not help.
 *
 * Set GEMINI_NO_FALLBACK=1 to use only GEMINI_MODEL (e.g. when every pathway must come from one model).
 */

const TRANSIENT = [
  "503", "429", "500", "unavailable", "resource_exhausted", "overloaded", "high demand",
  "deadline", "timeout", "timed out", "econnreset", "etimedout", "fetch failed", "socket hang up",
  "(temporary)",
];

export function isTransientGeminiError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return TRANSIENT.some((t) => message.includes(t));
}

function isModelGone(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes("404") && (message.includes("no longer available") || message.includes("not found"));
}

export function geminiModelCandidates(): string[] {
  if (process.env.GEMINI_NO_FALLBACK === "1") return [GEMINI_MODEL];
  const list = [GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL?.trim(), "gemini-3-flash-preview", "gemini-3.5-flash-lite"];
  return Array.from(new Set(list.filter((m): m is string => !!m)));
}

export async function withGeminiRetry<T>(
  call: (model: string) => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string; models?: string[] } = {}
): Promise<T> {
  const models = opts.models ?? geminiModelCandidates();
  const attempts = opts.attempts ?? Math.max(6, models.length * 3);
  const base = opts.baseDelayMs ?? 3000;
  const label = opts.label ?? "call";
  const gone = new Set<string>();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const live = models.filter((m) => !gone.has(m));
    if (live.length === 0) break;
    const model = live[(attempt - 1) % live.length];
    try {
      const result = await call(model);
      if (model !== models[0]) console.warn(`[GEMINI_RETRY] ${label}: answered by fallback model ${model}`);
      return result;
    } catch (error) {
      lastError = error;
      if (isModelGone(error)) {
        gone.add(model);
        console.warn(`[GEMINI_RETRY] ${label}: model ${model} is no longer available, skipping it`);
        continue;
      }
      if (!isTransientGeminiError(error) || attempt === attempts) throw error;
      const wait = base * Math.min(attempt, 4) + Math.floor(Math.random() * 1000);
      console.warn(`[GEMINI_RETRY] ${label}: attempt ${attempt}/${attempts} on ${model} failed (temporary); retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError ?? new Error("No Gemini model is available");
}
