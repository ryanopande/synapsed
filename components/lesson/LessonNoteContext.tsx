"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface LessonNote {
  content?: unknown;
  contentText?: string;
  wordCount?: number;
  title?: string;
  aiEntries?: unknown[];
  [key: string]: unknown;
}

interface LessonNoteContextType {
  // State
  lessonNote: LessonNote | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  
  // Actions
  fetchNote: (classId: string, nodeId: string) => Promise<void>;
  saveNote: (content: unknown, title?: string) => Promise<void>;
  updateNote: (content: unknown, title?: string) => void;
  clearError: () => void;
}

const LessonNoteContext = createContext<LessonNoteContextType | undefined>(undefined);

interface LessonNoteProviderProps {
  children: ReactNode;
  classId?: string;
  nodeId?: string;
}

export function LessonNoteProvider({ children, classId, nodeId }: LessonNoteProviderProps) {
  const [lessonNote, setLessonNote] = useState<LessonNote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch note from API
  const fetchNote = useCallback(async (fetchClassId: string, fetchNodeId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/lesson-notes?classId=${fetchClassId}&dbNodeId=${fetchNodeId}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch note: ${res.statusText}`);
      }
      
      const data = await res.json();
      setLessonNote(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch note';
      setError(errorMessage);
      console.error('Failed to fetch lesson note:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save note to API
  const saveNote = useCallback(async (content: unknown, title?: string) => {
    if (!classId || !nodeId) {
      console.warn('Cannot save note: missing classId or nodeId');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const res = await fetch('/api/lesson-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          classId, 
          dbNodeId: nodeId, 
          content, 
          title 
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to save note: ${res.statusText}`);
      }
      
      const updatedNote = await res.json();
      setLessonNote(updatedNote);
      setLastSaved(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save note';
      setError(errorMessage);
      console.error('Auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [classId, nodeId]);

  // Optimistic update (immediate UI update)
  const updateNote = useCallback((content: unknown, title?: string) => {
    setLessonNote(prev => ({
      ...prev,
      content,
      ...(title ? { title } : {}),
    }));
  }, []);

  // Debounced auto-save
  const debouncedSave = useCallback(async (content: unknown, title?: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    saveTimerRef.current = setTimeout(() => {
      saveNote(content, title);
    }, 1500); // 1.5 second delay
  }, [saveNote]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch note when classId and nodeId are provided
  useEffect(() => {
    if (classId && nodeId) {
      fetchNote(classId, nodeId);
    }
  }, [classId, nodeId, fetchNote]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const contextValue: LessonNoteContextType = {
    lessonNote,
    isLoading,
    isSaving,
    lastSaved,
    error,
    fetchNote,
    saveNote: debouncedSave,
    updateNote,
    clearError,
  };

  return (
    <LessonNoteContext.Provider value={contextValue}>
      {children}
    </LessonNoteContext.Provider>
  );
}

// Custom hook to use the context
export function useLessonNote() {
  const context = useContext(LessonNoteContext);
  if (context === undefined) {
    throw new Error('useLessonNote must be used within a LessonNoteProvider');
  }
  return context;
}
