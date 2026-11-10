"use client"

import type React from "react"

import { useState, useRef } from "react"
import useSWR from "swr" 
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  FolderIcon,
  MoreVertical,
  Trash2,
  Download,
  Share,
} from "lucide-react"

interface DocumentItem {
  id: string
  name: string
  type: "pdf" | "pptx"
  url: string
  lastModified: Date
  size: string
  folder?: string
}

interface DatabaseDocument {
  id: string
  name: string
  type: string
  url: string
  lastModified: string
  size: string
  folder?: string
}

interface DocumentSidebarProps {
  isOpen: boolean
  onToggle: () => void
  selectedDocument: string | null
  onDocumentSelect: (documentId: string | null) => void
}
export function DocumentSidebar({ isOpen, onToggle, selectedDocument, onDocumentSelect }: DocumentSidebarProps) {
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState("")
  
  // State for folder selection
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  
  // State for document context menu visibility
  const [showDocumentMenu, setShowDocumentMenu] = useState<string | null>(null)
  
  // Reference for hidden file input element
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Static folder data - could be moved to props or context in the future
  const [folders] = useState([
    { id: "recent", name: "Recent", documentCount: 3 },
    { id: "research", name: "Research Papers", documentCount: 2 },
    { id: "presentations", name: "Presentations", documentCount: 1 },
  ])

  // Fetcher for documents
  const documentsFetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to load documents')
    }
    const documents = await response.json()
    // Convert database documents to DocumentItem format
    return documents.map((doc: DatabaseDocument) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type.toLowerCase(),
      url: doc.url,
      lastModified: new Date(doc.lastModified),
      size: doc.size,
      folder: doc.folder || 'recent',
    })) as DocumentItem[]
  }

  // Use SWR for documents (cached and fast)
  const { data: documents = [], mutate } = useSWR<DocumentItem[]>(
    '/api/documents',
    documentsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true, // Revalidate on reconnect to get latest documents
      dedupingInterval: 5000,
    }
  )

  // No need to save to localStorage anymore - data is persisted in database

  // Handle file upload from user's device
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file")
      return
    }

    try {
      // Create FormData to send the actual file
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'recent')

      // Create new document in database
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const newDocument = await response.json()
        
        // Convert to DocumentItem format and add to list
        const documentItem: DocumentItem = {
          id: newDocument.id,
          name: newDocument.name,
          type: newDocument.type.toLowerCase(),
          url: newDocument.url,
          lastModified: new Date(newDocument.lastModified),
          size: newDocument.size,
          folder: newDocument.folder || 'recent',
        }

        // Update SWR cache with new document
        await mutate([documentItem, ...documents], false)
      } else {
        alert('Failed to upload document')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Error uploading document')
    }

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Trigger file input click
  const handleAddDocument = () => {
    fileInputRef.current?.click()
  }

  // Filter documents based on search query and selected folder
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFolder = !selectedFolder || selectedFolder === "recent" || doc.folder === selectedFolder
    return matchesSearch && matchesFolder
  })

  // Handle document context menu actions
  const handleDocumentAction = (action: string, documentId: string) => {
    setShowDocumentMenu(null)
    switch (action) {
      case "delete":
        console.log("Delete document:", documentId)
        break
      case "download":
        console.log("Download document:", documentId)
        break
      case "share":
        console.log("Share document:", documentId)
        break
    }
  }

  return (
    <>
      {/* Main Sidebar Container */}
      <div
        className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out ${
          isOpen ? "w-80" : "w-0"
        } overflow-hidden`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header with Title and Close Button */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-sidebar-foreground">Documents</h2>
              <button
                onClick={onToggle}
                className="p-1 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sidebar-foreground opacity-50" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-sidebar-primary border border-sidebar-border rounded-lg text-sidebar-primary-foreground placeholder:text-sidebar-foreground placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
              />
            </div>
          </div>

          {/* Folders Section */}
          <div className="p-4 border-b border-sidebar-border">
            <h3 className="text-sm font-medium text-sidebar-foreground mb-3 opacity-70">FOLDERS</h3>
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                    selectedFolder === folder.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderIcon className="w-4 h-4" />
                    <span className="text-sm">{folder.name}</span>
                  </div>
                  <span className="text-xs opacity-60">{folder.documentCount}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Add Document Button Section */}
          <div className="p-4 border-b border-sidebar-border">
            {/* Hidden file input for PDF uploads */}
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            <button
              onClick={handleAddDocument}
              className="w-full flex items-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Document
            </button>
          </div>

          {/* Documents List Section */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {filteredDocuments.length === 0 ? (
                // Empty state when no documents match filters
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-sidebar-foreground opacity-30 mb-3" />
                  <p className="text-sidebar-foreground opacity-60">
                    {searchQuery ? "No documents found" : "No documents yet"}
                  </p>
                </div>
              ) : (
                // Render filtered documents
                filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`relative group rounded-lg transition-colors ${
                      selectedDocument === doc.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                    }`}
                  >
                    {/* Document Item Button */}
                    <button onClick={() => onDocumentSelect(doc.id)} className="w-full text-left p-3 rounded-lg">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs opacity-70">{doc.lastModified.toLocaleDateString()}</p>
                            <span className="text-xs opacity-50">•</span>
                            <p className="text-xs opacity-70">{doc.size}</p>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Document Actions Menu (appears on hover) */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDocumentMenu(showDocumentMenu === doc.id ? null : doc.id)
                        }}
                        className="p-1 rounded hover:bg-sidebar-border transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Context Menu Dropdown */}
                      {showDocumentMenu === doc.id && (
                        <div className="absolute right-0 top-8 bg-popover border border-border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                          <button
                            onClick={() => handleDocumentAction("download", doc.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                          <button
                            onClick={() => handleDocumentAction("share", doc.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <Share className="w-4 h-4" />
                            Share
                          </button>
                          <button
                            onClick={() => handleDocumentAction("delete", doc.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button (visible when sidebar is closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-4 top-4 z-10 p-2 bg-sidebar rounded-lg border border-sidebar-border shadow-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Backdrop to close context menu when clicking outside */}
      {showDocumentMenu && <div className="fixed inset-0 z-5" onClick={() => setShowDocumentMenu(null)} />}
    </>
  )
}
