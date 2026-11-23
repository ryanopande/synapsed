/**
 * Retry a Gemini call that fails for a temporary reason (503 "high demand", 429 rate limit,
 * a dropped connection, or an answer with no usable content), waiting a little longer each time.
 * Anything else (a bad request, a missing key) fails immediately: retrying would not help.
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

export async function withGeminiRetry<T>(
  call: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 5;
  const base = opts.baseDelayMs ?? 4000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === attempts) throw error;
      const wait = base * attempt + Math.floor(Math.random() * 1000);
      console.warn(`[GEMINI_RETRY] ${opts.label ?? "call"} attempt ${attempt}/${attempts} failed (temporary); retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}
