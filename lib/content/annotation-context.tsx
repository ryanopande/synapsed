"use client"

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'
import { 
  AnnotationState, 
  ContentReference, 
  Note, 
  DocumentAnnotation,
  CreateContentReferenceRequest,
  CreateNoteRequest,
  UpdateNoteRequest
} from '../types/annotations'
import { databaseContentService } from './database-content-service'

// Action types for the reducer
type AnnotationAction =
  | { type: 'SET_CURRENT_DOCUMENT'; payload: DocumentAnnotation | null }
  | { type: 'SET_ACTIVE_CONTENT_REFERENCE'; payload: ContentReference | null }
  | { type: 'SET_ACTIVE_NOTE'; payload: Note | null }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'ADD_CONTENT_REFERENCE'; payload: ContentReference }
  | { type: 'UPDATE_CONTENT_REFERENCE'; payload: ContentReference }
  | { type: 'DELETE_CONTENT_REFERENCE'; payload: string }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'LOAD_DOCUMENT_ANNOTATIONS'; payload: DocumentAnnotation }

// Initial state
const initialState: AnnotationState = {
  currentDocument: null,
  activeContentReference: null,
  activeNote: null,
  isEditing: false
}

// Reducer function
function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
  switch (action.type) {
    case 'SET_CURRENT_DOCUMENT':
      return {
        ...state,
        currentDocument: action.payload,
        activeContentReference: null,
        activeNote: null,
        isEditing: false
      }
    
    case 'SET_ACTIVE_CONTENT_REFERENCE':
      return {
        ...state,
        activeContentReference: action.payload,
        activeNote: action.payload ? state.activeNote : null
      }
    
    case 'SET_ACTIVE_NOTE':
      return {
        ...state,
        activeNote: action.payload
      }
    
    case 'SET_EDITING':
      return {
        ...state,
        isEditing: action.payload
      }
    
    case 'ADD_CONTENT_REFERENCE':
      if (!state.currentDocument) return state
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          contentReferences: [...state.currentDocument.contentReferences, action.payload],
          metadata: {
            ...state.currentDocument.metadata,
            lastModified: new Date(),
            pagesWithNotes: databaseContentService.getPagesWithNotes([
              ...state.currentDocument.contentReferences,
              action.payload
            ])
          }
        }
      }
    
    case 'UPDATE_CONTENT_REFERENCE':
      if (!state.currentDocument) return state
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          contentReferences: state.currentDocument.contentReferences.map(ref => 
            ref.id === action.payload.id ? action.payload : ref
          ),
          metadata: {
            ...state.currentDocument.metadata,
            lastModified: new Date()
          }
        }
      }
    
    case 'DELETE_CONTENT_REFERENCE':
      if (!state.currentDocument) return state
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          contentReferences: state.currentDocument.contentReferences.filter(ref => ref.id !== action.payload),
          notes: state.currentDocument.notes.filter(note => note.contentReferenceId !== action.payload),
          metadata: {
            ...state.currentDocument.metadata,
            lastModified: new Date(),
            totalNotes: state.currentDocument.notes.filter(note => note.contentReferenceId !== action.payload).length,
            pagesWithNotes: databaseContentService.getPagesWithNotes(
              state.currentDocument.contentReferences.filter(ref => ref.id !== action.payload)
            )
          }
        }
      }
    
    case 'ADD_NOTE':
      if (!state.currentDocument) return state
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          notes: [...state.currentDocument.notes, action.payload],
          metadata: {
            ...state.currentDocument.metadata,
            lastModified: new Date(),
            totalNotes: state.currentDocument.notes.length + 1
          }
        }
      }
    
    case 'UPDATE_NOTE':
      if (!state.currentDocument) return state
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          notes: state.currentDocument.notes.map(note => 
            note.id === action.payload.id ? action.payload : note
          ),
          metadata: {
            ...state.currentDocument.metadata,
            lastModified: new Date()
          }
        }
      }
    
    case 'DELETE_NOTE':
      if (!state.currentDocument) return state
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          notes: state.currentDocument.notes.filter(note => note.id !== action.payload),
          metadata: {
            ...state.currentDocument.metadata,
            lastModified: new Date(),
            totalNotes: state.currentDocument.notes.length - 1
          }
        }
      }
    
    case 'LOAD_DOCUMENT_ANNOTATIONS':
      return {
        ...state,
        currentDocument: action.payload,
        activeContentReference: null,
        activeNote: null,
        isEditing: false
      }
    
    default:
      return state
  }
}

// Context interface
interface AnnotationContextType extends AnnotationState {
  // Document management
  loadDocumentAnnotations: (documentId: string) => Promise<void>
  clearDocumentAnnotations: (documentId: string) => Promise<void>
  
  // Content reference management
  createContentReference: (request: CreateContentReferenceRequest) => Promise<ContentReference | null>
  setActiveContentReference: (reference: ContentReference | null) => void
  updateContentReference: (id: string, updates: Partial<ContentReference>) => Promise<ContentReference | null>
  deleteContentReference: (id: string) => Promise<boolean>
  
  // Note management
  createNote: (request: CreateNoteRequest) => Promise<Note | null>
  updateNote: (request: UpdateNoteRequest) => Promise<Note | null>
  deleteNote: (noteId: string) => Promise<boolean>
  setActiveNote: (note: Note | null) => void
  
  // UI state
  setEditing: (editing: boolean) => void
  
  // Utility methods
  getNotesForContentReference: (contentReferenceId: string) => Promise<Note[]>
  getPagesWithNotes: () => number[]
}

// Create the context
const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined)

// Provider component
interface AnnotationProviderProps {
  children: ReactNode
}

export function AnnotationProvider({ children }: AnnotationProviderProps) {
  const [state, dispatch] = useReducer(annotationReducer, initialState)

  // Load document annotations from database
  const loadDocumentAnnotations = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`)
      if (response.ok) {
        const document = await response.json()
        // Convert the document data to DocumentAnnotation format
        const annotations: DocumentAnnotation = {
          documentId: document.id,
          documentName: document.name,
          contentReferences: document.contentReferences || [],
          notes: document.contentReferences?.flatMap((ref: { notes?: Note[] }) => ref.notes || []) || [],
          metadata: {
            createdAt: new Date(document.uploadedAt),
            lastModified: new Date(document.lastModified),
            totalNotes: document.contentReferences?.reduce((total: number, ref: { notes?: Note[] }) => total + (ref.notes?.length || 0), 0) || 0,
            pagesWithNotes: document.annotations?.pagesWithNotes || []
          }
        }
        dispatch({ type: 'LOAD_DOCUMENT_ANNOTATIONS', payload: annotations })
      } else {
        dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: null })
      }
    } catch (error) {
      console.error('Error loading document annotations:', error)
      dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: null })
    }
  }, [])

  // Clear document annotations
  const clearDocumentAnnotations = useCallback(async (documentId: string) => {
    const success = await databaseContentService.clearDocumentAnnotations(documentId)
    if (success) {
      dispatch({ type: 'SET_CURRENT_DOCUMENT', payload: null })
    }
  }, [])

  // Create content reference
  const createContentReference = useCallback(async (request: CreateContentReferenceRequest): Promise<ContentReference | null> => {
    const reference = await databaseContentService.createContentReference(request)
    if (reference) {
      dispatch({ type: 'ADD_CONTENT_REFERENCE', payload: reference })
      return reference
    }
    return null
  }, [])

  // Set active content reference
  const setActiveContentReference = useCallback((reference: ContentReference | null) => {
    dispatch({ type: 'SET_ACTIVE_CONTENT_REFERENCE', payload: reference })
  }, [])

  // Create note
  const createNote = useCallback(async (request: CreateNoteRequest): Promise<Note | null> => {
    const note = await databaseContentService.createNote(request)
    if (note) {
      dispatch({ type: 'ADD_NOTE', payload: note })
      return note
    }
    return null
  }, [])

  // Update note
  const updateNote = useCallback(async (request: UpdateNoteRequest): Promise<Note | null> => {
    const note = await databaseContentService.updateNote(request)
    if (note) {
      dispatch({ type: 'UPDATE_NOTE', payload: note })
      return note
    }
    return null
  }, [])

  // Delete note
  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    const success = await databaseContentService.deleteNote(noteId)
    if (success) {
      dispatch({ type: 'DELETE_NOTE', payload: noteId })
      return true
    }
    return false
  }, [])

  // Update content reference
  const updateContentReference = useCallback(async (id: string, updates: Partial<ContentReference>): Promise<ContentReference | null> => {
    const reference = await databaseContentService.updateContentReference(id, updates)
    if (reference) {
      dispatch({ type: 'UPDATE_CONTENT_REFERENCE', payload: reference })
      return reference
    }
    return null
  }, [])

  // Delete content reference
  const deleteContentReference = useCallback(async (id: string): Promise<boolean> => {
    const success = await databaseContentService.deleteContentReference(id)
    if (success) {
      dispatch({ type: 'DELETE_CONTENT_REFERENCE', payload: id })
      // If the deleted reference was active, clear the active reference
      if (state.activeContentReference?.id === id) {
        dispatch({ type: 'SET_ACTIVE_CONTENT_REFERENCE', payload: null })
      }
      return true
    }
    return false
  }, [state.activeContentReference])

  // Set active note
  const setActiveNote = useCallback((note: Note | null) => {
    dispatch({ type: 'SET_ACTIVE_NOTE', payload: note })
  }, [])

  // Set editing state
  const setEditing = useCallback((editing: boolean) => {
    dispatch({ type: 'SET_EDITING', payload: editing })
  }, [])

  // Get notes for content reference
  const getNotesForContentReference = useCallback(async (contentReferenceId: string): Promise<Note[]> => {
    return await databaseContentService.getNotesForContentReference(contentReferenceId)
  }, [])

  // Get pages with notes
  const getPagesWithNotes = useCallback((): number[] => {
    if (!state.currentDocument) return []
    return state.currentDocument.metadata.pagesWithNotes
  }, [state.currentDocument])

  // Context value
  const contextValue: AnnotationContextType = {
    ...state,
    loadDocumentAnnotations,
    clearDocumentAnnotations,
    createContentReference,
    setActiveContentReference,
    updateContentReference,
    deleteContentReference,
    createNote,
    updateNote,
    deleteNote,
    setActiveNote,
    setEditing,
    getNotesForContentReference,
    getPagesWithNotes
  }

  return (
    <AnnotationContext.Provider value={contextValue}>
      {children}
    </AnnotationContext.Provider>
  )
}

// Custom hook to use the annotation context
export function useAnnotation() {
  const context = useContext(AnnotationContext)
  if (context === undefined) {
    throw new Error('useAnnotation must be used within an AnnotationProvider')
  }
  return context
}
