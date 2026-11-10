"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { PartialBlock } from "@blocknote/core";
import { useTheme } from "next-themes";
import { RichTextContent } from "@/lib/types/quizzes";
import type { BlockNoteEditor } from "@blocknote/core";

interface RichTextEditorProps {
  value: string; // Can be markdown or JSON string
  onChange: (value: string, richTextContent?: RichTextContent) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [isClient, setIsClient] = useState(false);
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined>(undefined);
  const editorRef = useRef<BlockNoteEditor | null>(null);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setMounted(true);
  }, []);

  // Parse initial value - try JSON first, then markdown
  useEffect(() => {
    if (value) {
      try {
        // Try parsing as JSON (BlockNote format)
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInitialContent(parsed);
          return;
        }
      } catch {
        // Not JSON, will treat as markdown
      }
    }
    // If no value or not valid JSON, set to undefined (will use default)
    setInitialContent(undefined);
  }, [value]);

  const editor = useCreateBlockNote({
    initialContent: initialContent || [
      {
        type: "paragraph",
        content: value || "Enter question text...",
      },
    ],
  });

  // Store editor reference
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Handle content changes - convert to markdown and store BlockNote JSON
  const handleChange = async () => {
    if (editorRef.current) {
      try {
        const blocks = editorRef.current.document;
        // Convert blocks to markdown
        const markdown = await editorRef.current.blocksToMarkdownLossy(blocks);
        // Also pass the BlockNote JSON for rich text rendering
        onChange(markdown, blocks);
      } catch (error) {
        console.error('Error converting blocks to markdown:', error);
        // Fallback: use plain text
        const blocks = editorRef.current.document;
        const text = blocks
          .map((block: PartialBlock) => {
            if (typeof block.content === 'string') return block.content;
            if (Array.isArray(block.content)) {
              return block.content
                .map((item: unknown) => typeof item === 'string' ? item : (item as { text?: string })?.text || '')
                .join('');
            }
            return '';
          })
          .join('\n');
        onChange(text, blocks);
      }
    }
  };

  // Determine if dark mode is active
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  if (!isClient) {
    return (
      <div className="border border-slate-300 dark:border-slate-600 rounded-md p-3 min-h-[120px] bg-white dark:bg-slate-900">
        <div className="text-slate-400">Loading editor...</div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .rich-text-editor-wrapper .bn-container {
          background-color: white !important;
          color: rgb(15 23 42) !important;
          min-height: 120px !important;
          width: 100% !important;
          padding: 12px !important;
        }
        .dark .rich-text-editor-wrapper .bn-container {
          background-color: rgb(15 23 42) !important;
          color: rgb(241 245 249) !important;
        }
        .rich-text-editor-wrapper .bn-editor {
          min-height: 120px !important;
          width: 100% !important;
        }
        .rich-text-editor-wrapper .bn-block-content {
          width: 100% !important;
        }
        .rich-text-editor-wrapper .bn-inline-content {
          width: 100% !important;
        }
      `}} />
      <div className="border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden w-full rich-text-editor-wrapper">
        <div className="bg-white dark:bg-slate-900 w-full">
          <BlockNoteView
            editor={editor}
            onChange={handleChange}
            theme={isDark ? "dark" : "light"}
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
