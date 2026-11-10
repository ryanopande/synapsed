// Machine-to-machine access for the research pipeline in study/. Its scripts
// have no browser session, so they send STUDY_API_KEY in a header instead.
import { timingSafeEqual } from "crypto";

export const STUDY_API_KEY_HEADER = "x-study-api-key";

/** True when the request carries a valid STUDY_API_KEY (header, or `bodyKey`). */
export function isStudyServiceRequest(req: Request, bodyKey?: string): boolean {
  const expected = process.env.STUDY_API_KEY;
  if (!expected) return false;
  const provided = req.headers.get(STUDY_API_KEY_HEADER) ?? bodyKey;
  return !!provided && safeEqual(provided, expected);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
