import { 
    ContentReference, 
    Note, 
    DocumentAnnotation, 
    CreateContentReferenceRequest,
    CreateNoteRequest,
    UpdateNoteRequest,
    NoteSearchQuery,
    NoteSearchResult
  } from '../types/annotations'
  import { generateId, validateContentReference, validateNote } from '../utils/annotationUtils'
  
  /**
   * Service for managing content references and notes
   * Handles storage, retrieval, and business logic
   */
  
  class ContentReferenceService {
    private readonly STORAGE_KEY = 'pdf_annotations'
    private readonly MAX_NOTES_PER_REFERENCE = 10
  
    /**
     * Convert date strings back to Date objects after JSON parsing
     */
    private convertDates(annotations: DocumentAnnotation): DocumentAnnotation {
      return {
        ...annotations,
        contentReferences: annotations.contentReferences.map(ref => ({
          ...ref,
          timestamp: new Date(ref.timestamp),
          metadata: {
            ...ref.metadata,
            lastModified: new Date(ref.metadata.lastModified)
          }
        })),
        notes: annotations.notes.map(note => ({
          ...note,
          timestamp: new Date(note.timestamp),
          metadata: {
            ...note.metadata,
            lastModified: new Date(note.metadata.lastModified)
          }
        })),
        metadata: {
          ...annotations.metadata,
          createdAt: new Date(annotations.metadata.createdAt),
          lastModified: new Date(annotations.metadata.lastModified)
        }
      }
    }
  
    /**
     * Get all annotations for a document
     */
    getDocumentAnnotations(documentId: string): DocumentAnnotation | null {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) return null
  
        const allAnnotations: Record<string, DocumentAnnotation> = JSON.parse(stored)
        const annotations = allAnnotations[documentId]
        
        if (!annotations) return null
        
        // Convert date strings back to Date objects
        return this.convertDates(annotations)
      } catch (error) {
        console.error('Error retrieving document annotations:', error)
        return null
      }
    }
  
    /**
     * Save document annotations to localStorage
     */
    private saveDocumentAnnotations(documentId: string, annotations: DocumentAnnotation): void {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        const allAnnotations: Record<string, DocumentAnnotation> = stored ? JSON.parse(stored) : {}
        
        allAnnotations[documentId] = annotations
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allAnnotations))
      } catch (error) {
        console.error('Error saving document annotations:', error)
      }
    }
  
    /**
     * Create a new content reference
     */
    createContentReference(request: CreateContentReferenceRequest): ContentReference | null {
      try {
        // Validate the request
        const validation = validateContentReference(request)
        if (!validation.isValid) {
          console.error('Invalid content reference:', validation.errors)
          return null
        }
  
        // Create the content reference
        const contentReference: ContentReference = {
          id: generateId(),
          pageNumber: request.pageNumber,
          contentType: request.contentType,
          contentHash: request.contentHash,
          coordinates: request.coordinates,
          contentPreview: request.contentPreview,
          timestamp: new Date(),
          metadata: {
            documentId: request.documentId,
            documentName: request.documentName,
            createdBy: 'student', // TODO: Get from user context
            lastModified: new Date()
          }
        }
  
        // Get existing annotations or create new ones
        const existingAnnotations = this.getDocumentAnnotations(request.documentId)
        const annotations: DocumentAnnotation = existingAnnotations || {
          documentId: request.documentId,
          documentName: request.documentName,
          contentReferences: [],
          notes: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            totalNotes: 0,
            pagesWithNotes: []
          }
        }
  
        // Add the new content reference
        annotations.contentReferences.push(contentReference)
        annotations.metadata.lastModified = new Date()
        annotations.metadata.pagesWithNotes = this.getPagesWithNotes(annotations.contentReferences)
  
        // Save to localStorage
        this.saveDocumentAnnotations(request.documentId, annotations)
  
        return contentReference
      } catch (error) {
        console.error('Error creating content reference:', error)
        return null
      }
    }
  
    /**
     * Create a new note linked to a content reference
     */
    createNote(request: CreateNoteRequest): Note | null {
      try {
        // Validate the request
        const validation = validateNote(request)
        if (!validation.isValid) {
          console.error('Invalid note:', validation.errors)
          return null
        }
  
        // Check if content reference exists
        const contentRef = this.getContentReferenceById(request.contentReferenceId)
        if (!contentRef) {
          console.error('Content reference not found:', request.contentReferenceId)
          return null
        }
  
        // Check if we've reached the limit for this content reference
        const existingNotes = this.getNotesForContentReference(request.contentReferenceId)
        if (existingNotes.length >= this.MAX_NOTES_PER_REFERENCE) {
          console.error('Maximum notes per content reference reached')
          return null
        }
  
        // Create the note
        const note: Note = {
          id: generateId(),
          contentReferenceId: request.contentReferenceId,
          content: request.content,
          timestamp: new Date(),
          metadata: {
            createdBy: 'student', // TODO: Get from user context
            lastModified: new Date(),
            tags: request.tags || [],
            color: request.color
          }
        }
  
        // Get existing annotations
        const annotations = this.getDocumentAnnotations(contentRef.metadata.documentId)
        if (!annotations) {
          console.error('Document annotations not found')
          return null
        }
  
        // Add the new note
        annotations.notes.push(note)
        annotations.metadata.lastModified = new Date()
        annotations.metadata.totalNotes = annotations.notes.length
  
        // Save to localStorage
        this.saveDocumentAnnotations(contentRef.metadata.documentId, annotations)
  
        return note
      } catch (error) {
        console.error('Error creating note:', error)
        return null
      }
    }
  
    /**
     * Update an existing note
     */
    updateNote(request: UpdateNoteRequest): Note | null {
      try {
        // Find the note first
        const note = this.getNoteById(request.id)
        if (!note) {
          console.error('Note not found:', request.id)
          return null
        }
  
        // Create the updated note with existing data
        const updatedNote: Note = {
          ...note,
          ...request,
          metadata: {
            ...note.metadata,
            lastModified: new Date()
          }
        }
  
        // Validate the updated note
        const validation = validateNote(updatedNote)
        if (!validation.isValid) {
          console.error('Invalid note update:', validation.errors)
          return null
        }
  
        // Get the document annotations
        const contentRef = this.getContentReferenceById(note.contentReferenceId)
        if (!contentRef) {
          console.error('Content reference not found')
          return null
        }
  
        const annotations = this.getDocumentAnnotations(contentRef.metadata.documentId)
        if (!annotations) {
          console.error('Document annotations not found')
          return null
        }
  
        // Update the note in the annotations
        const noteIndex = annotations.notes.findIndex(n => n.id === request.id)
        if (noteIndex === -1) {
          console.error('Note not found in annotations')
          return null
        }
  
        annotations.notes[noteIndex] = updatedNote
        annotations.metadata.lastModified = new Date()
  
        // Save to localStorage
        this.saveDocumentAnnotations(contentRef.metadata.documentId, annotations)
  
        return updatedNote
      } catch (error) {
        console.error('Error updating note:', error)
        return null
      }
    }
  
    /**
     * Delete a note
     */
    deleteNote(noteId: string): boolean {
      try {
        // Find the note
        const note = this.getNoteById(noteId)
        if (!note) {
          console.error('Note not found:', noteId)
          return false
        }
  
        // Get the document annotations
        const contentRef = this.getContentReferenceById(note.contentReferenceId)
        if (!contentRef) {
          console.error('Content reference not found')
          return false
        }
  
        const annotations = this.getDocumentAnnotations(contentRef.metadata.documentId)
        if (!annotations) {
          console.error('Document annotations not found')
          return false
        }
  
        // Remove the note
        annotations.notes = annotations.notes.filter(n => n.id !== noteId)
        annotations.metadata.lastModified = new Date()
        annotations.metadata.totalNotes = annotations.notes.length
  
        // Save to localStorage
        this.saveDocumentAnnotations(contentRef.metadata.documentId, annotations)
  
        return true
      } catch (error) {
        console.error('Error deleting note:', error)
        return false
      }
    }
  
    /**
     * Update a content reference
     */
    updateContentReference(id: string, updates: Partial<ContentReference>): ContentReference | null {
      try {
        // Find the content reference
        const contentRef = this.getContentReferenceById(id)
        if (!contentRef) {
          console.error('Content reference not found:', id)
          return null
        }
  
        // Update the content reference
        const updatedRef: ContentReference = {
          ...contentRef,
          ...updates,
          metadata: {
            ...contentRef.metadata,
            lastModified: new Date()
          }
        }
  
        // Get the document annotations
        const annotations = this.getDocumentAnnotations(contentRef.metadata.documentId)
        if (!annotations) {
          console.error('Document annotations not found')
          return null
        }
  
        // Update the content reference in the annotations
        const refIndex = annotations.contentReferences.findIndex(ref => ref.id === id)
        if (refIndex === -1) {
          console.error('Content reference not found in annotations')
          return null
        }
  
        annotations.contentReferences[refIndex] = updatedRef
        annotations.metadata.lastModified = new Date()
  
        // Save to localStorage
        this.saveDocumentAnnotations(contentRef.metadata.documentId, annotations)
  
        return updatedRef
      } catch (error) {
        console.error('Error updating content reference:', error)
        return null
      }
    }
  
    /**
     * Delete a content reference and all its associated notes
     */
    deleteContentReference(id: string): boolean {
      try {
        // Find the content reference
        const contentRef = this.getContentReferenceById(id)
        if (!contentRef) {
          console.error('Content reference not found:', id)
          return false
        }
  
        // Get the document annotations
        const annotations = this.getDocumentAnnotations(contentRef.metadata.documentId)
        if (!annotations) {
          console.error('Document annotations not found')
          return false
        }
  
        // Remove the content reference
        annotations.contentReferences = annotations.contentReferences.filter(ref => ref.id !== id)
        
        // Remove all associated notes
        annotations.notes = annotations.notes.filter(note => note.contentReferenceId !== id)
        
        // Update metadata
        annotations.metadata.lastModified = new Date()
        annotations.metadata.totalNotes = annotations.notes.length
        annotations.metadata.pagesWithNotes = this.getPagesWithNotes(annotations.contentReferences)
  
        // Save to localStorage
        this.saveDocumentAnnotations(contentRef.metadata.documentId, annotations)
  
        return true
      } catch (error) {
        console.error('Error deleting content reference:', error)
        return false
      }
    }
  
      /**
     * Get a content reference by ID
     */
    getContentReferenceById(id: string): ContentReference | null {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) return null
  
        const allAnnotations: Record<string, DocumentAnnotation> = JSON.parse(stored)
  
        for (const documentAnnotations of Object.values(allAnnotations)) {
          const found = documentAnnotations.contentReferences.find(ref => ref.id === id)
          if (found) {
            // Convert dates for the found reference
            return {
              ...found,
              timestamp: new Date(found.timestamp),
              metadata: {
                ...found.metadata,
                lastModified: new Date(found.metadata.lastModified)
              }
            }
          }
        }
  
        return null
      } catch (error) {
        console.error('Error retrieving content reference:', error)
        return null
      }
    }
  
    /**
     * Get a note by ID
     */
    getNoteById(id: string): Note | null {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) return null
  
        const allAnnotations: Record<string, DocumentAnnotation> = JSON.parse(stored)
        
        for (const documentAnnotations of Object.values(allAnnotations)) {
          const found = documentAnnotations.notes.find(note => note.id === id)
          if (found) {
            // Convert dates for the found note
            return {
              ...found,
              timestamp: new Date(found.timestamp),
              metadata: {
                ...found.metadata,
                lastModified: new Date(found.metadata.lastModified)
              }
            }
          }
        }
  
        return null
      } catch (error) {
        console.error('Error retrieving note:', error)
        return null
      }
    }
  
    /**
     * Get notes for a specific content reference
     */
    getNotesForContentReference(contentReferenceId: string): Note[] {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) return []
  
        const allAnnotations: Record<string, DocumentAnnotation> = JSON.parse(stored)
        
        for (const documentAnnotations of Object.values(allAnnotations)) {
          const found = documentAnnotations.notes.filter(note => note.contentReferenceId === contentReferenceId)
          if (found.length > 0) {
            // Convert dates for the found notes
            return found.map(note => ({
              ...note,
              timestamp: new Date(note.timestamp),
              metadata: {
                ...note.metadata,
                lastModified: new Date(note.metadata.lastModified)
              }
            }))
          }
        }
  
        return []
      } catch (error) {
        console.error('Error retrieving notes for content reference:', error)
        return []
      }
    }
  
    /**
     * Search notes based on query
     */
    searchNotes(query: NoteSearchQuery): NoteSearchResult {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) {
          return {
            notes: [],
            contentReferences: [],
            totalResults: 0,
            pageInfo: { currentPage: 1, totalPages: 1, resultsPerPage: 20 }
          }
        }
  
        const allAnnotations: Record<string, DocumentAnnotation> = JSON.parse(stored)
        const allNotes: Note[] = []
        const allContentReferences: ContentReference[] = []
  
        // Collect all notes and content references
        for (const documentAnnotations of Object.values(allAnnotations)) {
          allNotes.push(...documentAnnotations.notes)
          allContentReferences.push(...documentAnnotations.contentReferences)
        }
  
        // Apply filters
        let filteredNotes = allNotes
  
        if (query.text) {
          const searchText = query.text.toLowerCase()
          filteredNotes = filteredNotes.filter(note => 
            note.content.toLowerCase().includes(searchText)
          )
        }
  
        if (query.tags && query.tags.length > 0) {
          filteredNotes = filteredNotes.filter(note => 
            query.tags!.some(tag => note.metadata.tags.includes(tag))
          )
        }
  
        if (query.dateRange) {
          filteredNotes = filteredNotes.filter(note => 
            note.timestamp >= query.dateRange!.start && note.timestamp <= query.dateRange!.end
          )
        }
  
        if (query.pageNumbers && query.pageNumbers.length > 0) {
          const relevantContentRefs = allContentReferences.filter(ref => 
            query.pageNumbers!.includes(ref.pageNumber)
          )
          const relevantIds = relevantContentRefs.map(ref => ref.id)
          filteredNotes = filteredNotes.filter(note => 
            relevantIds.includes(note.contentReferenceId)
          )
        }
  
        if (query.contentType) {
          const relevantContentRefs = allContentReferences.filter(ref => 
            ref.contentType === query.contentType
          )
          const relevantIds = relevantContentRefs.map(ref => ref.id)
          filteredNotes = filteredNotes.filter(note => 
            relevantIds.includes(note.contentReferenceId)
          )
        }
  
        // Get content references for the filtered notes
        const relevantContentRefIds = new Set(filteredNotes.map(note => note.contentReferenceId))
        const relevantContentRefs = allContentReferences.filter(ref => 
          relevantContentRefIds.has(ref.id)
        )
  
        return {
          notes: filteredNotes,
          contentReferences: relevantContentRefs,
          totalResults: filteredNotes.length,
          pageInfo: { currentPage: 1, totalPages: 1, resultsPerPage: 20 }
        }
      } catch (error) {
        console.error('Error searching notes:', error)
        return {
          notes: [],
          contentReferences: [],
          totalResults: 0,
          pageInfo: { currentPage: 1, totalPages: 1, resultsPerPage: 20 }
        }
      }
    }
  
    /**
     * Get all pages that have notes
     */
    getPagesWithNotes(contentReferences: ContentReference[]): number[] {
      const pageSet = new Set(contentReferences.map(ref => ref.pageNumber))
      return Array.from(pageSet).sort((a, b) => a - b)
    }
  
    /**
     * Clear all annotations for a document
     */
    clearDocumentAnnotations(documentId: string): boolean {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) return true
  
        const allAnnotations: Record<string, DocumentAnnotation> = JSON.parse(stored)
        delete allAnnotations[documentId]
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allAnnotations))
        return true
      } catch (error) {
        console.error('Error clearing document annotations:', error)
        return false
      }
    }
  
    /**
     * Export annotations for a document
     */
    exportDocumentAnnotations(documentId: string): string | null {
      try {
        const annotations = this.getDocumentAnnotations(documentId)
        if (!annotations) return null
  
        return JSON.stringify(annotations, null, 2)
      } catch (error) {
        console.error('Error exporting document annotations:', error)
        return null
      }
    }
  }
  
  // Export a singleton instance
  export const contentReferenceService = new ContentReferenceService()
  