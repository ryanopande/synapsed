'use client';

import { filterSuggestionItems, type PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";

// Import your AI extension we can build extension to take in drawing
import { getAISlashMenuItems } from "@danjari/blocknote-ai-extension";
import { callAI } from "@/lib/Editor/aiClient";
import { useLessonNote } from "@/lib/context/LessonNoteContext";

type EditorProps = {
  initialContent?: PartialBlock[];
  onChange?: (content: unknown) => void;
  onAIEntry?: (payload: { action: string; selectedText?: string; outputBlocks: unknown; outputMarkdown?: string }) => void;
  title?: string;
  content?: string;
  onContentChange?: (content: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  // Context props for auto-save
  classId?: string;
  nodeId?: string;
  nodeTitle?: string;
  showAICommands?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Editor = forwardRef<any, EditorProps>(({ 
  initialContent, 
  onChange, 
  onAIEntry, 
  title,
  onContentChange,
  onFocus,
  onBlur,
  placeholder,
  className,

  nodeTitle,
  showAICommands = true
}, ref) => {
  //const [aiResponses, setAiResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Use lesson note context for saving
  const { saveNote, updateNote, isSaving } = useLessonNote();

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  const defaultBlocks: PartialBlock[] = [
    {
      type: "heading",
      props: { level: 1 },
      content: title || "Lesson Notes",
    },
    {
      type: "paragraph",
      content: placeholder || "Start taking your notes here. Type '/' to see AI commands.",
    },
  ];

  const editor = useCreateBlockNote({
    dictionary: en,
    initialContent:
      Array.isArray(initialContent) && initialContent.length > 0
        ? initialContent
        : defaultBlocks,
  });

  // Expose editor instance to parent component
  useImperativeHandle(ref, () => editor, [editor]);

  const handleAICommand = async (action: string, payload?: { selectedText?: string }) => {
    //console.log("🤖 AI Command:", action, payload);
    
    setIsLoading(true);
    
    try {
      // Get selected text or use full document content
      const selectedText = payload?.selectedText || editor.getSelectedText();
      const hasSelection = selectedText && selectedText.length > 0;
      
      // Get full document content as context
      const fullContent = editor.document;
      const fullContext = JSON.stringify(fullContent, null, 2);
      
      // console.log("📄 Full context length:", fullContext.length);
      // console.log("🎯 Has selection:", hasSelection, "Selection length:", selectedText?.length);
      
      // Use selected text if available, otherwise use full context
      const contextToUse = hasSelection ? selectedText : fullContext;
      const aiResponse = await callAI(action, contextToUse, fullContext);
      
      // Add to responses log
      //setAiResponses(prev => [...prev, aiResponse]);
      
      // Parse markdown using BlockNote's built-in parser
      const blocks = await editor.tryParseMarkdownToBlocks(aiResponse);

      // Log AI entry if requested by parent
      onAIEntry?.({ action, selectedText, outputBlocks: blocks, outputMarkdown: aiResponse });
      
      // Insert the parsed blocks
      editor.insertBlocks(blocks, editor.getTextCursorPosition().block, "after");
      
    } catch (error) {
      console.error('AI error:', error);
      //const errorMessage = `Sorry, I couldn't process that request.`;
      // setAiResponses(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isClient) {
    return (
      <div className="max-w-6xl mx-auto p-6 animate-pulse">
        <div className="h-6 w-64 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-11/12 bg-slate-100 rounded" />
            <div className="h-3 w-10/12 bg-slate-100 rounded" />
            <div className="h-64 w-full bg-slate-100 rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-3 w-2/3 bg-slate-100 rounded" />
            <div className="h-64 w-full bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className || "h-full flex flex-col"}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex-shrink-0 mb-4 p-3 rounded animate-pulse">
          <div className="h-3 w-40 bg-slate-200 rounded" />
        </div>
      )}
      
      {/* AI Controls - Fixed at top (only show if showAICommands is true) */}
      {showAICommands && (
        <div className="flex-shrink-0 mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => handleAICommand('explain')}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Explain
          </button>
          <button
            onClick={() => handleAICommand('summarize')}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Summarize
          </button>
          <button
            onClick={() => handleAICommand('quiz-me')}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Quiz Me
          </button>
          <button
            onClick={() => handleAICommand('diagram')}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Create Diagram
          </button>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="flex-shrink-0 mb-2 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Saving...</span>
        </div>
      )}
      
      {/* Editor Container - Takes remaining space and scrollable */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <div className="h-full w-full overflow-y-auto">
          <BlockNoteView
            editor={editor}
            slashMenu={false}
            onChange={() => {
              const content = editor.document;
              onChange?.(content);
              onContentChange?.(content.map(block => block.content || '').join('\n'));
              // Update context immediately (optimistic update)
              updateNote(content, nodeTitle);
              // Auto-save with debouncing (handled by context)
              saveNote(content, nodeTitle);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            className="h-full w-full"
          >
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
                const defaultItems = getDefaultReactSlashMenuItems(editor);
                const aiItems = showAICommands ? getAISlashMenuItems(editor, handleAICommand) : [];
                const allItems = [...defaultItems, ...aiItems];
                return filterSuggestionItems(allItems, query);
              }}
            />
          </BlockNoteView>
        </div>
      </div>
      
      {/* AI Responses Log */}
      {/* {aiResponses.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">AI Responses:</h3>
          {aiResponses.map((response, index) => (
            <div key={index} className="mb-3 p-3 bg-white border rounded">
              <strong>Response {index + 1}:</strong>
              <pre className="mt-2 text-sm whitespace-pre-wrap">{response}</pre>
            </div>
          ))}
        </div>
      )} */}
    </div>
  );
});

Editor.displayName = "Editor";

export default Editor;
