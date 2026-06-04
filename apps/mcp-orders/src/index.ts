/**
 * Orders MCP Server - HTTP/SSE Transport
 * 
 * A standalone web server providing MCP tools for order operations.
 * Runs on port 3011 by default.
 * 
 * Tools:
 * - get_customer_orders: Get orders for a specific customer
 * - get_order_details: Get detailed information about an order
 * - get_order_history: Get order history with date filters
 * - get_customer_spending: Get spending analytics for a customer
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Database } from 'bun:sqlite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.MCP_ORDERS_PORT || 3011;
const DB_PATH = process.env.DATABASE_PATH || resolve(__dirname, '../../api/data/smartshop.db');

// Database connection
let db: Database;

function getDatabase(): Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

// Tool definitions
const TOOLS = [
  {
    name: 'get_customer_orders',
    description: 'Get all orders for a specific customer. Can optionally filter by status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        customerId: {
          type: 'number',
          description: 'The customer (user) ID',
        },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
          description: 'Optional order status filter',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders (default: 10)',
        },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'get_order_details',
    description: 'Get detailed information about a specific order including all items.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        orderId: {
          type: 'number',
          description: 'The order ID',
        },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'get_order_history',
    description: 'Get order history for a customer within a date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        customerId: {
          type: 'number',
          description: 'The customer (user) ID',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'get_customer_spending',
    description: 'Get spending analytics for a customer including total spent, average order value, and spending by category.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        customerId: {
          type: 'number',
          description: 'The customer (user) ID',
        },
        period: {
          type: 'string',
          enum: ['week', 'month', 'year', 'all'],
          description: 'Time period for analytics (default: all)',
        },
      },
      required: ['customerId'],
    },
  },
];

// Tool implementations
function getCustomerOrders(args: { customerId: number; status?: string; limit?: number }): string {
  const db = getDatabase();
  const limit = args.limit || 10;

  let sql = `
    SELECT o.id, o.status, o.total, o.created_at,
           COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ?
  `;
  const params: any[] = [args.customerId];

  if (args.status) {
    sql += ` AND o.status = ?`;
    params.push(args.status);
  }

  sql += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT ?`;
  params.push(limit);

  const orders = db.prepare(sql).all(...params);

  if (orders.length === 0) {
    return JSON.stringify({ 
      message: args.status 
        ? `No ${args.status} orders found for this customer.` 
        : 'No orders found for this customer.',
      orders: [] 
    });
  }

  return JSON.stringify({
    count: orders.length,
    orders: orders.map((o: any) => ({
      orderId: o.id,
      status: o.status,
      total: `$${o.total.toFixed(2)}`,
      itemCount: o.item_count,
      date: o.created_at,
    })),
  });
}

function getOrderDetails(args: { orderId: number }): string {
  const db = getDatabase();

  const order = db.prepare(`
    SELECT o.*, u.email as customer_email
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).get(args.orderId) as any;

  if (!order) {
    return JSON.stringify({ error: `Order with ID ${args.orderId} not found.` });
  }

  const items = db.prepare(`
    SELECT oi.quantity, oi.price, p.name, p.id as product_id
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(args.orderId);

  return JSON.stringify({
    orderId: order.id,
    status: order.status,
    total: `$${order.total.toFixed(2)}`,
    customer: order.customer_email,
    createdAt: order.created_at,
    shippingAddress: order.shipping_address,
    items: items.map((item: any) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: `$${item.price.toFixed(2)}`,
      subtotal: `$${(item.price * item.quantity).toFixed(2)}`,
    })),
  });
}

function getOrderHistory(args: { customerId: number; startDate?: string; endDate?: string }): string {
  const db = getDatabase();

  let sql = `
    SELECT o.id, o.status, o.total, o.created_at,
           strftime('%Y-%m', o.created_at) as month
    FROM orders o
    WHERE o.user_id = ?
  `;
  const params: any[] = [args.customerId];

  if (args.startDate) {
    sql += ` AND o.created_at >= ?`;
    params.push(args.startDate);
  }

  if (args.endDate) {
    sql += ` AND o.created_at <= ?`;
    params.push(args.endDate + ' 23:59:59');
  }

  sql += ` ORDER BY o.created_at DESC`;

  const orders = db.prepare(sql).all(...params);

  const byMonth: Record<string, any[]> = {};
  let totalSpent = 0;
  orders.forEach((o: any) => {
    if (!byMonth[o.month]) byMonth[o.month] = [];
    byMonth[o.month].push(o);
    totalSpent += o.total;
  });

  return JSON.stringify({
    customerId: args.customerId,
    dateRange: {
      start: args.startDate || 'beginning',
      end: args.endDate || 'now',
    },
    totalOrders: orders.length,
    totalSpent: `$${totalSpent.toFixed(2)}`,
    byMonth: Object.entries(byMonth).map(([month, monthOrders]) => ({
      month,
      orderCount: monthOrders.length,
      total: `$${monthOrders.reduce((sum: number, o: any) => sum + o.total, 0).toFixed(2)}`,
    })),
  });
}

function getCustomerSpending(args: { customerId: number; period?: string }): string {
  const db = getDatabase();
  const period = args.period || 'all';

  let dateFilter = '';
  const now = new Date();
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateFilter = ` AND o.created_at >= '${weekAgo.toISOString().split('T')[0]}'`;
  } else if (period === 'month') {
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    dateFilter = ` AND o.created_at >= '${monthAgo.toISOString().split('T')[0]}'`;
  } else if (period === 'year') {
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    dateFilter = ` AND o.created_at >= '${yearAgo.toISOString().split('T')[0]}'`;
  }

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total), 0) as total_spent,
      COALESCE(AVG(total), 0) as avg_order
    FROM orders o
    WHERE user_id = ? ${dateFilter}
  `).get(args.customerId) as any;

  const byCategory = db.prepare(`
    SELECT 
      c.name as category,
      SUM(oi.quantity * oi.price) as amount,
      COUNT(DISTINCT o.id) as orders
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE o.user_id = ? ${dateFilter}
    GROUP BY c.id
    ORDER BY amount DESC
  `).all(args.customerId);

  const recentOrders = db.prepare(`
    SELECT id, total, status, created_at
    FROM orders
    WHERE user_id = ? ${dateFilter}
    ORDER BY created_at DESC
    LIMIT 5
  `).all(args.customerId);

  return JSON.stringify({
    customerId: args.customerId,
    period,
    summary: {
      totalOrders: summary.order_count,
      totalSpent: `$${summary.total_spent.toFixed(2)}`,
      averageOrderValue: `$${summary.avg_order.toFixed(2)}`,
    },
    spendingByCategory: byCategory.map((c: any) => ({
      category: c.category,
      amount: `$${c.amount.toFixed(2)}`,
      orderCount: c.orders,
    })),
    recentOrders: recentOrders.map((o: any) => ({
      orderId: o.id,
      total: `$${o.total.toFixed(2)}`,
      status: o.status,
      date: o.created_at,
    })),
  });
}

// Create MCP Server
function createMCPServer(): Server {
  const server = new Server(
    { name: 'smartshop-orders-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'get_customer_orders':
          result = getCustomerOrders(args as any);
          break;
        case 'get_order_details':
          result = getOrderDetails(args as any);
          break;
        case 'get_order_history':
          result = getOrderHistory(args as any);
          break;
        case 'get_customer_spending':
          result = getCustomerSpending(args as any);
          break;
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  return server;
}

// Express app with SSE transport
const app = express();
app.use(cors());
app.use(express.json());

const transports = new Map<string, SSEServerTransport>();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'mcp-orders', port: PORT });
});

app.get('/sse', async (req, res) => {
  console.log('New SSE connection');
  
  const transport = new SSEServerTransport('/message', res);
  const sessionId = Date.now().toString();
  transports.set(sessionId, transport);

  const server = createMCPServer();
  await server.connect(transport);

  res.on('close', () => {
    console.log('SSE connection closed');
    transports.delete(sessionId);
  });
});

app.post('/message', async (req, res) => {
  const transport = Array.from(transports.values())[0];
  if (!transport) {
    return res.status(400).json({ error: 'No active SSE connection' });
  }
  await transport.handlePostMessage(req, res);
});

// Direct REST API
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    let result: string;

    switch (toolName) {
      case 'get_customer_orders':
        result = getCustomerOrders(args);
        break;
      case 'get_order_details':
        result = getOrderDetails(args);
        break;
      case 'get_order_history':
        result = getOrderHistory(args);
        break;
      case 'get_customer_spending':
        result = getCustomerSpending(args);
        break;
      default:
        return res.status(404).json({ error: `Unknown tool: ${toolName}` });
    }

    res.json(JSON.parse(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

app.get('/tools', (req, res) => {
  res.json({ tools: TOOLS });
});

app.listen(PORT, () => {
  console.log(`
  📦 Orders MCP Server
  ━━━━━━━━━━━━━━━━━━━━━
  ✅ HTTP Server: http://localhost:${PORT}
  📡 SSE Endpoint: http://localhost:${PORT}/sse
  🔧 REST API: http://localhost:${PORT}/tools/:toolName
  
  Available tools:
  • get_customer_orders
  • get_order_details
  • get_order_history
  • get_customer_spending
  `);
});
