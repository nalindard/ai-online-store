import OpenAI from 'openai';
import type { LLMProvider, Message, Tool, StreamChunk, ToolCall } from './types.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  private toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId!,
        };
      }
      if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  private toOpenAITools(tools: Tool[]): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async chat(messages: Message[], tools?: Tool[]): Promise<Message> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.toOpenAIMessages(messages),
      tools: tools ? this.toOpenAITools(tools) : undefined,
    });

    const choice = response.choices[0];
    const message = choice.message;

    const result: Message = {
      role: 'assistant',
      content: message.content || '',
    };

    if (message.tool_calls && message.tool_calls.length > 0) {
      result.toolCalls = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));
    }

    return result;
  }

  async chatStream(
    messages: Message[],
    tools?: Tool[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<Message> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: this.toOpenAIMessages(messages),
      tools: tools ? this.toOpenAITools(tools) : undefined,
      stream: true,
    });

    let fullContent = '';
    const toolCalls: ToolCall[] = [];
    const toolCallBuffers: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullContent += delta.content;
        onChunk?.({ type: 'text', content: delta.content });
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallBuffers.has(tc.index)) {
            toolCallBuffers.set(tc.index, { id: '', name: '', arguments: '' });
          }
          const buffer = toolCallBuffers.get(tc.index)!;
          if (tc.id) buffer.id = tc.id;
          if (tc.function?.name) buffer.name = tc.function.name;
          if (tc.function?.arguments) buffer.arguments += tc.function.arguments;
        }
      }
    }

    // Process completed tool calls
    for (const [, buffer] of toolCallBuffers) {
      if (buffer.id && buffer.name) {
        const toolCall: ToolCall = {
          id: buffer.id,
          name: buffer.name,
          arguments: buffer.arguments ? JSON.parse(buffer.arguments) : {},
        };
        toolCalls.push(toolCall);
        onChunk?.({ type: 'tool_call', toolCall });
      }
    }

    onChunk?.({ type: 'done' });

    return {
      role: 'assistant',
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
