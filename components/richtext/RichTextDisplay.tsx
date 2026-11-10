"use client";

import React, { useState, useEffect } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { PartialBlock } from "@blocknote/core";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { RichTextContent } from "@/lib/types/quizzes";

interface RichTextDisplayProps {
  text: string;
  richTextContent?: RichTextContent;
}

export function RichTextDisplay({ text, richTextContent }: RichTextDisplayProps) {
  const [isClient, setIsClient] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined>(undefined);

  useEffect(() => {
    setIsClient(true);
    setMounted(true);
  }, []);

  // Parse richTextContent if it exists
  useEffect(() => {
    if (richTextContent) {
      try {
        // If it's already an object/array, use it directly
        if (Array.isArray(richTextContent)) {
          setInitialContent(richTextContent);
          return;
        }
        // If it's a string, try to parse it
        if (typeof richTextContent === 'string') {
          const parsed = JSON.parse(richTextContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInitialContent(parsed);
            return;
          }
        }
      } catch {
        // Not valid JSON, will fall back to markdown
      }
    }
    setInitialContent(undefined);
  }, [richTextContent]);

  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  // Always create editor, but only use it if we have BlockNote content
  const editor = useCreateBlockNote({
    initialContent: initialContent && Array.isArray(initialContent) && initialContent.length > 0
      ? initialContent
      : [
          {
            type: "paragraph",
            content: text || "",
          },
        ],
  });

  // If we have BlockNote content, render it
  if (isClient && initialContent && Array.isArray(initialContent) && initialContent.length > 0) {
    return (
      <div className="rich-text-display-wrapper w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          .rich-text-display-wrapper .bn-container {
            background-color: transparent !important;
            color: inherit !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .rich-text-display-wrapper .bn-editor {
            min-height: auto !important;
          }
          .rich-text-display-wrapper .bn-block-content {
            width: 100% !important;
          }
          .rich-text-display-wrapper .bn-container .bn-editor {
            cursor: default !important;
          }
        `}} />
        <BlockNoteView
          editor={editor}
          editable={false}
          theme={isDark ? "dark" : "light"}
          className="w-full"
        />
      </div>
    );
  }

  // Otherwise, render as markdown
  if (text) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return <span className="text-slate-400 italic">No question text</span>;
}

