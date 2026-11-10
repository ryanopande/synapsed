import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import * as z from "zod";
import { StateGraph, START, END } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import { searchClassContent } from "./tools/searchClassContent";
import { createInChatAssessment } from "./tools/createInChatAssessment";
import { createVisualLesson } from "./tools/createVisualLesson";
import { GEMINI_AGENT_MODEL } from "@/lib/gemini-model";
import { getAgentSystemPrompt } from "./prompts";

// Define MessagesState with channel configuration for proper memory
interface MessagesState {
  messages: BaseMessage[];
}

// Context for tool invocations
interface ToolContext {
  conversationId?: string;
  classId?: string;
  lessonId?: string;
  userId?: string;
  threadId?: string;
}

let currentToolContext: ToolContext = {};

// Per-thread diagram history: stores teaching briefs from each diagram drawn in the session
// Used to give subsequent diagram calls visual continuity within the same conversation
const diagramHistoryByThread = new Map<string, string[]>();
const MAX_DIAGRAM_HISTORY = 3;

// Source metadata type
export interface SourceMetadata {
  title: string;
  page?: number | string;
  materialId?: string;
  classId?: string;
}

// Agent response type
export interface AgentResponse {
  content: string;
  sources?: SourceMetadata[];
  inChatAssessmentData?: InChatAssessmentData; // Formedible in-chat assessment configuration
  diagramData?: DiagramData;
}

interface DiagramData {
  elements?: unknown[];
  appState?: Record<string, unknown>;
}

// Initialize the model
const model = new ChatGoogleGenerativeAI({
  model: GEMINI_AGENT_MODEL,
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

// Define some simple tools for testing
const getStudentProgress = new DynamicStructuredTool({
  name: "getStudentProgress",
  description: "Get the progress of a student in a class",
  schema: z.object({
    studentId: z.string().describe("The ID of the student"),
    classId: z.string().describe("The ID of the class"),
  }),
  func: async (input) => {
    const { studentId, classId } = input as { studentId: string; classId: string };
    return `Student ${studentId} in class ${classId} has completed 75% of assignments`;
  },
});

const getClassResources = new DynamicStructuredTool({
  name: "getClassResources",
  description: "Get all available resources for a class",
  schema: z.object({
    classId: z.string().describe("The ID of the class"),
  }),
  func: async (input) => {
    const { classId } = input as { classId: string };
    return `Class ${classId} has 5 documents, 3 assignments, and 2 quizzes available`;
  },
});

// Create tools map
const toolsByName: Record<string, DynamicStructuredTool> = {
  [getStudentProgress.name]: getStudentProgress,
  [getClassResources.name]: getClassResources,
  [searchClassContent.name]: searchClassContent,
  [createInChatAssessment.name]: createInChatAssessment,
  [createVisualLesson.name]: createVisualLesson,
};

const tools = Object.values(toolsByName);
const modelWithTools = model.bindTools(tools);

// Define the LLM call node
async function callLlm(state: MessagesState) {
  // Filter out any existing SystemMessages from the history to avoid duplicates
  // We check both instanceof and the type string to be safe against serialization issues
  const history = state.messages.filter(msg => {
    const isSystem = msg instanceof SystemMessage || msg._getType() === 'system';
    return !isSystem;
  });

  const result = await modelWithTools.invoke([
    new SystemMessage(getAgentSystemPrompt()),
    ...history,
  ]);

  const toolCalls = (result as AIMessage).tool_calls ?? [];
  if (toolCalls.length > 0) {
    console.log("[simple-agent] Gemini requested tools:", toolCalls.map((tc) => tc.name).join(", "));
  } else {
    console.log("[simple-agent] Gemini responded without tool calls (direct answer)");
  }

  return { messages: [result] };
}

// Map to store sources extracted from tool results, keyed by tool_call_id
// This allows us to separate sources from content - LLM gets clean text, we track sources separately
const toolSourcesMap = new Map<string, SourceMetadata[]>();

// Map to store in-chat assessment data from createInChatAssessment tool, keyed by tool_call_id
interface InChatAssessmentData {
  type: string;
  topic: string;
  nodeTitle?: string;
  difficulty: string;
  fields: unknown[];
  schema: unknown;
  correctAnswers: Record<string, unknown>;
}
const toolInChatAssessmentMap = new Map<string, InChatAssessmentData>();
const toolDiagramMap = new Map<string, DiagramData>();

// Define the tool call node
async function callTools(state: MessagesState) {
  const lastMessage = state.messages[state.messages.length - 1];

  if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls?.length) {
    return { messages: [] };
  }

  const toolResults = await Promise.all(
    lastMessage.tool_calls.map(async (toolCall) => {
      const tool = toolsByName[toolCall.name];
      if (!tool) {
        return new ToolMessage({
          content: `Tool ${toolCall.name} not found`,
          tool_call_id: toolCall.id || '',
        });
      }
      
      // Inject context into tool call args
      let toolCallInput = toolCall.args || {};
      if (toolCall.name === 'createInChatAssessment') {
        toolCallInput = {
          ...toolCallInput,
          conversationId: currentToolContext.conversationId,
          classId: currentToolContext.classId,
          lessonId: currentToolContext.lessonId,
        };
      }
      if (toolCall.name === 'createVisualLesson') {
        // Inject diagram history so the drawer maintains visual continuity across diagrams
        const threadId = currentToolContext.threadId || '';
        const history = diagramHistoryByThread.get(threadId) || [];
        if (history.length > 0) {
          toolCallInput = {
            ...toolCallInput,
            previousDiagramSummaries: history,
          };
        }
        console.log("[simple-agent] createVisualLesson tool call dispatched", {
          question: toolCallInput.question,
          hasConversationContext: !!toolCallInput.conversationContext,
          previousDiagramCount: history.length,
        });
      }

      const result = await tool.invoke(toolCallInput);

      // Handle different return types
      let content: string;
      const toolCallId = toolCall.id || '';

      if (typeof result === 'string') {
        content = result;
        toolSourcesMap.delete(toolCallId);
      } else if (result && typeof result === 'object' && result !== null && 'content' in result) {
        // Extract sources if present and store them separately
        const hasSources = 'sources' in result;
        const sourcesIsArray = hasSources && Array.isArray(result.sources);

        if (hasSources && sourcesIsArray) {
          const sourcesMetadata = result.sources as SourceMetadata[];
          toolSourcesMap.set(toolCallId, sourcesMetadata);
        } else {
          toolSourcesMap.delete(toolCallId);
        }

        // Extract in-chat assessment data if present (from createInChatAssessment tool)
        if ('inChatAssessmentData' in result && result.inChatAssessmentData) {
          toolInChatAssessmentMap.set(toolCallId, result.inChatAssessmentData);
        } else {
          toolInChatAssessmentMap.delete(toolCallId);
        }

        // Extract diagram data if present (from createVisualLesson tool)
        if ('diagramData' in result && result.diagramData) {
          toolDiagramMap.set(toolCallId, result.diagramData as DiagramData);
        } else {
          toolDiagramMap.delete(toolCallId);
        }

        // Store diagram manifest for visual continuity in subsequent diagrams
        if (toolCall.name === 'createVisualLesson' && 'diagramManifest' in result && result.diagramManifest) {
          const threadId = currentToolContext.threadId || '';
          const history = diagramHistoryByThread.get(threadId) || [];
          history.push(result.diagramManifest as string);
          if (history.length > MAX_DIAGRAM_HISTORY) history.shift();
          diagramHistoryByThread.set(threadId, history);
        }

        // Give LLM ONLY the content string - clean, natural text without JSON structure
        content = result.content as string;
      } else {
        content = JSON.stringify(result);
        toolSourcesMap.delete(toolCallId);
      }
      
      return new ToolMessage({
        content: content,
        tool_call_id: toolCallId,
      });
    })
  );

  return { messages: toolResults };
}

// Define the should continue function
function shouldContinue(state: MessagesState): string {
  const lastMessage = state.messages[state.messages.length - 1];

  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools";
  }

  return END as string;
}

// Build the graph with proper memory channel configuration
const workflow = new StateGraph({
  channels: {
    messages: {
      reducer: (x: BaseMessage[] = [], y: BaseMessage[] = []) => {
        const arr = Array.isArray(y) ? y : [y];
        return [...x, ...arr];
      },
      default: () => [],
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LangGraph StateGraph type requires this due to version mismatch
} as any)
  .addNode("llm", callLlm)
  .addNode("tools", callTools)
  .addEdge(START, "llm")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LangGraph 1.x conditional edge typing vs custom MessagesState
  .addConditionalEdges("llm", shouldContinue as any, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "llm");

// Initialize MongoDB checkpointer
let checkpointer: MongoDBSaver;
let mongoClient: MongoClient;

// Initialize MongoDB connection (similar to PostgresSaver.fromConnString)
async function initializeMongoDB() {
  if (!mongoClient) {
    const connectionString = process.env.DATABASE_URL || "mongodb://localhost:27017";
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    checkpointer = new MongoDBSaver({ client: mongoClient });
    // await checkpointer.setup(); // Uncomment if MongoDB needs setup like Postgres
  }
  return checkpointer;
}

// Compile agent once with MongoDB checkpointer
// Using ReturnType to infer the compiled graph type
type CompiledAgent = ReturnType<typeof workflow.compile>;
let compiledAgent: CompiledAgent | null = null;
let compilationPromise: Promise<CompiledAgent> | null = null;

async function getCompiledAgent(): Promise<CompiledAgent> {
  if (!compiledAgent) {
    if (!compilationPromise) {
      compilationPromise = (async () => {
        const checkpointer = await initializeMongoDB();
        compiledAgent = workflow.compile({ checkpointer });
        return compiledAgent;
      })();
    }
    await compilationPromise;
  }
  if (!compiledAgent) {
    throw new Error('Failed to compile agent');
  }
  return compiledAgent;
}

// Helper function to extract sources from tool messages
// Sources are stored separately in toolSourcesMap, keyed by tool_call_id
function extractSourcesFromMessages(messages: BaseMessage[]): SourceMetadata[] {
  const sources: SourceMetadata[] = [];
  const seenSources = new Set<string>();

  for (const msg of messages) {
    // Check message type - handle both instanceof and type string (for serialized messages)
    const isToolMessage = msg instanceof ToolMessage || msg._getType() === 'tool';
    
    if (isToolMessage) {
      // Get tool_call_id from the ToolMessage
      let toolCallId: string | undefined;
      
      if (msg instanceof ToolMessage) {
        toolCallId = msg.tool_call_id;
      } else {
        // For serialized messages, try to extract tool_call_id
        try {
          const msgStr = typeof msg.content === 'string' ? msg.content : String(msg.content);
          const parsed = JSON.parse(msgStr);
          if (parsed.kwargs && parsed.kwargs.tool_call_id) {
            toolCallId = parsed.kwargs.tool_call_id;
          }
        } catch {
          // Not JSON, skip
        }
      }
      
      if (toolCallId && toolSourcesMap.has(toolCallId)) {
        const toolSources = toolSourcesMap.get(toolCallId) || [];
        
        for (const source of toolSources) {
          // Create a unique key to avoid duplicates
          const key = `${source.title}-${source.page}-${source.materialId || ''}`;
          if (!seenSources.has(key)) {
            seenSources.add(key);
            const sourceMetadata = {
              title: source.title || "Unknown Source",
              page: source.page,
              materialId: source.materialId,
              classId: source.classId,
            };
            sources.push(sourceMetadata);
          }
        }
      }
    }
  }

  return sources;
}

// Clears a corrupted checkpoint from MongoDB so the thread can start fresh.
// Needed when old checkpoints were saved without the `pending_sends` field
// introduced in a newer version of @langchain/langgraph.
async function clearCorruptedCheckpoint(threadId: string): Promise<void> {
  try {
    const safeThreadId = sanitizeCheckpointThreadId(threadId);
    const db = mongoClient.db();
    await Promise.all([
      db.collection('checkpoints').deleteMany({ thread_id: safeThreadId }),
      db.collection('checkpoint_writes').deleteMany({ thread_id: safeThreadId }),
    ]);
    console.warn('[invokeAgent] Cleared corrupted checkpoint for thread:', safeThreadId);
  } catch (err) {
    console.error('[invokeAgent] Failed to clear corrupted checkpoint:', err);
  }
}

function isCheckpointFormatError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('pending_sends is not iterable');
}

/**
 * Coerce checkpoint identifiers to plain strings.
 * Prevents NoSQL operator injection into MongoDBSaver queries
 * (GHSA-98xf-r82g-9mhx) when clients send object payloads.
 */
function sanitizeCheckpointThreadId(threadId: unknown): string {
  if (typeof threadId === "string" && threadId.trim().length > 0) {
    return threadId;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Helper function to invoke the agent with a simple message
export async function invokeAgent(userMessage: string, threadId?: string, classId?: string, userId?: string, conversationId?: string): Promise<AgentResponse> {
  try {
    // Get compiled agent (will compile once on first call)
    const agent = await getCompiledAgent();

    const safeThreadId = sanitizeCheckpointThreadId(threadId);
    // Pass config with thread_id if provided for memory
    // Ensure config is always a valid object (MongoDB checkpointer requires this)
    const config = { configurable: { thread_id: safeThreadId } };

    // Prepare the input messages
    const messages: BaseMessage[] = [];

    // Store context for tool invocations
    currentToolContext = {
      conversationId,
      classId,
      lessonId: classId,
      userId,
      threadId: safeThreadId,
    };

    // Context Injection
    let fullUserMessage = userMessage;
    if (classId || userId) {
      const contextMsg = `[System Context]\n${classId ? `- Class ID: ${classId}\n` : ""}${userId ? `- Student ID: ${userId}\n` : ""}${conversationId ? `- Conversation ID: ${conversationId}\n` : ""}[End Context]\n\n`;
      fullUserMessage = contextMsg + userMessage;
    }

    messages.push(new HumanMessage(fullUserMessage));

    // Pass only the new message - the reducer will merge with previous messages from checkpointer
    const result = await agent.invoke(
      { messages },
      config
    );

    // Extract sources from tool messages
    const sources = extractSourcesFromMessages(result.messages);
    
    // Extract in-chat assessment data from tool messages
    let inChatAssessmentData: InChatAssessmentData | undefined = undefined;
    let diagramData: DiagramData | undefined = undefined;
    const toolCallIdsInResult = new Set<string>();
    for (const msg of result.messages) {
      if (msg instanceof ToolMessage) {
        if (msg.tool_call_id) {
          toolCallIdsInResult.add(msg.tool_call_id);
          // Check if this tool call has in-chat assessment data
          if (toolInChatAssessmentMap.has(msg.tool_call_id)) {
            inChatAssessmentData = toolInChatAssessmentMap.get(msg.tool_call_id);
          }
          if (toolDiagramMap.has(msg.tool_call_id)) {
            diagramData = toolDiagramMap.get(msg.tool_call_id);
          }
        }
      }
    }
    // Clean up maps for tool calls in this result to prevent memory leaks
    // (Keep them until after extraction, then clean up)
    for (const toolCallId of toolCallIdsInResult) {
      toolSourcesMap.delete(toolCallId);
      toolInChatAssessmentMap.delete(toolCallId);
      toolDiagramMap.delete(toolCallId);
    }

    // Find the LAST AIMessage in the result (the most recent response)
    const aiMessages = result.messages.filter((msg: BaseMessage) => msg instanceof AIMessage);
    const aiMessage = aiMessages[aiMessages.length - 1];

    // Helper function to extract string content from message content (which can be string or array)
    const extractContent = (msgContent: string | string[] | undefined): string => {
      if (!msgContent) return "";
      if (typeof msgContent === "string") return msgContent;
      if (Array.isArray(msgContent)) {
        // Join array elements, filtering out non-string types
        return msgContent
          .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
          .join("\n");
      }
      return String(msgContent);
    };

    let content: string;
    if (aiMessage) {
      const extracted = extractContent(aiMessage.content);
      content = extracted || "No content in AI message";
    } else {
      // If no AIMessage, return the last message
      const lastMessage = result.messages[result.messages.length - 1];
      if (!lastMessage) {
        content = "No response generated - no messages returned";
      } else {
        const extracted = extractContent(lastMessage.content);
        content = extracted || "No response generated - message has no content property";
      }
    }

    const response = {
      content,
      sources: sources.length > 0 ? sources : undefined,
      inChatAssessmentData,
      diagramData,
    };

    return response;
  } catch (error) {
    // Corrupted checkpoint: old MongoDB documents lack `pending_sends` introduced in
    // a newer @langchain/langgraph version. Clear the bad checkpoint and retry once
    // with the same threadId so the thread continues cleanly (history lost for that
    // thread but the user gets a response instead of a 500).
    if (isCheckpointFormatError(error) && threadId) {
      console.warn('[invokeAgent] Checkpoint format error detected — clearing and retrying thread:', threadId);
      await clearCorruptedCheckpoint(threadId);
      return invokeAgent(userMessage, threadId, classId, userId, conversationId);
    }
    console.error('Error in invokeAgent:', error);
    throw error;
  }
}

// Helper function to stream the agent response
export async function streamAgent(userMessage: string, threadId?: string, classId?: string, userId?: string) {
  try {
    const agent = await getCompiledAgent();
    const safeThreadId = sanitizeCheckpointThreadId(threadId);
    const config = { configurable: { thread_id: safeThreadId } };
    const messages: BaseMessage[] = [];

    let fullUserMessage = userMessage;
    if (classId || userId) {
      const contextMsg = `[System Context]\n${classId ? `- Class ID: ${classId}\n` : ""}${userId ? `- Student ID: ${userId}\n` : ""}[End Context]\n\n`;
      fullUserMessage = contextMsg + userMessage;
    }

    messages.push(new HumanMessage(fullUserMessage));

    // Return the stream directly
    return await agent.streamEvents(
      { messages },
      { ...config, version: "v2" }
    );
  } catch (error) {
    console.error('Error in streamAgent:', error);
    throw error;
  }
}
