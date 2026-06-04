// LLM Service Types

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'chart' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall | { id: string; name: string; arguments: string | Record<string, unknown> };
  chart?: unknown;
  error?: string;
}

export interface LLMProvider {
  chat(messages: Message[], tools?: Tool[]): Promise<Message>;
  chatStream(
    messages: Message[],
    tools?: Tool[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<Message>;
}

export interface ChatContext {
  userId: number;
  userRole: 'customer' | 'admin';
  userName: string;
}
