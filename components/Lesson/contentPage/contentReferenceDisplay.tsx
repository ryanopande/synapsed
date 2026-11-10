"use client"

import { useAnnotation } from "@/lib/content/annotation-context"
import { ContentReference, Note } from "@/lib/types/annotations"
import { formatTimestamp } from "@/lib/utils/annotationUtils"
import { StickyNote, MessageSquare, Image, FileText, Star, Clock } from "lucide-react"

interface ContentReferenceDisplayProps {
  pageNumber: number
  scale: number
  rotation: number
}

export function ContentReferenceDisplay({ pageNumber, scale, rotation }: ContentReferenceDisplayProps) {


  const { currentDocument, setActiveContentReference, activeContentReference } = useAnnotation()

    // Ensure this component only runs on the client side
  if (typeof window === "undefined") {
    return null
  }
  if (!currentDocument) return null

  // Filter content references for the current page
  const pageReferences = currentDocument.contentReferences.filter(
    (ref: ContentReference) => ref.pageNumber === pageNumber
  )

//   // Debug logging
//   console.log('Content references for page', pageNumber, ':', pageReferences)
//   console.log('Current scale:', scale, 'rotation:', rotation)

  // Return null if no content references exist for this page
  if (pageReferences.length === 0) return null

  // Helper function to get the appropriate icon for each content type
  const getContentTypeIcon = (contentType: ContentReference['contentType']) => {
    switch (contentType) {
      case 'text':
        return <FileText className="w-4 h-4" />
      case 'image':
        // eslint-disable-next-line jsx-a11y/alt-text
        return <Image className="w-4 h-4" />
      case 'diagram':
        // eslint-disable-next-line jsx-a11y/alt-text
        return <Image className="w-4 h-4" />
      case 'slide':
        return <StickyNote className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  // Helper function to get color scheme for each content type
  const getContentTypeColor = (contentType: ContentReference['contentType']) => {
    switch (contentType) {
      case 'text':
        return 'bg-blue-500 hover:bg-blue-600'
      case 'image':
        return 'bg-green-500 hover:bg-green-600'
      case 'diagram':
        return 'bg-purple-500 hover:bg-purple-600'
      case 'slide':
        return 'bg-orange-500 hover:bg-orange-600'
      default:
        return 'bg-gray-500 hover:bg-gray-600'
    }
  }

  // Helper function to get human-readable label for content type
  const getContentTypeLabel = (contentType: ContentReference['contentType']) => {
    switch (contentType) {
      case 'text':
        return 'Text'
      case 'image':
        return 'Image'
      case 'diagram':
        return 'Diagram'
      case 'slide':
        return 'Slide'
      default:
        return 'Content'
    }
  }

  // Helper function to determine if notes contain high-priority content
  const getPriorityIndicator = (notes: Note[]) => {
    if (notes.length === 0) return null
    
    // Check if any notes have important tags
    const hasImportantNotes = notes.some(note => 
      note.metadata?.tags?.some((tag: string) => 
        tag.toLowerCase().includes('important') || 
        tag.toLowerCase().includes('critical') ||
        tag.toLowerCase().includes('urgent')
      )
    )
    
    // Return star icon for high-priority notes
    if (hasImportantNotes) {
      return <Star className="w-3 h-3 text-yellow-400 fill-current" />
    }
    
    return null
  }

  return (
    <>
      {/* Render each content reference as an interactive indicator */}
      {pageReferences.map((reference) => {
        // Get associated notes from current document state
        const notes = currentDocument.notes.filter(note => note.contentReferenceId === reference.id)
        const hasNotes = notes.length > 0
        const isActive = activeContentReference?.id === reference.id
        
        return (
          <div
            key={reference.id}
            className="absolute z-10 cursor-pointer group hover:cursor-pointer"
            style={{
              // Position based on stored coordinates scaled to current zoom level
              left: reference.coordinates.x * scale,
              top: reference.coordinates.y * scale,
              // Apply rotation only (scale is handled by position)
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center'
            }}
            onClick={(event) => {
              // Prevent the click from bubbling up to the PDF container
              event.stopPropagation()
              
              // Set this reference as active for editing
              setActiveContentReference(reference)
              
              // Add visual feedback for the click with scale animation
              const element = event.currentTarget as HTMLElement
              element.style.transform = `scale(1.2) rotate(${rotation}deg)`
              setTimeout(() => {
                element.style.transform = `rotate(${rotation}deg)`
              }, 150)
            }}
            title={`Click to view/edit notes for this ${getContentTypeLabel(reference.contentType).toLowerCase()} (${notes.length} note${notes.length !== 1 ? 's' : ''})`}
          >
            {/* Main content reference indicator circle */}
            <div 
              className={`
                relative rounded-full flex items-center justify-center text-white shadow-lg
                ${getContentTypeColor(reference.contentType)}
                transition-all duration-200 hover:scale-110 active:scale-95
                ${hasNotes ? 'ring-2 ring-yellow-400 ring-offset-2' : 'ring-1 ring-white/20'}
                ${isActive ? 'ring-4 ring-blue-300 ring-offset-2' : ''}
                group-hover:shadow-xl group-hover:ring-2 group-hover:ring-white/50
              `}
              style={{
                width: `${32 * scale}px`,
                height: `${32 * scale}px`,
                fontSize: `${14 * scale}px`
              }}
            >
              {getContentTypeIcon(reference.contentType)}
              
              {/* Priority indicator star (top-right corner) */}
              {getPriorityIndicator(notes) && (
                <div 
                  className="absolute"
                  style={{
                    top: `${-4 * scale}px`,
                    right: `${-4 * scale}px`,
                    fontSize: `${12 * scale}px`
                  }}
                >
                  {getPriorityIndicator(notes)}
                </div>
              )}
            </div>
            
            {/* Note count badge (shows when notes exist) */}
            {hasNotes && (
              <div 
                className={`
                  absolute rounded-full font-bold text-white
                  ${notes.length > 3 ? 'bg-red-500' : notes.length > 1 ? 'bg-yellow-500' : 'bg-green-500'}
                  shadow-lg transition-all duration-200 group-hover:scale-110
                `}
                style={{
                  top: `${-8 * scale}px`,
                  right: `${-8 * scale}px`,
                  padding: `${4 * scale}px ${8 * scale}px`,
                  fontSize: `${10 * scale}px`
                }}
              >
                {notes.length > 9 ? '9+' : notes.length}
              </div>
            )}
            
            {/* Detailed hover tooltip with content preview */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 shadow-2xl border border-gray-700">
              {/* Tooltip header with content type and priority */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${getContentTypeColor(reference.contentType).split(' ')[0]}`}></div>
                <div className="font-semibold">{getContentTypeLabel(reference.contentType)}</div>
                {getPriorityIndicator(notes) && (
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                )}
              </div>
              
              {/* Content preview text (truncated if too long) */}
              <div className="text-xs text-gray-300 mb-2 max-w-xs">
                &quot;{reference.contentPreview.length > 60 ? reference.contentPreview.substring(0, 60) + '...' : reference.contentPreview}&quot;
              </div>
              
              {/* Statistics: note count and timestamp */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {notes.length} note{notes.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {(() => {
                    try {
                      return formatTimestamp(reference.timestamp)
                    } catch {
                      return 'Invalid date'
                    }
                  })()}
                </div>
              </div>
              
              {/* Tooltip arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
            
            {/* Connection line that appears on hover */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-px h-2 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        )
      })}
      
      {/* Page summary indicator (shows when multiple references exist) */}
      {pageReferences.length > 1 && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
          {/* Total reference count */}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            {pageReferences.length} content references
          </div>
          {/* Count of references with notes */}
          <div className="text-xs text-gray-500 mt-1">
            {pageReferences.filter(ref => currentDocument.notes.filter(note => note.contentReferenceId === ref.id).length > 0).length} with notes
          </div>
        </div>
      )}
    </>
  )
}
