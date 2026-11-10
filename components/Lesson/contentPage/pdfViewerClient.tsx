"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { useAnnotation } from "@/lib/content/annotation-context"
import { 
  hashContent, 
  extractContentAroundCoordinates,
  calculateOptimalPosition,
  wouldOverlapWithExisting
} from "@/lib/utils/annotationUtils"
import { CreateContentReferenceRequest } from "@/lib/types/annotations"
import { ContentReferenceDisplay } from "./contentReferenceDisplay"

// Ensure this only runs on the client side
if (typeof window !== "undefined") {
  // Use the recommended worker configuration from react-pdf docs
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PDFViewerProps {
  documentUrl: string | null
  documentId?: string | null
}

export function PDFViewerClient({ documentUrl, documentId }: PDFViewerProps) {

  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [pageText, setPageText] = useState<string>("")
  
  // Annotation context
  const { 
    createContentReference, 
    currentDocument, 
    loadDocumentAnnotations 
  } = useAnnotation()
  
  // Refs for PDF interaction
  const pageRef = useRef<HTMLDivElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)

  // Load annotations when document changes
  useEffect(() => {
    if (documentId) {
      loadDocumentAnnotations(documentId)
    }
  }, [documentId, loadDocumentAnnotations])

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    //console.log(" PDF loaded successfully with", numPages, "pages")
    setNumPages(numPages)
    setPageNumber(1)
    setLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    //console.log(" PDF load error:", error)
    setError("Failed to load PDF document")
    setLoading(false)
    console.error("PDF load error:", error)
  }, [])

  const changePage = useCallback(
    (offset: number) => {
      setPageNumber((prevPageNumber) => {
        const newPageNumber = prevPageNumber + offset
        return Math.min(Math.max(newPageNumber, 1), numPages)
      })
    },
    [numPages],
  )

  const changeScale = useCallback(
    (delta: number) => {
      setScale((prevScale) => Math.min(Math.max(prevScale + delta, 0.5), 1.2))
    },
    [],
  )

  const handleDownload = useCallback(() => {
    if (documentUrl) {
      const link = document.createElement("a")
      link.href = documentUrl
      link.download = "document.pdf"
      link.click()
    }
  }, [documentUrl])

  // Handle page text extraction and dimension logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPageLoadSuccess = useCallback((page: any) => {
    // Log page dimensions for debugging
    // //console.log('Page loaded successfully:', {
    //   pageNumber,
    //   pageWidth: page.width,
    //   pageHeight: page.height,
    //   scale,
    //   rotation,
    //   orientation: page.width > page.height ? 'landscape' : 'portrait'
    // })
    // find a way to fix the any for later. 
    // Extract text content from the page for content detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.getTextContent().then((textContent: any) => {
      const text = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => item.str) // Filter out items without str property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join(' ')
      setPageText(text)
    }).catch((error: unknown) => {
      console.warn('Could not extract text from page:', error)
      setPageText('')
    })
  }, [])

      // Handle clicks on PDF content
    const handlePageClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      // Check if the click was on a content reference badge (they have z-10 class)
      const target = event.target as HTMLElement
      if (target.closest('.z-10')) {
        // Click was on a badge, don't create a new reference
        return
      }
      
      if (!documentUrl || !pageRef.current || !pdfContainerRef.current) return

    const rect = pageRef.current.getBoundingClientRect()
    const containerRect = pdfContainerRef.current.getBoundingClientRect()
    
    // Calculate click coordinates relative to the page (this is what we want to store)
    const pageX = event.clientX - rect.left
    const pageY = event.clientY - rect.top
    
    // Calculate coordinates relative to the container for positioning
    const containerX = event.clientX - containerRect.left
    const containerY = event.clientY - containerRect.top
    
    // Determine content type based on click location and context
    let contentType: 'text' | 'image' | 'diagram' | 'slide' = 'text'
    
    // Simple heuristic: if there's text around the click, it's likely text content
    const surroundingText = extractContentAroundCoordinates(
      { x: pageX, y: pageY, width: 100, height: 50 },
      pageText,
      150
    )
    
    if (surroundingText.trim().length < 20) {
      // If there's little text, it might be an image or diagram
      contentType = 'image'
    }
    
    // Create a content reference
    const documentName = documentUrl?.split('/').pop() || 'Document'
    
    // Extract content around the clicked area
    const contentPreview = extractContentAroundCoordinates(
      { x: pageX, y: pageY, width: 100, height: 50 },
      pageText,
      150
    )
    
    // Hash the content for identification
    const contentHash = hashContent(contentPreview)
    
    // Get existing references for this page to check for overlaps
    const existingReferences = currentDocument?.contentReferences.filter(ref => ref.pageNumber === pageNumber) || []
    
    // Calculate optimal coordinates to avoid overlapping
    const optimalCoordinates = calculateOptimalPosition(
      { x: pageX, y: pageY, width: 100, height: 50 },
      existingReferences,
      rect.width, // Use actual page width
      rect.height // Use actual page height
    )
    
    // Check if there would be overlap
    const hasOverlap = wouldOverlapWithExisting(optimalCoordinates, existingReferences)
    
    // Create content reference request
    const request: CreateContentReferenceRequest = {
      pageNumber,
      contentType,
      contentHash,
      coordinates: optimalCoordinates,
      contentPreview,
      documentId: documentId!,
      documentName
    }
    
    // // Debug logging
    // console.log('Click coordinates:', { pageX, pageY, containerX, containerY })
    // console.log('Page dimensions:', { width: rect.width, height: rect.height })
    // console.log('Optimal coordinates:', optimalCoordinates)
    // console.log('Has overlap:', hasOverlap)
    
    // Create the content reference
    const contentReference = createContentReference(request)
    
    if (contentReference) {
      console.log('Content reference created:', contentReference)
      
      // Show visual feedback at the actual click location
      const feedbackElement = document.createElement('div')
      feedbackElement.className = 'absolute pointer-events-none z-50'
      feedbackElement.style.left = `${containerX}px`
      feedbackElement.style.top = `${containerY}px`
      
      const feedbackClass = hasOverlap ? 'bg-yellow-500' : 'bg-green-500'
      const feedbackText = hasOverlap ? '⚠ Position adjusted' : '✓ Reference created'
      
      feedbackElement.innerHTML = `
        <div class="${feedbackClass} text-white px-2 py-1 rounded text-xs font-medium animate-pulse">
          ${feedbackText}
        </div>
      `
      pdfContainerRef.current.appendChild(feedbackElement)
      
      // Remove feedback after animation
      setTimeout(() => {
        if (feedbackElement.parentNode) {
          feedbackElement.parentNode.removeChild(feedbackElement)
        }
      }, 2000)
      
      // The annotation context will automatically update the UI
    } else {
      console.error('Failed to create content reference')
    }
  }, [documentUrl, pageNumber, pageText, createContentReference, currentDocument, documentId])

  if (!documentUrl) {
    return (
      <div className="pdf-viewer-container h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Document Selected</h3>
          <p className="text-muted-foreground">Select a document from the sidebar to start annotating</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pdf-viewer-container h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm font-medium px-3 py-1 bg-muted rounded-md">
            {pageNumber} of {numPages}
          </span>

          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeScale(-0.1)}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-sm font-medium px-3 py-1 bg-muted rounded-md min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => changeScale(0.1)}
            disabled={scale >= 1.2}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-2" />

          <button
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        <div className="flex justify-center items-start min-h-full w-full">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Error Loading PDF</h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {documentUrl && !loading && !error && (
            <div 
              ref={pdfContainerRef}
              className="pdf-container shadow-lg relative cursor-crosshair"
              onClick={handlePageClick}
            >
              <Document
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                }
              >
                <div ref={pageRef}>
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    rotate={rotation}
                    className="border border-border rounded-lg bg-white"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={onPageLoadSuccess}
                    width={undefined}
                    height={undefined}
                    loading={
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    }
                  />
                </div>
              </Document>
              
              {/* Content reference display */}
              <ContentReferenceDisplay 
                pageNumber={pageNumber}
                scale={scale}
                rotation={rotation}
              />
              
              {/* Click instruction overlay */}
              <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground px-3 py-1 rounded-md text-sm font-medium pointer-events-none">
                Click anywhere to create a note reference
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
