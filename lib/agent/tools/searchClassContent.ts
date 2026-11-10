import { DynamicStructuredTool } from "@langchain/core/tools";
import * as z from "zod";
import { queryPinecone } from "@/lib/pinecone/queryPinecone";

export const searchClassContent = new DynamicStructuredTool({
  name: "searchClassContent",
  description: "Search for information within the class content (documents, syllabus, etc.) using RAG. Use this tool when the user asks questions about the class material.",
  schema: z.object({
    query: z.string().describe("The search query to find relevant information"),
    classId: z.string().describe("The ID of the class to search in"),
  }),
  func: async (input) => {
    const { query, classId } = input as { query: string; classId: string };

    try {
      const namespace = `class_${classId}`;
      const matches = await queryPinecone(query, namespace);

      if (!matches || matches.length === 0) {
        return {
          content: "No relevant information found in the class content.",
          sources: [],
        };
      }

      // Extract sources metadata
      const sources = matches.map((match) => {
        const metadata = match.metadata as {
          title?: string;
          page?: number | string;
          materialId?: string;
          classId?: string;
          text?: string;
        };
        return {
          title: metadata.title || "Unknown Source",
          page: metadata.page || "?",
          materialId: metadata.materialId,
          classId: metadata.classId,
        };
      });

      // Format the results for the agent WITHOUT source citations
      // Sources will be shown in the tooltip, not in the message content
      const formattedResults = matches.map((match) => {
        const metadata = match.metadata as {
          title?: string;
          page?: number | string;
          materialId?: string;
          classId?: string;
          text?: string;
        };
        // Only include the content text, not the source citation
        return metadata.text || "";
      }).join("\n\n---\n\n");

      const content = `Found the following relevant information:\n\n${formattedResults}`;

      const result = {
        content: content,
        sources: sources,
      };

      // Return object with both content and sources
      // The content will be used by the LLM, and sources will be extracted by the agent
      return result;
    } catch (error) {
      console.error("Error searching class content:", error);
      return {
        content: "An error occurred while searching the class content.",
        sources: [],
      };
    }
  },
});
