"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, ArrowUp, Settings2, Mic, Info, ClipboardCheck } from 'lucide-react'
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { getSocraticIntroductionPrompt, isSystemIntroductionMessage } from "@/lib/agent/prompts"
import { InChatAssessmentForm } from "./InChatAssessmentForm"
import { z } from "zod"
import type { FieldConfig } from "@/lib/formedible/types"
import type { DiagramData } from "./ExcalidrawCanvas"
import VoiceMode from "./VoiceMode"

const ExcalidrawCanvas = dynamic(() => import("./ExcalidrawCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
      Loading visual...
    </div>
  ),
})

// Custom styles for math rendering
const mathStyles = `
  .katex {
    font-size: 1.1em;
  }
  .katex-display {
    margin: 1em 0;
    text-align: center;
  }
  .katex .base {
    margin: 0.1em 0;
  }
`
interface SourceMetadata {
  title: string
  page?: number | string
  materialId?: string
  classId?: string
}

interface InChatAssessmentData {
  type: "inChatAssessment"
  topic: string
  nodeTitle?: string
  difficulty: "beginner" | "intermediate" | "advanced"
  fields: Array<FieldConfig & {
    name: string
    type: "text" | "textarea" | "select" | "radio" | "multiselect" | "number" | "checkbox"
    label: string
    placeholder?: string
    options?: Array<{ value: string; label: string }>
    textareaConfig?: { rows: number }
    numberConfig?: { min?: number; max?: number; step?: number }
    multiSelectConfig?: { maxSelections: number; searchable?: boolean }
  }>
  schema: Record<string, { type: string; required?: boolean; min?: number; message?: string }>
  zodSchema?: z.ZodObject<Record<string, z.ZodTypeAny>>
  correctAnswers: Record<string, string | number | boolean | string[]>
}

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  sources?: SourceMetadata[]
  inChatAssessmentData?: InChatAssessmentData
  diagramData?: DiagramData | null
  source?: "voice"
}

interface ChatSectionProps {
  onAddToNotes?: (content: string) => void
  classId?: string
  lessonId?: string
  userId?: string
  nodeTitle?: string
}

type InputMode = "chat" | "visual"


// Removed suggested prompts since we're going straight to chat

// Helper function to clean AI responses
const cleanAIResponse = (content: string): string => {
  return content
    .replace(/^FINAL ANSWER\s*:?/i, "")
    .replace(/^ANSWER\s*:?/i, "")
    .replace(/^RESPONSE\s*:?/i, "")
    // Remove source citations (they're shown in tooltip instead)
    .replace(/\s*Source:\s*[^\n]+(?:\(Page\s+\d+\))?/gi, "")
    .replace(/\s*\[Source:[^\]]+\]/gi, "")
    .trim()
}

// Helper function to convert common math patterns to LaTeX
const convertMathToLatex = (content: string): string => {
  return content
    // Convert x^2 patterns to LaTeX
    .replace(/(\w+)\^(\d+)/g, '$$1^{$2}$')
    // Convert fractions like 1/2 to LaTeX
    .replace(/(\d+)\/(\d+)/g, '$\\frac{$1}{$2}$')
    // Convert sqrt patterns
    .replace(/sqrt\(([^)]+)\)/g, '$\\sqrt{$1}$')
    // Convert integral patterns
    .replace(/∫/g, '$\\int$')
    // Convert sum patterns
    .replace(/∑/g, '$\\sum$')
    // Convert pi
    .replace(/π/g, '$\\pi$')
    // Convert infinity
    .replace(/∞/g, '$\\infty$')
}

export default function ChatPage({ onAddToNotes, classId, lessonId, userId: propUserId, nodeTitle: propNodeTitle }: ChatSectionProps = {}) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const userId = propUserId || (session?.user as { id?: string })?.id
  const studentName = (session?.user as { name?: string })?.name || "there"
  const nodeTitle = propNodeTitle || searchParams.get('nodeTitle') || ''

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [inputMode, setInputMode] = useState<InputMode>("chat")
  const [isTyping, setIsTyping] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [hasTriggeredIntroduction, setHasTriggeredIntroduction] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceVisible, setVoiceVisible] = useState(false)
  const [isPreparingVoice, setIsPreparingVoice] = useState(false)
  const [expandedDiagram, setExpandedDiagram] = useState<DiagramData | null>(null)

  // Fetcher function for SWR
  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to load conversation')
    }
    return response.json()
  }

  // Use SWR for fast, cached conversation loading
  const conversationKey = userId && classId && lessonId
    ? `/api/conversations/by-lesson?userId=${userId}&classId=${classId}&lessonId=${lessonId}`
    : null

  const { data, error, isLoading: isLoadingConversation } = useSWR(
    conversationKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
    }
  )

  // Log errors (but continue gracefully)
  useEffect(() => {
    if (error) {
      console.error('Error loading conversation:', error)
    }
  }, [error])

  // Determine if we have an existing conversation
  const hasExistingConversation = data?.conversation !== null && data?.conversation !== undefined
  // Removed isChatMode since we're always in chat mode
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<Message[]>([])
  const contextBootstrapPromiseRef = useRef<Promise<void> | null>(null)

  // Keep ref in sync with messages state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Load conversation data when SWR fetches it
  useEffect(() => {
    if (data) {
      if (data.conversation) {
        // Set threadId for agent memory continuity
        setThreadId(data.conversation.threadId)

        // Load messages into state, filtering out system introduction messages
        const loadedMessages: Message[] = data.conversation.messages
          .map((msg: {
            id: string
            content: string
            role: 'USER' | 'ASSISTANT'
            timestamp: string
            sources?: SourceMetadata[]
          }) => ({
            id: msg.id,
            content: msg.role === 'USER'
              ? msg.content.replace(/\n\n\[Mode: VISUAL_WHITEBOARD\][\s\S]*$/, '').trim()
              : msg.content,
            role: msg.role.toLowerCase() as 'user' | 'assistant',
            timestamp: new Date(msg.timestamp),
            sources: msg.sources && Array.isArray(msg.sources) ? msg.sources : undefined,
          }))
          .filter((msg: Message) => {
            if (msg.role === 'user' && isSystemIntroductionMessage(msg.content)) {
              return false
            }
            return true
          })

        setMessages(loadedMessages)
      } else {
        // No conversation found - clear messages
        setMessages([])
        setThreadId(null)
      }
    }
  }, [data])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }

  useEffect(() => {
    // Only scroll to bottom when new messages are added
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 100) // Small delay to ensure DOM is updated
      return () => clearTimeout(timer)
    }
  }, [messages.length])

  // Autofocus input on load
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Removed timestamp update interval to prevent unnecessary re-renders

  // Removed startChat function since we're going straight to chat

  // Helper function to send a system message that won't be displayed in UI
  // Used for auto-introductions to make it look like the AI initiated the conversation
  const sendSystemMessage = useCallback(async (messageContent: string) => {
    if (isTyping) return

    setIsTyping(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    try {
      // Prepare messages array with the system message (but don't add to UI)
      const currentMessages = messagesRef.current
      const systemUserMessage = {
        role: "user" as const,
        content: messageContent
      }

      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...currentMessages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            systemUserMessage
          ],
          threadId, // Use existing threadId if available
          classId,
          lessonId,
          userId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Update threadId if returned from API (for new conversations)
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId)
      }

      // Only add the assistant response to the UI (system message stays hidden)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: convertMathToLatex(cleanAIResponse(data.response)),
        role: "assistant",
        timestamp: new Date(),
        sources: data.sources || undefined,
        inChatAssessmentData: data.inChatAssessmentData || undefined,
        diagramData: data.diagramData || undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }, [threadId, classId, lessonId, userId, isTyping])

  // Helper function to send a message (used for user-initiated messages)
  const sendMessage = useCallback(async (messageContent: string) => {
    if (isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      role: "user",
      timestamp: new Date(),
    }

    const effectiveMessageContent =
      inputMode === "visual"
        ? `${messageContent}

[Mode: VISUAL_WHITEBOARD]
The student explicitly requested visual mode. You MUST call the createVisualLesson tool for this response and teach through the diagram. Keep chat text short and let the visual carry the explanation.`
        : messageContent

    // Add user message to state optimistically
    const updatedMessages = [...messagesRef.current, userMessage]
    setMessages(updatedMessages)
    setIsTyping(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.id === userMessage.id ? effectiveMessageContent : msg.content
          })),
          displayMessage: messageContent,
          threadId, // Use existing threadId if available
          classId,
          lessonId,
          userId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Update threadId if returned from API (for new conversations)
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: convertMathToLatex(cleanAIResponse(data.response)),
        role: "assistant",
        timestamp: new Date(),
        sources: data.sources || undefined,
        inChatAssessmentData: data.inChatAssessmentData || undefined,
        diagramData: data.diagramData || undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }, [threadId, classId, lessonId, userId, isTyping, inputMode])

  const ensureInitialLessonContext = useCallback(async () => {
    if (isLoadingConversation) return
    if (hasExistingConversation) return
    if (messagesRef.current.length > 0) return
    if (!(nodeTitle && userId && classId && lessonId)) return

    if (contextBootstrapPromiseRef.current) {
      await contextBootstrapPromiseRef.current
      return
    }

    if (hasTriggeredIntroduction) return

    setHasTriggeredIntroduction(true)
    const introPrompt = getSocraticIntroductionPrompt(nodeTitle, studentName, classId)

    contextBootstrapPromiseRef.current = (async () => {
      try {
        await sendSystemMessage(introPrompt)
      } finally {
        contextBootstrapPromiseRef.current = null
      }
    })()

    await contextBootstrapPromiseRef.current
  }, [
    isLoadingConversation,
    hasExistingConversation,
    nodeTitle,
    userId,
    classId,
    lessonId,
    hasTriggeredIntroduction,
    studentName,
    sendSystemMessage,
  ])

  // Auto-trigger Socratic introduction when it's truly the first time (no conversation in DB)
  useEffect(() => {
    void ensureInitialLessonContext()
  }, [ensureInitialLessonContext])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return

    const messageContent = input.trim()
    if (!messageContent) return

    setInput("")
    await sendMessage(messageContent)
  }

  // Removed handleSuggestedPrompt since we're going straight to chat

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea up to 5 lines
    const textarea = e.target
    textarea.style.height = "auto"
    const scrollHeight = textarea.scrollHeight
    const lineHeight = 22
    const maxHeight = 5 * lineHeight + 24 // 5 lines + padding
    textarea.style.height = Math.min(scrollHeight, maxHeight) + "px"
  }

  const openVoice = async () => {
    if (isPreparingVoice) return
    setIsPreparingVoice(true)
    try {
      await ensureInitialLessonContext()
      setVoiceMode(true)
      setTimeout(() => setVoiceVisible(true), 16)
    } finally {
      setIsPreparingVoice(false)
    }
  }

  const handleVoiceClose = () => {
    setVoiceVisible(false)
    setTimeout(() => {
      setVoiceMode(false)
    }, 250)
  }

  const handleVoiceTurn = (payload: {
    userText: string
    assistantText: string
    diagramData?: DiagramData | null
    threadId?: string
  }) => {
    if (payload.threadId && payload.threadId !== threadId) {
      setThreadId(payload.threadId)
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-voice-user`,
        content: payload.userText,
        role: "user",
        timestamp: new Date(),
        source: "voice",
      },
      {
        id: `${Date.now()}-voice-assistant`,
        content: convertMathToLatex(cleanAIResponse(payload.assistantText)),
        role: "assistant",
        timestamp: new Date(),
        source: "voice",
        diagramData: payload.diagramData ?? undefined,
      },
    ])
  }

  const handleManualAssessment = useCallback(async () => {
    if (isTyping || !nodeTitle) return

    setIsTyping(true)
    try {
      const response = await fetch('/api/in-chat-assessment/manual-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: nodeTitle,
          nodeTitle,
          classId,
          lessonId,
          userId,
          threadId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to trigger assessment')
      }

      const data = await response.json()

      if (data.inChatAssessmentData) {
        const assessmentMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message || 'Here\'s an in-chat assessment to test your understanding:',
          role: 'assistant',
          timestamp: new Date(),
          inChatAssessmentData: data.inChatAssessmentData,
        }
        setMessages((prev) => [...prev, assessmentMessage])
      }
    } catch (error) {
      console.error('Error triggering assessment:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I couldn\'t create an assessment. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }, [nodeTitle, classId, lessonId, userId, threadId, isTyping])

  return (<div className="h-full bg-white flex flex-col font-system overflow-hidden">
    <style dangerouslySetInnerHTML={{ __html: mathStyles }} />
    {voiceMode && (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col"
        style={{
          opacity: voiceVisible ? 1 : 0,
          transition: "opacity 250ms ease",
        }}
      >
        <VoiceMode
          threadId={threadId}
          classId={classId}
          lessonId={lessonId}
          userId={userId}
          onClose={handleVoiceClose}
          onTurn={handleVoiceTurn}
        />
      </div>
    )}
    {expandedDiagram && (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">Visual lesson</span>
          <button
            onClick={() => setExpandedDiagram(null)}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="flex-1">
          <ExcalidrawCanvas data={expandedDiagram} />
        </div>
      </div>
    )}
    {/* Chat Messages */}
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto px-4 py-6 relative">
        {/* Gradient fade overlay at bottom */}
        <div className="sticky bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10"></div>
        <div className="max-w-3xl mx-auto">
          <div className="space-y-6">
            {isLoadingConversation ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-gray-500">Loading conversation...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">AI Tutor</h3>
                <p className="text-gray-500">Ask me anything about your lesson!</p>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                  } animate-in fade-in slide-in-from-bottom-2 ease-out duration-500`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className={message.role === "user" ? "max-w-[75%] sm:max-w-md" : "w-full"}>
                  {message.source === "voice" && (
                    <div className="mb-1 text-xs text-gray-300">
                      Voice
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 transition-all duration-300 ease-out ${message.role === "user"
                        ? "bg-gray-100 text-gray-900 rounded-[20px] rounded-br-[8px]"
                        : "bg-transparent text-gray-900 rounded-[20px] rounded-bl-[8px]"
                    }`}
                  >
                  {message.inChatAssessmentData ? (
                    <InChatAssessmentForm
                      inChatAssessmentData={message.inChatAssessmentData}
                      conversationId={threadId || undefined}
                      classId={classId}
                      lessonId={lessonId}
                      userId={userId || undefined}
                      onSubmitSuccess={(feedback) => {
                        // Add feedback as a new assistant message
                        const feedbackMessage: Message = {
                          id: (Date.now() + 2).toString(),
                          content: feedback,
                          role: "assistant",
                          timestamp: new Date(),
                        }
                        setMessages((prev) => [...prev, feedbackMessage])
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          a: ({ ...props }) => (
                            <a
                              {...props}
                              className="text-blue-600 underline hover:text-blue-800 font-semibold transition-colors duration-200"
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {message.diagramData && (
                    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                      <div style={{ height: 420 }}>
                        <ExcalidrawCanvas data={message.diagramData} />
                      </div>
                      <div className="border-t border-gray-100 px-4 py-2 flex justify-end bg-gray-50">
                        <button
                          onClick={() => setExpandedDiagram(message.diagramData!)}
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Expand
                        </button>
                      </div>
                    </div>
                  )}
                  {message.role === "assistant" && onAddToNotes && (
                    <div className="mt-3 flex justify-end items-center gap-2 animate-in fade-in duration-300">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-help transition-all duration-200">
                              <Info className="w-4 h-4" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-gray-900 text-white text-xs max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold mb-1">Sources:</p>
                              {message.sources && message.sources.length > 0 ? (
                                message.sources.map((source, index) => (
                                  <p key={index}>
                                    {source.title}
                                    {source.page && source.page !== "?" && ` (Page ${source.page})`}
                                  </p>
                                ))
                              ) : (
                                <p className="text-gray-400 italic">No sources available</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onAddToNotes(message.content)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-gray-900 text-white text-xs">
                            <p>Add to Notes</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              </div>
              </div>
            ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 ease-out duration-500">
              <div className="w-full">
                <div className="bg-transparent text-gray-900 px-4 py-3 rounded-[20px] rounded-bl-[8px]">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce transition-all duration-300"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce transition-all duration-300"
                        style={{ animationDelay: "0.15s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce transition-all duration-300"
                        style={{ animationDelay: "0.3s" }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500 ml-1 animate-pulse">typing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  </div>

    {/* Fixed Input Bar */ }
  <div className="flex-shrink-0 backdrop-blur-md bg-white/80 relative z-20">
    <div className="px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          <form onSubmit={handleSubmit} className="relative">
            <div
              className="border border-gray-300 rounded-2xl p-4 relative transition-all duration-500 ease-in-out overflow-hidden bg-white/95 backdrop-blur-sm shadow-sm"
            >
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="w-full bg-transparent text-gray-900 placeholder-gray-400 resize-none border-none outline-none text-base leading-relaxed min-h-[24px] max-h-32 transition-all duration-200"
                  rows={1}
                  disabled={isTyping}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = "auto"
                    target.style.height = target.scrollHeight + "px"
                  }}
                />
                <div className="mt-2 text-xs text-gray-400">
                  Mode: {inputMode === "visual" ? "Visual (diagram-first)" : "Chat"}
                </div>
                <div className="flex items-center justify-between mt-8">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110"
                    >
                      <Settings2 className="h-5 w-5" />
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setInputMode((prev) => (prev === "visual" ? "chat" : "visual"))
                            }
                            className={`h-8 px-2 text-xs rounded-lg transition-all duration-200 ${
                              inputMode === "visual"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                          >
                            Diagram
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-gray-900 text-white text-xs">
                          <p>
                            {inputMode === "visual"
                              ? "Visual mode on (click to switch to chat)"
                              : "Switch to visual mode"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={openVoice}
                      disabled={isTyping || isPreparingVoice}
                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mic className="h-5 w-5 transition-transform duration-200" />
                    </Button>
                    {nodeTitle && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleManualAssessment}
                              disabled={isTyping}
                              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ClipboardCheck className="h-5 w-5 transition-transform duration-200" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-gray-900 text-white text-xs">
                            <p>Test My Understanding</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!input.trim() || isTyping}
                    className="h-8 w-8 p-0 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded-lg transition-all duration-200 hover:scale-110 disabled:hover:scale-100"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div >
)
}
