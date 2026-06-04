/**
 * MCP Client
 * 
 * This module provides a client for connecting to and managing MCP servers.
 * It handles spawning MCP server processes and communicating with them.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, type Subprocess } from 'bun';
import type { Tool, ToolCall } from '../llm/types.js';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  adminOnly?: boolean; // If true, only available to admin users
}

export interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  process: Subprocess;
  config: MCPServerConfig;
}

export class MCPManager {
  private connections: Map<string, MCPConnection> = new Map();
  private toolToServer: Map<string, string> = new Map();

  constructor(private configs: MCPServerConfig[]) {}

  /**
   * Connect to all configured MCP servers
   */
  async connectAll(): Promise<void> {
    await Promise.all(this.configs.map(config => this.connect(config)));
  }

  /**
   * Connect to a single MCP server
   */
  async connect(config: MCPServerConfig): Promise<MCPConnection> {
    console.log(`Connecting to MCP server: ${config.name}`);

    // Spawn the MCP server process
    const proc = spawn({
      cmd: [config.command, ...config.args],
      env: { ...process.env, ...config.env },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
    });

    // Create transport and client
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    const client = new Client(
      {
        name: 'smartshop-api',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    const connection: MCPConnection = {
      client,
      transport,
      process: proc,
      config,
    };

    this.connections.set(config.name, connection);

    // Map tools to servers
    const { tools } = await client.listTools();
    for (const tool of tools) {
      this.toolToServer.set(tool.name, config.name);
    }

    console.log(`Connected to ${config.name}, registered ${tools.length} tools`);
    return connection;
  }

  /**
   * Get all available tools from all connected servers
   * @param isAdmin - If true, include admin-only tools
   */
  async getAllTools(isAdmin: boolean = false): Promise<Tool[]> {
    const allTools: Tool[] = [];

    for (const [serverName, connection] of this.connections) {
      // Skip admin-only servers for non-admin users
      if (connection.config.adminOnly && !isAdmin) {
        continue;
      }

      const { tools } = await connection.client.listTools();
      for (const tool of tools) {
        allTools.push({
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema as any,
        });
      }
    }

    return allTools;
  }

  /**
   * Call a tool by name
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<string> {
    const serverName = this.toolToServer.get(toolName);
    if (!serverName) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Extract text content from the result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        return textContent.text;
      }
    }

    return JSON.stringify(result);
  }

  /**
   * Execute a tool call (from LLM)
   */
  async executeToolCall(toolCall: ToolCall): Promise<string> {
    try {
      const args = typeof toolCall.arguments === 'string'
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;
      
      return await this.callTool(toolCall.name, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({ error: message });
    }
  }

  /**
   * Check if a tool is available
   */
  hasTool(toolName: string): boolean {
    return this.toolToServer.has(toolName);
  }

  /**
   * Get server name for a tool
   */
  getServerForTool(toolName: string): string | undefined {
    return this.toolToServer.get(toolName);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    for (const [name, connection] of this.connections) {
      try {
        await connection.client.close();
        connection.process.kill();
        console.log(`Disconnected from ${name}`);
      } catch (error) {
        console.error(`Error disconnecting from ${name}:`, error);
      }
    }
    this.connections.clear();
    this.toolToServer.clear();
  }

  /**
   * Get connection status
   */
  getStatus(): Record<string, { connected: boolean; toolCount: number }> {
    const status: Record<string, { connected: boolean; toolCount: number }> = {};
    
    for (const [name, connection] of this.connections) {
      const tools = [...this.toolToServer.entries()]
        .filter(([_, server]) => server === name)
        .length;
      
      status[name] = {
        connected: true,
        toolCount: tools,
      };
    }

    return status;
  }
}

// Default server configurations
export function getDefaultMCPConfigs(): MCPServerConfig[] {
  const basePath = process.cwd().includes('apps/api') 
    ? '../../mcp-servers' 
    : './mcp-servers';

  return [
    {
      name: 'products',
      command: 'bun',
      args: [`${basePath}/products/src/index.ts`],
      adminOnly: false,
    },
    {
      name: 'orders',
      command: 'bun',
      args: [`${basePath}/orders/src/index.ts`],
      adminOnly: false,
    },
    {
      name: 'analytics',
      command: 'bun',
      args: [`${basePath}/analytics/src/index.ts`],
      adminOnly: true, // Only admin users can access analytics
    },
  ];
}

// Singleton instance
let mcpManager: MCPManager | null = null;

export async function getMCPManager(): Promise<MCPManager> {
  if (!mcpManager) {
    const configs = getDefaultMCPConfigs();
    mcpManager = new MCPManager(configs);
    await mcpManager.connectAll();
  }
  return mcpManager;
}

export async function shutdownMCP(): Promise<void> {
  if (mcpManager) {
    await mcpManager.disconnectAll();
    mcpManager = null;
  }
}
