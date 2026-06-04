import { createLLMProvider, type LLMProvider, type Message, type ChatContext, type StreamChunk } from '../llm/index.js';
import { getToolsForRole, executeTool } from './tools.js';

const MAX_TOOL_ITERATIONS = 5;

export class ChatService {
  private llm: LLMProvider;

  constructor(provider: 'openai' | 'gemini' = 'openai') {
    this.llm = createLLMProvider(provider);
  }

  private getSystemPrompt(context: ChatContext): string {
    const basePrompt = `You are SmartShop AI, a helpful e-commerce assistant for the SmartShop platform.
Current user: ${context.userName} (${context.userRole})
Current date: ${new Date().toISOString().split('T')[0]}

You help users with:
- Finding and learning about products
- Tracking orders and order history
- Understanding their cart
- Answering questions about the shop

Be concise, friendly, and helpful. When users ask about data (orders, products, spending, etc.), 
use the available tools to fetch real information. Present data clearly.

When presenting product search results, format them nicely with name, price, and brief description.
When presenting order information, include status, total, and date.
When presenting spending analytics, summarize the key insights.

${context.userRole === 'admin' ? `
As an admin, you also have access to:
- Sales dashboards and analytics
- Inventory management insights  
- Revenue reports by category
- Top selling products

Help the admin understand business performance and make data-driven decisions.
` : ''}`;

    return basePrompt;
  }

  async chat(
    userMessage: string,
    context: ChatContext,
    conversationHistory: Message[] = []
  ): Promise<Message> {
    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt(context) },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const tools = getToolsForRole(context.userRole);
    let response = await this.llm.chat(messages, tools);

    // Handle tool calls
    let iterations = 0;
    while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      
      // Add assistant message with tool calls
      messages.push(response);

      // Execute each tool and add results
      for (const toolCall of response.toolCalls) {
        const result = await executeTool(toolCall.name, toolCall.arguments, context);
        messages.push({
          role: 'tool',
          content: result.content,
          toolCallId: toolCall.id,
        });
      }

      // Get next response
      response = await this.llm.chat(messages, tools);
    }

    return response;
  }

  async *chatStream(
    userMessage: string,
    context: ChatContext,
    conversationHistory: Message[] = []
  ): AsyncGenerator<StreamChunk> {
    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt(context) },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const tools = getToolsForRole(context.userRole);
    
    let iterations = 0;
    let hasToolCalls = true;

    while (hasToolCalls && iterations < MAX_TOOL_ITERATIONS) {
      console.log(`[ChatService] Iteration ${iterations + 1}/${MAX_TOOL_ITERATIONS}, History length: ${messages.length}`);
      hasToolCalls = false;
      iterations++;

      const chunks: StreamChunk[] = [];
      const response = await this.llm.chatStream(messages, tools, (chunk) => {
        chunks.push(chunk);
      });

      // Yield text chunks
      for (const chunk of chunks) {
        if (chunk.type === 'text') {
          yield chunk;
        }
      }

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        hasToolCalls = true;
        messages.push(response);

        for (const toolCall of response.toolCalls) {
          yield { type: 'tool_call', toolCall };
          
          const result = await executeTool(toolCall.name, toolCall.arguments, context);
          
          // Check if result contains chart data and yield it
          if (result.chart) {
            yield { type: 'chart', chart: result.chart };
          }
          
          messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: toolCall.id,
          });
        }
      }
    }

    yield { type: 'done' };
  }
}

// Singleton instance
let chatService: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatService) {
    // Determine provider from environment
    const provider = (process.env.LLM_PROVIDER as 'openai' | 'gemini') || 'openai';
    chatService = new ChatService(provider);
  }
  return chatService;
}
