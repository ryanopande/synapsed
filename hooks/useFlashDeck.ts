import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { generateFlashcards } from '@/lib/flashcard/aiClient';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  tags: string[];
  type: string;
  order: number;
}

interface FlashcardDeck {
  id: string;
  nodeId: string;
  title: string;
  cards: Flashcard[];
  lastGenerated: string;
  createdAt: string;
  updatedAt: string;
}

interface QuizQuestion {
  question: string;
  answer: string;
  options?: string[];
}

export function useFlashDeck(nodeId: string, nodeTitle?: string, markdownContent?: string, quizQuestions?: QuizQuestion[]) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetcher for flashcard deck
  const deckFetcher = async (url: string) => {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    } else if (response.status === 404) {
      return null; // No deck exists yet
    } else {
      throw new Error('Failed to fetch deck');
    }
  };

  // Use SWR for flashcard deck fetching (cached and fast)
  const deckKey = nodeId ? `/api/flashcard/${nodeId}` : null;
  const { data: deck, mutate, isLoading: isLoadingDeck } = useSWR<FlashcardDeck | null>(
    deckKey,
    deckFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
    }
  );

  const generateDeck = useCallback(async () => {
    if (!nodeTitle || !markdownContent) {
      setError('Missing content for generation');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await generateFlashcards(nodeId, nodeTitle, markdownContent, quizQuestions);
      // Update SWR cache with the new deck
      await mutate(data, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate deck');
    } finally {
      setLoading(false);
    }
  }, [nodeId, nodeTitle, markdownContent, quizQuestions, mutate]);

  const updateProgress = async (cardId: string, mastered: boolean) => {
    try {
      await fetch('/api/progress/flashcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, cardId, mastered })
      });
    } catch (err) {
      console.error('Failed to update progress:', err);
    }
  };

  return { 
    deck, 
    loading: loading || isLoadingDeck, // Combine generation loading with SWR loading
    error, 
    generateDeck, 
    updateProgress, 
    refetch: mutate // Use SWR's mutate function for manual refetch
  };
} 