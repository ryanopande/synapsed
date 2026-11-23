// Checks for lib/learning-paths/geminiRetry.ts using simulated failures. Run: node scripts/test-gemini-retry.mjs
import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";
process.env.GEMINI_MODEL = "primary-model";
const src = fs.readFileSync(new URL("../lib/learning-paths/geminiRetry.ts", import.meta.url), "utf8")
  .replace('import { GEMINI_MODEL } from "@/lib/gemini-model";', 'const GEMINI_MODEL = process.env.GEMINI_MODEL;');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} }; new Function("module", "exports", "console", js)(m, m.exports, { warn() {}, log() {} });
const { withGeminiRetry, isTransientGeminiError, isDailyQuotaExhausted, geminiModelCandidates } = m.exports;
const E = (msg) => new Error(msg);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("  ok -", name); };
const fast = { baseDelayMs: 1 };

await t("classifies errors", () => {
  assert.ok(isTransientGeminiError(E('got status: 503 Service Unavailable. high demand')));
  assert.ok(isTransientGeminiError(E("429 RESOURCE_EXHAUSTED")));
  assert.ok(isTransientGeminiError(E("fetch failed")));
  assert.ok(isTransientGeminiError(E("Gemini returned no pathway nodes (temporary)")));
  assert.ok(!isTransientGeminiError(E("400 API key not valid")));
});
await t("model list: primary first, fallbacks added, no duplicates; GEMINI_NO_FALLBACK limits it", () => {
  assert.deepEqual(geminiModelCandidates(), ["primary-model", "gemini-3-flash-preview", "gemini-3.5-flash-lite"]);
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3-flash-preview";
  assert.deepEqual(geminiModelCandidates(), ["primary-model", "gemini-3-flash-preview", "gemini-3.5-flash-lite"]);
  process.env.GEMINI_NO_FALLBACK = "1"; assert.deepEqual(geminiModelCandidates(), ["primary-model"]); delete process.env.GEMINI_NO_FALLBACK; delete process.env.GEMINI_FALLBACK_MODEL;
});
await t("succeeds first time with the primary model", async () => {
  const used = []; const r = await withGeminiRetry(async (model) => { used.push(model); return "ok"; }, fast);
  assert.equal(r, "ok"); assert.deepEqual(used, ["primary-model"]);
});
await t("retries a 503 and rotates to another model", async () => {
  const used = []; const r = await withGeminiRetry(async (model) => { used.push(model); if (model === "primary-model") throw E("503 high demand"); return "from " + model; }, fast);
  assert.equal(r, "from gemini-3-flash-preview"); assert.deepEqual(used, ["primary-model", "gemini-3-flash-preview"]);
});
await t("a retired model (404) is skipped without waiting and never tried again", async () => {
  const used = []; const r = await withGeminiRetry(async (model) => { used.push(model); if (model === "primary-model") throw E("got status: 404 Not Found. This model is no longer available"); return "ok"; }, fast);
  assert.equal(r, "ok"); assert.equal(used.filter((x) => x === "primary-model").length, 1);
});
await t("a non-temporary error fails immediately, with no retries", async () => {
  let calls = 0; await assert.rejects(withGeminiRetry(async () => { calls++; throw E("400 API key not valid"); }, fast), /API key/); assert.equal(calls, 1);
});
await t("gives up after the attempts when everything stays overloaded, and reports the last error", async () => {
  let calls = 0; await assert.rejects(withGeminiRetry(async () => { calls++; throw E("503 high demand"); }, { ...fast, attempts: 4 }), /503/); assert.equal(calls, 4);
});
await t("if every model is retired it stops with the error instead of looping", async () => {
  let calls = 0; await assert.rejects(withGeminiRetry(async () => { calls++; throw E("404 model not found"); }, fast), /404/); assert.ok(calls <= 3);
});
const DAILY = 'got status: 429 Too Many Requests. You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3-flash, Generate content requests per day limit exceeded on Free Tier. Please retry in 16h39m57.2s.';
const PER_MIN = "got status: 429 Too Many Requests. Rate limit exceeded. Please retry in 0.001s.";
await t("tells a DAILY quota apart from a per-minute rate limit", () => {
  assert.ok(isDailyQuotaExhausted(E(DAILY))); assert.ok(!isDailyQuotaExhausted(E(PER_MIN))); assert.ok(!isDailyQuotaExhausted(E("503 high demand")));
});
await t("a model with its daily quota used up is skipped at once (one call, no waiting) and the next model answers", async () => {
  const used = []; const t0 = Date.now();
  const r = await withGeminiRetry(async (model) => { used.push(model); if (model === "primary-model") throw E(DAILY); return "ok from " + model; }, { baseDelayMs: 5000 });
  assert.equal(r, "ok from gemini-3-flash-preview"); assert.equal(used.filter((x) => x === "primary-model").length, 1); assert.ok(Date.now() - t0 < 1000, "must not wait");
});
await t("when EVERY model is out of daily quota it stops quickly with a clear explanation", async () => {
  let calls = 0; await assert.rejects(withGeminiRetry(async () => { calls++; throw E(DAILY); }, fast), /free daily quota is used up/); assert.equal(calls, 3);
});
await t("a per-minute 429 is retried after the wait Google asks for (capped)", async () => {
  let calls = 0; const r = await withGeminiRetry(async () => { calls++; if (calls === 1) throw E(PER_MIN); return "ok"; }, { ...fast, maxWaitMs: 20, models: ["only-model"] });
  assert.equal(r, "ok"); assert.equal(calls, 2);
});
await t("a call that never answers is abandoned after the timeout and the next model is tried", async () => {
  const used = []; const r = await withGeminiRetry(async (model) => { used.push(model); if (model === "primary-model") return new Promise(() => {}); return "ok"; }, { ...fast, timeoutMs: 30 });
  assert.equal(r, "ok"); assert.deepEqual(used, ["primary-model", "gemini-3-flash-preview"]);
});

console.log(`\nALL ${n} CHECKS PASSED`);
