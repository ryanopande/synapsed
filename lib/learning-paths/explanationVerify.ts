// Pure helpers (no imports) for the "why this node" explanations.
// The AI writes the explanation; this file mechanically checks that every quoted
// piece of evidence really appears in the learner's survey answers / the syllabus,
// so instructors can tell checked evidence from unchecked evidence.

export type SurveyAnswer = { questionId: string; answer: string };
export type SurveyQuestionLike = { id?: string; questionId?: string; text?: string };

export type SurveyEvidence = {
  kind: "survey";
  questionId: string;
  questionText: string;
  quote: string;
  /** true only if the quote literally appears in the learner's answers */
  verified: boolean;
};

export type ObjectiveEvidence = {
  kind: "objective";
  text: string;
  /** true only if the text matches a line of the course's learning objectives */
  verified: boolean;
};

export type EvidenceItem = SurveyEvidence | ObjectiveEvidence;

export type RawNodeExplanation = {
  id?: unknown;
  rationale?: unknown;
  surveyEvidence?: unknown;
  courseObjective?: unknown;
};

const MAX_EVIDENCE_PER_NODE = 3;
const MIN_MATCH_CHARS = 3;

/** Lowercase, drop punctuation and quote styles, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”`'"]/g, "")
    .replace(/[^a-z0-9À-￿]+/g, " ")
    .trim();
}

/** Turn the syllabus "learning objectives" text into one string per objective. */
export function parseObjectives(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-•*\d.)]+/, "").trim())
    .filter((line) => line.length > 3);
}

/** Collapse whitespace and cap length. Returns null for empty / non-string input. */
export function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars - 1).trimEnd() + "…" : cleaned;
}

export function verifySurveyEvidence(
  raw: unknown,
  answers: SurveyAnswer[],
  questions: SurveyQuestionLike[]
): SurveyEvidence[] {
  if (!Array.isArray(raw)) return [];
  const out: SurveyEvidence[] = [];

  for (const item of raw.slice(0, MAX_EVIDENCE_PER_NODE)) {
    const quote = cleanText((item as { quote?: unknown })?.quote, 300);
    if (!quote) continue;
    let questionId =
      typeof (item as { questionId?: unknown })?.questionId === "string"
        ? ((item as { questionId: string }).questionId as string).trim()
        : "";

    const needle = normalizeText(quote);
    const contains = (a: SurveyAnswer | undefined) =>
      !!a && needle.length >= MIN_MATCH_CHARS && normalizeText(String(a.answer ?? "")).includes(needle);

    let verified = contains(answers.find((a) => a.questionId === questionId));
    if (!verified) {
      // The model may have labelled the wrong question: look for the quote anywhere.
      const found = answers.find((a) => contains(a));
      if (found) {
        questionId = found.questionId;
        verified = true;
      }
    }

    const questionText =
      questions.find((q) => (q.id ?? q.questionId) === questionId)?.text ?? "";
    out.push({ kind: "survey", questionId, questionText, quote, verified });
  }
  return out;
}

export function verifyObjective(raw: unknown, objectives: string[]): ObjectiveEvidence | null {
  // The model may copy the list number ("1. Define ...") from the prompt: drop it.
  const text = cleanText(typeof raw === "string" ? raw.replace(/^\s*\d+[.)]\s*/, "") : raw, 300);
  if (!text) return null;
  const needle = normalizeText(text);
  const verified =
    needle.length >= 8 &&
    objectives.some((o) => {
      const hay = normalizeText(o);
      return hay === needle || hay.includes(needle) || needle.includes(hay);
    });
  return { kind: "objective", text, verified };
}

export function buildNodeExplanation(
  raw: RawNodeExplanation,
  ctx: { answers: SurveyAnswer[]; questions: SurveyQuestionLike[]; objectives: string[] }
): { rationale: string | null; evidence: EvidenceItem[] } {
  const evidence: EvidenceItem[] = verifySurveyEvidence(raw.surveyEvidence, ctx.answers, ctx.questions);
  const objective = verifyObjective(raw.courseObjective, ctx.objectives);
  if (objective) evidence.push(objective);
  return { rationale: cleanText(raw.rationale, 500), evidence };
}

export function evidenceStats(lists: EvidenceItem[][]): { verified: number; unverified: number } {
  let verified = 0;
  let unverified = 0;
  for (const list of lists) {
    for (const e of list) {
      if (e.verified) verified++;
      else unverified++;
    }
  }
  return { verified, unverified };
}
