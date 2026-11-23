// Checks for lib/learning-paths/geminiRetry.ts using simulated failures. Run: node scripts/test-gemini-retry.mjs
import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";
process.env.GEMINI_MODEL = "primary-model";
const src = fs.readFileSync(new URL("../lib/learning-paths/geminiRetry.ts", import.meta.url), "utf8")
  .replace('import { GEMINI_MODEL } from "@/lib/gemini-model";', 'const GEMINI_MODEL = process.env.GEMINI_MODEL;');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} }; new Function("module", "exports", "console", js)(m, m.exports, { warn() {}, log() {} });
const { withGeminiRetry, isTransientGeminiError, geminiModelCandidates } = m.exports;
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
console.log(`\nALL ${n} CHECKS PASSED`);
