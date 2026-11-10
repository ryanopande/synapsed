import { ContentReference, Note, ValidationResult, Coordinates } from '../types/annotations'

/**
 * Utility functions for the annotation system
 */

/**
 * Generate a unique ID for annotations
 */
export function generateId(): string {
  return `anno_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Simple hash function for content identification
 * In production, consider using a more robust hashing algorithm
 */
export function hashContent(content: string): string {
  let hash = 0
  if (content.length === 0) return hash.toString()
  
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36)
}

/**
 * Extract text content around clicked coordinates
 * This is a simplified version - in production,we want more sophisticated text extraction
 */
export function extractContentAroundCoordinates(
  coordinates: Coordinates,
  pageText: string,
  maxLength: number = 100
): string {
  // This is a placeholder implementation
  // In reality, we need to:
  // 1. Get the actual text content from the PDF at those coordinates
  // 2. Extract surrounding context
  // 3. Handle different content types (text, images, etc.)
  
  // For now, return a sample text based on coordinates
  const startIndex = Math.floor(coordinates.y / 100) * 50
  const endIndex = Math.min(startIndex + maxLength, pageText.length)
  
  return pageText.substring(startIndex, endIndex).trim() || 'Content reference'
}

/**
 * Validate content reference data
 */
export function validateContentReference(reference: Partial<ContentReference>): ValidationResult {
  const errors: string[] = []
  
  if (!reference.pageNumber || reference.pageNumber < 1) {
    errors.push('Page number must be a positive integer')
  }
  
  if (!reference.contentType) {
    errors.push('Content type is required')
  }
  
  if (!reference.coordinates) {
    errors.push('Coordinates are required')
  } else {
    const coords = reference.coordinates
    if (coords.x < 0 || coords.y < 0 || coords.width <= 0 || coords.height <= 0) {
      errors.push('Invalid coordinates: all values must be positive')
    }
  }
  
  if (!reference.contentHash) {
    errors.push('Content hash is required')
  }
  
  // Note: documentId is handled in the service layer, not in basic validation
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate note data
 */
export function validateNote(note: Partial<Note>): ValidationResult {
  const errors: string[] = []
  
  if (!note.contentReferenceId) {
    errors.push('Content reference ID is required')
  }
  
  if (!note.content || note.content.trim().length === 0) {
    errors.push('Note content cannot be empty')
  }
  
  if (note.content && note.content.length > 10000) {
    errors.push('Note content is too long (max 10,000 characters)')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Calculate distance between two coordinate sets
 * Useful for finding nearby content references
 */
export function calculateCoordinateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const dx = coord1.x - coord2.x
  const dy = coord1.y - coord2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Check if coordinates overlap
 */
export function doCoordinatesOverlap(coord1: Coordinates, coord2: Coordinates): boolean {
  return !(
    coord1.x + coord1.width < coord2.x ||
    coord2.x + coord2.width < coord1.x ||
    coord1.y + coord1.height < coord2.y ||
    coord2.y + coord2.height < coord1.y
  )
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: Date | string): string {
  try {
    // Handle both Date objects and date strings
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch (error) {
    console.warn('Error formatting timestamp:', error, timestamp)
    return 'Invalid date'
  }
}

/**
 * Get page numbers that have notes
 */
export function getPagesWithNotes(contentReferences: ContentReference[]): number[] {
  const pageSet = new Set(contentReferences.map(ref => ref.pageNumber))
  return Array.from(pageSet).sort((a, b) => a - b)
}

/**
 * Filter content references by page
 */
export function filterContentReferencesByPage(
  references: ContentReference[],
  pageNumber: number
): ContentReference[] {
  return references.filter(ref => ref.pageNumber === pageNumber)
}

/**
 * Get notes for a specific content reference
 */
export function getNotesForContentReference(
  notes: Note[],
  contentReferenceId: string
): Note[] {
  return notes.filter(note => note.contentReferenceId === contentReferenceId)
}

/**
 * Check if a new content reference would overlap with existing ones
 */
export function wouldOverlapWithExisting(
  newCoordinates: Coordinates,
  existingReferences: ContentReference[],
  threshold: number = 50
): boolean {
  return existingReferences.some(existing => {
    const distance = calculateCoordinateDistance(newCoordinates, existing.coordinates)
    return distance < threshold
  })
}

/**
 * Suggest better coordinates to avoid overlapping
 */
export function suggestNonOverlappingCoordinates(
  originalCoordinates: Coordinates,
  existingReferences: ContentReference[],
  pageWidth: number = 800,
  pageHeight: number = 600
): Coordinates {
  let suggested = { ...originalCoordinates }
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    if (!wouldOverlapWithExisting(suggested, existingReferences, 60)) {
      return suggested
    }
    
    // Try different positions
    const offset = (attempts + 1) * 20
    suggested = {
      x: Math.max(0, Math.min(pageWidth - suggested.width, originalCoordinates.x + offset)),
      y: Math.max(0, Math.min(pageHeight - suggested.height, originalCoordinates.y + offset)),
      width: originalCoordinates.width,
      height: originalCoordinates.height
    }
    
    attempts++
  }
  
  // If we can't find a non-overlapping position, return the original
  return originalCoordinates
}

/**
 * Get content references grouped by proximity
 */
export function groupContentReferencesByProximity(
  references: ContentReference[],
  proximityThreshold: number = 100
): ContentReference[][] {
  const groups: ContentReference[][] = []
  const visited = new Set<string>()
  
  references.forEach(reference => {
    if (visited.has(reference.id)) return
    
    const group = [reference]
    visited.add(reference.id)
    
    references.forEach(otherRef => {
      if (visited.has(otherRef.id)) return
      
      const distance = calculateCoordinateDistance(reference.coordinates, otherRef.coordinates)
      if (distance <= proximityThreshold) {
        group.push(otherRef)
        visited.add(otherRef.id)
      }
    })
    
    if (group.length > 1) {
      groups.push(group)
    }
  })
  
  return groups
}

/**
 * Calculate the optimal position for a new content reference
 */
export function calculateOptimalPosition(
  clickCoordinates: Coordinates,
  existingReferences: ContentReference[],
  pageWidth: number = 800,
  pageHeight: number = 600
): Coordinates {
  // Start with the click coordinates
  let optimal = { ...clickCoordinates }
  
  // Simple overlap detection - just offset by a small amount if there's overlap
  let attempts = 0
  const maxAttempts = 5
  
  while (attempts < maxAttempts) {
    if (!wouldOverlapWithExisting(optimal, existingReferences, 80)) {
      break
    }
    
    // Simple offset strategy - move diagonally
    const offset = (attempts + 1) * 30
    optimal = {
      x: Math.max(0, Math.min(pageWidth - optimal.width, clickCoordinates.x + offset)),
      y: Math.max(0, Math.min(pageHeight - optimal.height, clickCoordinates.y + offset)),
      width: clickCoordinates.width,
      height: clickCoordinates.height
    }
    
    attempts++
  }
  
  // Ensure the reference is within page bounds
  optimal.x = Math.max(0, Math.min(pageWidth - optimal.width, optimal.x))
  optimal.y = Math.max(0, Math.min(pageHeight - optimal.height, optimal.y))
  
  return optimal
}
