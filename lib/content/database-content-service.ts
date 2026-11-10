import { 
  ContentReference, 
  Note, 
  CreateContentReferenceRequest,
  CreateNoteRequest,
  UpdateNoteRequest
} from '../types/annotations'

/**
 * Database-based service for managing content references and hotspot notes
 * Handles API communication for PDF annotation system
 */

class DatabaseContentService {
  /**
   * Create a new content reference (PDF click annotation)
   */

  async createContentReference(request: CreateContentReferenceRequest): Promise<ContentReference | null> {
    try {
      const response = await fetch('/api/content-references', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error creating content reference:', error)
      return null
    }
  }

  /**
   * Create a new hotspot note (quick text note on PDF content)
   */
  async createNote(request: CreateNoteRequest): Promise<Note | null> {
    try {
      const response = await fetch('/api/hotspot-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error creating note:', error)
      return null
    }
  }

  /**
   * Update an existing hotspot note
   */
  async updateNote(request: UpdateNoteRequest): Promise<Note | null> {
    try {
      const response = await fetch(`/api/hotspot-notes/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating note:', error)
      return null
    }
  }

  /**
   * Delete a hotspot note
   */
  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/hotspot-notes/${noteId}`, {
        method: 'DELETE'
      })

      return response.ok
    } catch (error) {
      console.error('Error deleting note:', error)
      return false
    }
  }

  /**
   * Update a content reference
   */
  async updateContentReference(id: string, updates: Partial<ContentReference>): Promise<ContentReference | null> {
    try {
      const response = await fetch(`/api/content-references/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating content reference:', error)
      return null
    }
  }

  /**
   * Delete a content reference and all its associated notes
   */
  async deleteContentReference(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/content-references/${id}`, {
        method: 'DELETE'
      })

      return response.ok
    } catch (error) {
      console.error('Error deleting content reference:', error)
      return false
    }
  }

  /**
   * Get hotspot notes for a specific content reference
   */
  async getNotesForContentReference(contentReferenceId: string): Promise<Note[]> {
    try {
      const response = await fetch(`/api/hotspot-notes?contentReferenceId=${contentReferenceId}`)

      if (!response.ok) {
        return []
      }

      return await response.json()
    } catch (error) {
      console.error('Error retrieving notes for content reference:', error)
      return []
    }
  }

  /**
   * Get all pages that have notes (utility function)
   */
  getPagesWithNotes(contentReferences: ContentReference[]): number[] {
    const pageSet = new Set(contentReferences.map(ref => ref.pageNumber))
    return Array.from(pageSet).sort((a, b) => a - b)
  }

  // ============================================================================
  // FUTURE IMPLEMENTATIONS - Step by step instructions:
  // ============================================================================

  /**
   * TODO: Implement note search functionality
   * 
   * Steps to implement:
   * 1. Create API endpoint: app/api/hotspot-notes/search/route.ts
   * 2. Add search parameters: text, tags, date range, content reference
   * 3. Use Prisma full-text search or MongoDB text search
   * 4. Return paginated results with NoteSearchResult format
   * 5. Update this method to call the new endpoint
   */
  // async searchNotes(query: any): Promise<any> {
  //   // Implementation needed - see steps above
  //   return { notes: [], totalResults: 0 }
  // }

  /**
   * Clear all annotations for a document
   */
  async clearDocumentAnnotations(documentId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations`, {
        method: 'DELETE'
      });

      return response.ok;
    } catch (error) {
      console.error('Error clearing document annotations:', error);
      return false;
    }
  }

  /**
   * TODO: Implement document annotation export
   * 
   * Steps to implement:
   * 1. Create API endpoint: app/api/documents/[id]/export/route.ts
   * 2. Fetch document with all content references and notes
   * 3. Format as JSON, PDF, or other export format
   * 4. Update this method to call the new endpoint
   */
  // async exportDocumentAnnotations(documentId: string): Promise<string | null> {
  //   // Implementation needed - see steps above
  //   return null
  // }
}

// Export a singleton instance
export const databaseContentService = new DatabaseContentService()

