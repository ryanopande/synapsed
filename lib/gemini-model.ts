/**
 * Central Gemini model configuration.
 *
 * **`GEMINI_MODEL`** — Default for:
 * - `@google/genai` `generateContent` (including **single-request** function calling:
 *   learning-paths, surveys, survey template, OCR quizzes, pathway, syllabus,
 *   `createInChatAssessment` tool, `/api/chat`).
 * - `ChatGoogleGenerativeAI` **without** bound tools (`/api/flashcard/AI`, editor Gemini).
 *
 * Single-shot tool calls do not re-send prior `functionCall` parts, so Gemini 3
 * `thought_signature` rules for multi-turn tool loops do not apply here.
 *
 * **`GEMINI_AGENT_MODEL`** — **Only** `lib/agent/simple-agent.ts` (LangGraph +
 * `bindTools` + MongoDB checkpoints). LangChain omits `thoughtSignature` when
 * serializing tool rounds; use a 2.5 Flash model until that is fixed or the
 * agent uses the SDK with full `content.parts` history.
 *
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures
 */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";

/**
 * @see module docstring above — LangGraph + `ChatGoogleGenerativeAI.bindTools` only.
 */
export const GEMINI_AGENT_MODEL =
  process.env.GEMINI_AGENT_MODEL?.trim() || "gemini-2.5-flash";
