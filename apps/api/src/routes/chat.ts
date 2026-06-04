import { Router, type IRouter, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getChatService } from '../services/chat/ChatService.js';
import { getMCPChatService } from '../services/mcp/index.js';
import type { Message, ChatContext } from '../services/llm/types.js';

const router: IRouter = Router();

// All chat routes require authentication
router.use(authenticateToken);

// Store conversation history per user (in-memory for demo; use Redis/DB in production)
const conversationStore = new Map<number, Message[]>();

// POST /chat/message - Send a message and get streaming response
router.post('/message', async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { message, clearHistory } = req.body;

  console.log(`[ChatRoute] Received message from user ${user.userId}: ${message.substring(0, 50)}...`);

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Clear history if requested
  if (clearHistory) {
    conversationStore.delete(user.userId);
  }

  // Get or create conversation history
  let history = conversationStore.get(user.userId) || [];

  const context: ChatContext = {
    userId: user.userId,
    userRole: user.role as 'customer' | 'admin',
    userName: 'User', // Could fetch from DB if needed
  };

  try {
    const chatService = getChatService();
    let fullResponse = '';

    // Stream the response
    for await (const chunk of chatService.chatStream(message, context, history)) {
      switch (chunk.type) {
        case 'text':
          fullResponse += chunk.content || '';
          sendSSE(res, 'text', { content: chunk.content });
          break;
        case 'tool_call':
          sendSSE(res, 'tool', { 
            name: chunk.toolCall?.name,
            args: chunk.toolCall?.arguments 
          });
          break;
        case 'chart':
          // Send chart data to client for visualization
          sendSSE(res, 'chart', { chart: chunk.chart });
          break;
        case 'done':
          // Update conversation history
          history.push({ role: 'user', content: message });
          history.push({ role: 'assistant', content: fullResponse });
          
          // Keep only last 20 messages to prevent context overflow
          if (history.length > 20) {
            history = history.slice(-20);
          }
          conversationStore.set(user.userId, history);
          
          sendSSE(res, 'done', { messageId: Date.now().toString() });
          break;
        case 'error':
          sendSSE(res, 'error', { error: chunk.error });
          break;
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    sendSSE(res, 'error', { error: (error as Error).message });
    res.end();
  }
});

// POST /chat/simple - Non-streaming chat for simple requests
router.post('/simple', async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const history = conversationStore.get(user.userId) || [];

  const context: ChatContext = {
    userId: user.userId,
    userRole: user.role as 'customer' | 'admin',
    userName: 'User',
  };

  try {
    const chatService = getChatService();
    const response = await chatService.chat(message, context, history);

    // Update history
    const newHistory = [
      ...history,
      { role: 'user' as const, content: message },
      response,
    ].slice(-20);
    conversationStore.set(user.userId, newHistory);

    res.json({
      success: true,
      data: {
        message: response.content,
        messageId: Date.now().toString(),
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// DELETE /chat/history - Clear conversation history
router.delete('/history', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  conversationStore.delete(user.userId);
  res.json({ success: true, data: { message: 'Conversation history cleared' } });
});

// GET /chat/history - Get conversation history
router.get('/history', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const history = conversationStore.get(user.userId) || [];
  
  res.json({
    success: true,
    data: {
      messages: history.map((msg, index) => ({
        id: index.toString(),
        role: msg.role,
        content: msg.content,
      })),
    },
  });
});

// POST /chat/mcp/message - MCP-based streaming chat
router.post('/mcp/message', async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { message, clearHistory } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (clearHistory) {
    conversationStore.delete(user.userId);
  }

  let history = conversationStore.get(user.userId) || [];

  const context: ChatContext = {
    userId: user.userId,
    userRole: user.role as 'customer' | 'admin',
    userName: 'User',
  };

  try {
    const mcpChatService = getMCPChatService();
    let fullResponse = '';

    for await (const chunk of mcpChatService.chatStream(message, context, history)) {
      switch (chunk.type) {
        case 'text':
          fullResponse += chunk.content || '';
          sendSSE(res, 'text', { content: chunk.content });
          break;
        case 'tool_call':
          sendSSE(res, 'tool', { 
            name: chunk.toolCall?.name,
            args: chunk.toolCall?.arguments,
            source: 'mcp'
          });
          break;
        case 'tool_result':
          sendSSE(res, 'tool_result', {
            name: chunk.toolCall?.name,
            result: chunk.content
          });
          break;
        case 'done':
          history.push({ role: 'user', content: message });
          history.push({ role: 'assistant', content: fullResponse });
          if (history.length > 20) {
            history = history.slice(-20);
          }
          conversationStore.set(user.userId, history);
          sendSSE(res, 'done', { messageId: Date.now().toString() });
          break;
        case 'error':
          sendSSE(res, 'error', { error: chunk.error });
          break;
      }
    }

    res.end();
  } catch (error) {
    console.error('MCP Chat error:', error);
    sendSSE(res, 'error', { error: (error as Error).message });
    res.end();
  }
});

// GET /chat/mcp/status - Get MCP server connection status
router.get('/mcp/status', async (req: AuthRequest, res: Response) => {
  try {
    const mcpChatService = getMCPChatService();
    const status = await mcpChatService.getStatus();
    res.json({ success: true, data: { servers: status } });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get MCP status',
      details: (error as Error).message 
    });
  }
});

// GET /chat/mcp/tools - Get available MCP tools
router.get('/mcp/tools', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const mcpChatService = getMCPChatService();
    const tools = await mcpChatService.getAvailableTools(user.role === 'admin');
    res.json({ 
      success: true, 
      data: { 
        tools: tools.map(t => ({ name: t.name, description: t.description })),
        count: tools.length 
      } 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get MCP tools',
      details: (error as Error).message 
    });
  }
});

function sendSSE(res: Response, event: string, data: object) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default router;
