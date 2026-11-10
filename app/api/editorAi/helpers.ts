import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GEMINI_MODEL } from "@/lib/gemini-model";

export async function callOpenAI(prompt: string) {
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 2000,
    temperature: 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await model.invoke([
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "human", content: prompt }
    ]);
    
    return response.content as string;
  } catch (error) {
    throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function callClaude(prompt: string) {
  const model = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxTokens: 2000,
    temperature: 0.7,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const response = await model.invoke([
      { role: "human", content: prompt }
    ]);
    
    return response.content as string;
  } catch (error) {
    throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function callGemini(prompt: string) {
  const model = new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL,
    maxOutputTokens: 2000,
    temperature: 0.7,
    apiKey: process.env.GEMINI_API_KEY,
  });

  try {
    const response = await model.invoke([
      { role: "human", content: prompt }
    ]);
    
    return response.content as string;
  } catch (error) {
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
