/**
 * MCP-enabled Chat Service
 * 
 * This service extends the chat capabilities by integrating with MCP servers
 * for tool execution. It provides the same interface as ChatService but
 * routes tool calls through MCP instead of direct function calls.
 */

import { createLLMProvider, type LLMProvider, type Message, type ChatContext, type StreamChunk, type Tool, type ToolCall } from '../llm/index.js';
import { getMCPManager, type MCPManager } from '../mcp/MCPClient.js';

const MAX_TOOL_ITERATIONS = 5;

export class MCPChatService {
  private llm: LLMProvider;
  private mcpManager: MCPManager | null = null;

  constructor(provider: 'openai' | 'gemini' = 'openai') {
    this.llm = createLLMProvider(provider);
  }

  private async ensureMCPConnected(): Promise<MCPManager> {
    if (!this.mcpManager) {
      this.mcpManager = await getMCPManager();
    }
    return this.mcpManager;
  }

  private getSystemPrompt(context: ChatContext): string {
    const basePrompt = `You are SmartShop AI, a helpful e-commerce assistant for the SmartShop platform.
Current user: ${context.userName} (${context.userRole})
Current date: ${new Date().toISOString().split('T')[0]}

You help users with:
- Finding and learning about products
- Tracking orders and order history
- Understanding their cart and spending
- Answering questions about the shop

Be concise, friendly, and helpful. When users ask about data (orders, products, spending, etc.), 
use the available tools to fetch real information. Present data clearly and in a user-friendly format.

When presenting product search results, format them nicely with name, price, and brief description.
When presenting order information, include status, total, and date.
When presenting spending analytics, summarize the key insights.

${context.userRole === 'admin' ? `
As an admin, you also have access to powerful analytics tools:
- Sales dashboards showing overall business metrics
- Revenue breakdown by category
- Top selling products analysis
- Inventory status and low stock alerts
- Sales trends and analytics over time

Help the admin understand business performance and make data-driven decisions.
Present data with clear formatting and highlight important insights.
` : ''}`;

    return basePrompt;
  }

  /**
   * Non-streaming chat - processes the message and returns a complete response
   */
  async chat(
    userMessage: string,
    context: ChatContext,
    conversationHistory: Message[] = []
  ): Promise<Message> {
    const mcp = await this.ensureMCPConnected();
    const tools = await mcp.getAllTools(context.userRole === 'admin');

    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt(context) },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    let iterations = 0;
    let currentMessages = [...messages];

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const response = await this.llm.chat(currentMessages, tools);

      // If no tool calls, return the response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return response;
      }

      // Execute tool calls via MCP
      currentMessages.push(response);

      for (const toolCall of response.toolCalls) {
        console.log(`[MCP] Calling tool: ${toolCall.name}`, toolCall.arguments);
        const result = await mcp.executeToolCall(toolCall);
        console.log(`[MCP] Tool result:`, result.substring(0, 200) + '...');

        currentMessages.push({
          role: 'tool',
          content: result,
          toolCallId: toolCall.id,
        });
      }
    }

    // If we hit max iterations, return whatever we have
    return {
      role: 'assistant',
      content: 'I apologize, but I encountered an issue processing your request. Please try again with a simpler question.',
    };
  }

  /**
   * Streaming chat - yields chunks as they come in
   * Uses callback-based streaming from LLM provider
   */
  async *chatStream(
    userMessage: string,
    context: ChatContext,
    conversationHistory: Message[] = []
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const mcp = await this.ensureMCPConnected();
    const tools = await mcp.getAllTools(context.userRole === 'admin');

    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt(context) },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    let iterations = 0;
    let currentMessages = [...messages];

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Collect chunks during streaming
      const chunks: StreamChunk[] = [];
      
      // Use the callback-based streaming
      const response = await this.llm.chatStream(currentMessages, tools, (chunk) => {
        chunks.push(chunk);
      });

      // Yield collected chunks
      for (const chunk of chunks) {
        yield chunk;
      }

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        yield { type: 'done' };
        return;
      }

      // Add assistant message with tool calls
      currentMessages.push(response);

      // Execute tool calls via MCP and add results
      for (const toolCall of response.toolCalls) {
        console.log(`[MCP Stream] Calling tool: ${toolCall.name}`);
        const result = await mcp.executeToolCall(toolCall);
        console.log(`[MCP Stream] Tool result:`, result.substring(0, 100) + '...');

        yield {
          type: 'tool_result',
          toolCall: toolCall,
          content: result,
        };

        currentMessages.push({
          role: 'tool',
          content: result,
          toolCallId: toolCall.id,
        });
      }
    }

    yield { type: 'done' };
  }

  /**
   * Get list of available tools for a user role
   */
  async getAvailableTools(isAdmin: boolean): Promise<Tool[]> {
    const mcp = await this.ensureMCPConnected();
    return mcp.getAllTools(isAdmin);
  }

  /**
   * Get MCP connection status
   */
  async getStatus(): Promise<Record<string, { connected: boolean; toolCount: number }>> {
    const mcp = await this.ensureMCPConnected();
    return mcp.getStatus();
  }
}

// Singleton instance
let mcpChatService: MCPChatService | null = null;

export function getMCPChatService(): MCPChatService {
  if (!mcpChatService) {
    const provider = (process.env.LLM_PROVIDER as 'openai' | 'gemini') || 'openai';
    mcpChatService = new MCPChatService(provider);
  }
  return mcpChatService;
}
