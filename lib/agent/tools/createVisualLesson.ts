import { DynamicStructuredTool } from "@langchain/core/tools";
import * as z from "zod";
import Anthropic from "@anthropic-ai/sdk";
import {
  getExcalidrawPlannerPrompt,
  getExcalidrawTeacherPrompt,
} from "@/lib/agent/prompts";

interface DiagramData {
  elements?: unknown[];
  appState?: Record<string, unknown>;
}

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  input?: {
    elements?: string;
  };
  name?: string;
}

function parseExcalidrawDataFromContent(content: AnthropicContentBlock[]): DiagramData | null {
  for (const block of content) {
    if (block.type !== "mcp_tool_use" || block.name !== "create_view") {
      continue;
    }

    const elementsRaw = block.input?.elements;
    if (!elementsRaw) continue;

    try {
      const parsed = JSON.parse(elementsRaw) as Array<{ type?: string; x?: number; y?: number }>;
      const elements = parsed.filter((el) => el.type !== "cameraUpdate");
      const camera = parsed.find((el) => el.type === "cameraUpdate");

      return {
        elements,
        appState: camera
          ? {
              scrollX: camera.x ? -camera.x : 0,
              scrollY: camera.y ? -camera.y : 0,
            }
          : undefined,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export const createVisualLesson = new DynamicStructuredTool({
  name: "createVisualLesson",
  description:
    "Create a full visual lesson as Excalidraw diagram data for a student question. Use when the learner asks for a visual explanation, diagram, or whiteboard style walkthrough.",
  schema: z.object({
    question: z.string().describe("The student question to visualize"),
    learningGoal: z
      .string()
      .optional()
      .describe("Short learning objective for this visual lesson"),
    conversationContext: z
      .object({
        topicsCovered: z
          .array(z.string())
          .optional()
          .describe("Key topics or concepts already discussed in the conversation"),
        studentUnderstanding: z
          .string()
          .optional()
          .describe("Brief assessment of what the student seems to understand or struggle with"),
        priorExplanations: z
          .string()
          .optional()
          .describe("Key explanations or analogies already given that the diagram should reinforce"),
        studentLevel: z
          .enum(["beginner", "intermediate", "advanced"])
          .optional()
          .describe("Inferred student level based on the conversation"),
      })
      .optional()
      .describe(
        "Distilled context from the conversation to guide the diagram's pedagogical focus. Only include what is directly relevant to the visual lesson — do not dump the full conversation."
      ),
    previousDiagramSummaries: z
      .array(z.string())
      .optional()
      .describe(
        "System-provided. Teaching briefs from previous diagrams drawn in this conversation thread. Do not populate — injected automatically by the server to maintain visual continuity."
      ),
  }),
  func: async (input) => {
    const { question, learningGoal, conversationContext, previousDiagramSummaries } = input as {
      question: string;
      learningGoal?: string;
      conversationContext?: {
        topicsCovered?: string[];
        studentUnderstanding?: string;
        priorExplanations?: string;
        studentLevel?: "beginner" | "intermediate" | "advanced";
      };
      previousDiagramSummaries?: string[];
    };

    console.log("[createVisualLesson] invoked", {
      question,
      learningGoal,
      studentLevel: conversationContext?.studentLevel,
      topicsCovered: conversationContext?.topicsCovered,
      previousDiagramCount: previousDiagramSummaries?.length ?? 0,
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[createVisualLesson] ANTHROPIC_API_KEY is missing");
      return {
        content:
          "Visual mode is currently unavailable because ANTHROPIC_API_KEY is missing on the server.",
        diagramData: null,
      };
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
      const contextLines: string[] = [];
      if (learningGoal) contextLines.push(`Learning goal: ${learningGoal}`);
      if (conversationContext) {
        if (conversationContext.studentLevel)
          contextLines.push(`Student level: ${conversationContext.studentLevel}`);
        if (conversationContext.topicsCovered?.length)
          contextLines.push(`Topics already covered: ${conversationContext.topicsCovered.join(", ")}`);
        if (conversationContext.studentUnderstanding)
          contextLines.push(`Student understanding: ${conversationContext.studentUnderstanding}`);
        if (conversationContext.priorExplanations)
          contextLines.push(`Prior explanations to reinforce: ${conversationContext.priorExplanations}`);
      }
      if (previousDiagramSummaries?.length) {
        contextLines.push(
          `\nPrevious diagrams already drawn in this conversation (maintain the same visual style, color conventions, and build on these rather than repeating them):\n` +
            previousDiagramSummaries.map((s, i) => `  Diagram ${i + 1}: ${s}`).join("\n")
        );
      }

      const planningPrompt = contextLines.length
        ? `${question}\n\n${contextLines.join("\n")}`
        : question;

      console.log("[createVisualLesson] step 1 — calling Haiku planner");
      const planResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: getExcalidrawPlannerPrompt(),
        messages: [{ role: "user", content: planningPrompt }],
      });

      const teachingBrief =
        planResponse.content.find((block) => block.type === "text")?.text ?? "";
      console.log("[createVisualLesson] Haiku planner done — brief length:", teachingBrief.length, "chars");

      console.log("[createVisualLesson] step 2 — calling Opus drawer via Excalidraw MCP");
      const drawResponse = await client.beta.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 16000,
        system: getExcalidrawTeacherPrompt(),
        messages: [
          {
            role: "user",
            content: `${question}\n\n---\nTeaching brief (use this to guide your lesson):\n${teachingBrief}`,
          },
        ],
        mcp_servers: [
          {
            type: "url",
            url: "https://mcp.excalidraw.com",
            name: "excalidraw",
          },
        ],
        tools: [
          {
            type: "mcp_toolset",
            mcp_server_name: "excalidraw",
          },
        ],
        betas: ["mcp-client-2025-11-20"],
      });

      const blocks = drawResponse.content as AnthropicContentBlock[];
      console.log("[createVisualLesson] Opus response — stop_reason:", drawResponse.stop_reason,
        "| blocks:", blocks.map((b) => `${b.type}${b.name ? `(${b.name})` : ""}`).join(", "));

      const allMcpToolUseBlocks = blocks.filter((b) => b.type === "mcp_tool_use");
      console.log("[createVisualLesson] all mcp_tool_use blocks:", allMcpToolUseBlocks.map((b) => ({
        name: b.name,
        elementsLength: b.input?.elements?.length ?? 0,
      })));

      const mcpBlock = blocks.find((b) => b.type === "mcp_tool_use" && b.name === "create_view");
      if (!mcpBlock) {
        console.warn("[createVisualLesson] no mcp_tool_use/create_view block found — Excalidraw MCP was not called");
      } else {
        const elementsRaw = mcpBlock.input?.elements;
        console.log("[createVisualLesson] first create_view block — raw elements length:", elementsRaw?.length ?? 0, "chars",
          "| input keys:", Object.keys(mcpBlock.input ?? {}).join(", "));
      }

      const diagramData = parseExcalidrawDataFromContent(blocks);
      console.log("[createVisualLesson] parsed diagramData — elements:", diagramData?.elements?.length ?? 0);

      const text =
        blocks
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text)
          .join("\n")
          .trim() || "I created a visual lesson for this topic.";

      if (!diagramData?.elements?.length) {
        console.warn("[createVisualLesson] no renderable elements — returning fallback content");
        return {
          content:
            "I prepared a visual lesson plan, but I could not generate renderable Excalidraw elements this time.",
          diagramData: null,
        };
      }

      console.log("[createVisualLesson] success — returning diagramData with", diagramData.elements?.length, "elements");
      return {
        content: text,
        diagramData,
        diagramManifest: teachingBrief,
      };
    } catch (error) {
      console.error("[createVisualLesson] caught error:", error instanceof Error ? error.message : error);
      return {
        content: `Failed to generate visual lesson: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        diagramData: null,
      };
    }
  },
});
