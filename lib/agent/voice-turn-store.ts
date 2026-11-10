interface CachedVoiceTurnResponse {
  userText: string;
  assistantText: string;
  diagramData?: unknown;
  sources?: unknown;
  inChatAssessmentData?: unknown;
  threadId?: string;
  conversationId?: string;
}

interface VoiceTurnCacheEntry {
  response: CachedVoiceTurnResponse;
  expiresAt: number;
}

const TURN_TTL_MS = 5 * 60 * 1000;
const voiceTurnCache = new Map<string, VoiceTurnCacheEntry>();

function makeKey(threadOrConversation: string, turnId: string): string {
  return `${threadOrConversation}::${turnId}`;
}

export function getCachedVoiceTurn(
  threadOrConversation: string,
  turnId: string
): CachedVoiceTurnResponse | null {
  const key = makeKey(threadOrConversation, turnId);
  const entry = voiceTurnCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    voiceTurnCache.delete(key);
    return null;
  }

  return entry.response;
}

export function setCachedVoiceTurn(
  threadOrConversation: string,
  turnId: string,
  response: CachedVoiceTurnResponse
) {
  const key = makeKey(threadOrConversation, turnId);
  voiceTurnCache.set(key, {
    response,
    expiresAt: Date.now() + TURN_TTL_MS,
  });
}

export function pruneExpiredVoiceTurns() {
  const now = Date.now();
  for (const [key, value] of voiceTurnCache.entries()) {
    if (value.expiresAt < now) {
      voiceTurnCache.delete(key);
    }
  }
}
