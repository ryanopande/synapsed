import { GEMINI_MODEL } from "@/lib/gemini-model";

/**
 * Resilient Gemini calls for pathway generation and explanations.
 *
 * Gemini is sometimes briefly overloaded (503 "high demand", 429). This retries with growing waits and,
 * because one model can stay busy while another is free, rotates through a short list of models:
 * GEMINI_MODEL first, then GEMINI_FALLBACK_MODEL (if set) and two known-good alternatives.
 * A model that has been retired (404 "no longer available") is skipped for the rest of the call.
 * A model whose DAILY free quota is used up (429 "per day", "retry in 16h...") is skipped immediately: waiting
 * cannot help until the daily reset. A per-minute 429 waits for the time Google asks for. A call that gives no
 * answer for a long time is abandoned (so the next attempt can use another model).
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

/** The model's DAILY quota is used up: retrying (or waiting) cannot help until the daily reset. */
export function isDailyQuotaExhausted(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const rateLimited = message.includes("429") || message.includes("resource_exhausted");
  return rateLimited && (/per day|perday|requests per day/.test(message) || /retry in \d+h/.test(message));
}

/** Seconds Google asks us to wait ("Please retry in 16s"), if it says. */
function suggestedWaitSeconds(error: unknown): number | null {
  const m = (error instanceof Error ? error.message : String(error)).match(/retry in ([\d.]+)s/i);
  return m ? parseFloat(m[1]) : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: Gemini gave no answer within ${Math.round(ms / 1000)}s (temporary)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
  opts: { attempts?: number; baseDelayMs?: number; maxWaitMs?: number; timeoutMs?: number; label?: string; models?: string[] } = {}
): Promise<T> {
  const models = opts.models ?? geminiModelCandidates();
  const attempts = opts.attempts ?? Math.max(6, models.length * 3);
  const base = opts.baseDelayMs ?? 3000;
  const maxWait = opts.maxWaitMs ?? 60000;
  const timeoutMs = opts.timeoutMs ?? 120000;
  const label = opts.label ?? "call";
  const gone = new Set<string>();
  let quotaUsedUp = 0;
  let cursor = 0; // which of the still-usable models to try next; moves on only after a temporary failure
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const live = models.filter((m) => !gone.has(m));
    if (live.length === 0) break; // every model is retired or out of quota
    const model = live[cursor % live.length];
    try {
      const result = await withTimeout(call(model), timeoutMs, label);
      if (model !== models[0]) console.warn(`[GEMINI_RETRY] ${label}: answered by fallback model ${model}`);
      return result;
    } catch (error) {
      lastError = error;
      if (isDailyQuotaExhausted(error)) {
        gone.add(model);
        quotaUsedUp++;
        console.warn(`[GEMINI_RETRY] ${label}: model ${model} has used up its daily quota, skipping it`);
        continue;
      }
      if (isModelGone(error)) {
        gone.add(model);
        console.warn(`[GEMINI_RETRY] ${label}: model ${model} is no longer available, skipping it`);
        continue;
      }
      if (!isTransientGeminiError(error) || attempt === attempts) throw error;
      cursor++; // a temporary failure: try the next model next time
      const asked = suggestedWaitSeconds(error);
      const wait = Math.min(asked !== null ? Math.ceil(asked * 1000) + 500 : base * Math.min(attempt, 4) + Math.floor(Math.random() * 1000), maxWait);
      console.warn(`[GEMINI_RETRY] ${label}: attempt ${attempt}/${attempts} on ${model} failed (temporary); retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  if (quotaUsedUp > 0 && quotaUsedUp === gone.size) {
    throw new Error(
      "Gemini's free daily quota is used up for every configured model, so nothing more can be generated until it resets " +
        "(midnight Pacific time, about noon in Abu Dhabi) or a key with billing enabled is used."
    );
  }
  throw lastError ?? new Error("No Gemini model is available");
}
