"use client"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { DocumentSidebar } from "@/components/Lesson/contentPage/documentSideBar"
import { ResizablePane } from "@/components/Lesson/contentPage/resizblePanel"
import { Sidebar, SidebarClose as SidebarColumns, Moon, Sun } from "lucide-react"
import { AnnotationProvider, useAnnotation } from "@/lib/content/annotation-context"

// Dynamic imports to prevent SSR issues
const PDFViewer = dynamic(
  () => import("@/components/Lesson/contentPage/pdfViewer").then((mod) => ({ default: mod.PDFViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full p-4 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded mb-3" />
        <div className="h-[60vh] w-full bg-slate-100 rounded-xl" />
      </div>
    ),
  }
)

const NotesPanelClient = dynamic(
  () => import("@/components/Lesson/contentPage/notesPanelClient").then((mod) => ({ default: mod.NotesPanelClient })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full p-4 animate-pulse">
        <div className="h-8 w-32 bg-slate-200 rounded mb-3" />
        <div className="h-[60vh] w-full bg-slate-100 rounded-xl" />
      </div>
    ),
  }
)

interface ContentPageProps {
  classId?: string;
  nodeId?: string;
  nodeTitle?: string;
}

function ContentPageInner({ classId, nodeId, nodeTitle }: ContentPageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string | null>(null)
  const [paneWidth, setPaneWidth] = useState(50) // Percentage
  const [layoutMode, setLayoutMode] = useState<"sidebar" | "overlay">("sidebar")
  const [darkMode, setDarkMode] = useState(false)
  
  const { loadDocumentAnnotations } = useAnnotation()

  const toggleDarkMode = useCallback(() => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle("dark")
  }, [darkMode])

  // Load document annotations and URL when a document is selected
  useEffect(() => {
    if (selectedDocument) {
      // selectedDocument is now the database ID, not a URL
      loadDocumentAnnotations(selectedDocument)
      
      // Use the proxy endpoint for PDF viewing to avoid CORS issues
      setSelectedDocumentUrl(`/api/documents/${selectedDocument}/pdf`)
    } else {
      setSelectedDocumentUrl(null)
    }
  }, [selectedDocument, loadDocumentAnnotations])

  return (
    <div className="h-screen flex bg-background">
      {/* Document Sidebar */}
      <DocumentSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        selectedDocument={selectedDocument}
        onDocumentSelect={setSelectedDocument}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between p-3 border-b border-border bg-card/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-105 active:scale-95"
                title="Show document sidebar"
              >
                <Sidebar className="w-4 h-4" />
              </button>
            )}
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-foreground tracking-tight">Content Page</h1>
              <p className="text-xs text-muted-foreground">Select, annotate, and organize your documents</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-105 active:scale-95"
              title={`Switch to ${darkMode ? "light" : "dark"} mode`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setLayoutMode(layoutMode === "sidebar" ? "overlay" : "sidebar")}
              className={`
                p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95
                ${
                  layoutMode === "sidebar"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "hover:bg-accent hover:text-accent-foreground"
                }
              `}
              title={`Switch to ${layoutMode === "sidebar" ? "overlay" : "sidebar"} mode`}
            >
              <SidebarColumns className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Panes */}
        <div className="flex-1">
          <ResizablePane
            leftPane={
              <div className="h-full p-4">
                <PDFViewer documentUrl={selectedDocumentUrl} documentId={selectedDocument} />
              </div>
            }
              rightPane={
              <div className="h-full p-4">
                <NotesPanelClient 
                  documentId={selectedDocument}
                  classId={classId}
                  nodeId={nodeId}
                  nodeTitle={nodeTitle}
                />
              </div>
            }
            initialWidth={paneWidth}
            onWidthChange={setPaneWidth}
            minWidth={25}
            maxWidth={75}
          />
        </div>
      </div>
    </div>
  )
}

export default function PDFAnnotationApp(props: ContentPageProps) {
  return (
    <AnnotationProvider>
      <ContentPageInner {...props} />
    </AnnotationProvider>
  )
}
