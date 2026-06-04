import { GoogleGenerativeAI, SchemaType, type Tool as GeminiTool } from '@google/generative-ai';
import type { LLMProvider, Message, Tool, StreamChunk, ToolCall } from './types.js';

// Rate limit configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  /**
   * Retry logic for rate-limited requests
   */
  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error (429)
        const isRateLimited = error?.status === 429 || 
          error?.message?.includes('429') || 
          error?.message?.includes('Too Many Requests') ||
          error?.message?.includes('quota');
        
        if (isRateLimited && attempt < MAX_RETRIES - 1) {
          // Extract retry delay from error if available, or use exponential backoff
          let retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          
          // Try to parse retry delay from error message
          // Handle units: ms, s (default), m, h
          const retryMatch = error?.message?.match(/retry in (\d+(?:\.\d+)?)\s*(ms|s|m|h|seconds?|minutes?|hours?)?/i);
          if (retryMatch) {
            const value = parseFloat(retryMatch[1]);
            const unit = retryMatch[2]?.toLowerCase();
            
            if (unit?.startsWith('h')) {
              retryDelay = Math.ceil(value * 60 * 60 * 1000);
            } else if (unit?.startsWith('m') && !unit.startsWith('ms')) {
              retryDelay = Math.ceil(value * 60 * 1000);
            } else if (unit === 'ms') {
              retryDelay = Math.ceil(value);
            } else {
              // Default to seconds if no unit or 's'/'seconds'
              retryDelay = Math.ceil(value * 1000);
            }
            retryDelay += 1000; // Add 1s buffer to be safe
          }
          
          console.log(`[Gemini] Rate limited on ${operationName}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(retryDelay);
          continue;
        }
        
        // Not a rate limit error or max retries reached
        throw error;
      }
    }
    
    throw lastError;
  }

  private findToolName(toolCallId: string, messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.toolCalls) {
        const toolCall = msg.toolCalls.find((tc) => tc.id === toolCallId);
        if (toolCall) return toolCall.name;
      }
    }
    return 'unknown_tool';
  }

  private toGeminiPart(msg: Message, allMessages: Message[]): any[] {
    const parts: any[] = [];
    
    if (msg.role === 'user') {
      parts.push({ text: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.content) parts.push({ text: msg.content });
      if (msg.toolCalls) {
        msg.toolCalls.forEach((tc) => {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
            },
          });
        });
      }
    } else if (msg.role === 'tool') {
      const toolName = this.findToolName(msg.toolCallId!, allMessages);
      let contentJson: Record<string, unknown>;
      try {
        contentJson = JSON.parse(msg.content);
      } catch (e) {
        contentJson = { result: msg.content };
      }

      parts.push({
        functionResponse: {
          name: toolName,
          response: contentJson,
        },
      });
    }

    return parts;
  }

  private toGeminiHistory(messages: Message[]): { role: string; parts: any[] }[] {
    return messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => {
        let role = 'user';
        if (msg.role === 'assistant') role = 'model';
        if (msg.role === 'tool') role = 'function';
        
        return {
          role,
          parts: this.toGeminiPart(msg, messages),
        };
      });
  }

  private toGeminiTools(tools: Tool[]): GeminiTool[] {
    // Use type assertion as the SDK types are overly strict
    return [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: Object.fromEntries(
            Object.entries(tool.parameters.properties).map(([key, value]) => [
              key,
              {
                type: this.mapType(value.type),
                description: value.description,
                ...(value.enum ? { enum: value.enum } : {}),
              },
            ])
          ),
          required: tool.parameters.required || [],
        },
      })),
    }] as GeminiTool[];
  }

  private mapType(type: string): SchemaType {
    switch (type) {
      case 'string': return SchemaType.STRING;
      case 'number': return SchemaType.NUMBER;
      case 'integer': return SchemaType.INTEGER;
      case 'boolean': return SchemaType.BOOLEAN;
      case 'array': return SchemaType.ARRAY;
      default: return SchemaType.STRING;
    }
  }

  async chat(messages: Message[], tools?: Tool[]): Promise<Message> {
    return this.withRetry(async () => {
      const systemMessage = messages.find((m) => m.role === 'system');
      const lastMessage = messages[messages.length - 1];
      const history = this.toGeminiHistory(messages.slice(0, -1));

      console.log(`[Gemini] Starting chat request with model ${this.model}`);
      console.log(`[Gemini] Messages count: ${messages.length}`);
      
      const lastMessageParts = this.toGeminiPart(lastMessage, messages);
      // Log the content part for debugging
      console.log(`[Gemini] Last message type: ${lastMessage.role}`);

      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemMessage?.content,
        tools: tools ? this.toGeminiTools(tools) : undefined,
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessageParts);
      const response = result.response;

      console.log(`[Gemini] Chat request successful`);

      const text = response.text();
      const functionCalls = response.functionCalls();

      const resultMessage: Message = {
        role: 'assistant',
        content: text,
      };

      if (functionCalls && functionCalls.length > 0) {
        resultMessage.toolCalls = functionCalls.map((fc, index) => ({
          id: `gemini_${Date.now()}_${index}`,
          name: fc.name,
          arguments: fc.args as Record<string, unknown>,
        }));
      }

      return resultMessage;
    }, 'chat');
  }

  async chatStream(
    messages: Message[],
    tools?: Tool[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<Message> {
    return this.withRetry(async () => {
      const systemMessage = messages.find((m) => m.role === 'system');
      const lastMessage = messages[messages.length - 1];
      const history = this.toGeminiHistory(messages.slice(0, -1));

      const lastMessageParts = this.toGeminiPart(lastMessage, messages);
      console.log(`[Gemini] Last message type: ${lastMessage.role}`);

      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemMessage?.content,
        tools: tools ? this.toGeminiTools(tools) : undefined,
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessageParts);

      console.log(`[Gemini] Stream started successfully`);

      let fullContent = '';
      const toolCalls: ToolCall[] = [];

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          onChunk?.({ type: 'text', content: text });
        }

        const functionCalls = chunk.functionCalls();
        if (functionCalls) {
          for (const fc of functionCalls) {
            const toolCall: ToolCall = {
              id: `gemini_${Date.now()}_${toolCalls.length}`,
              name: fc.name,
              arguments: fc.args as Record<string, unknown>,
            };
            toolCalls.push(toolCall);
            onChunk?.({ type: 'tool_call', toolCall });
          }
        }
      }

      onChunk?.({ type: 'done' });

      return {
        role: 'assistant',
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    }, 'chatStream');
  }
}
