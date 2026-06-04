/**
 * Analytics MCP Server - HTTP/SSE Transport (Admin Only)
 * 
 * A standalone web server providing MCP tools for admin analytics.
 * Runs on port 3012 by default.
 * 
 * Tools:
 * - get_sales_dashboard: Overall sales metrics and KPIs
 * - get_sales_analytics: Detailed sales breakdown by period
 * - get_top_products: Best selling products
 * - get_revenue_by_category: Revenue breakdown by product category
 * - get_inventory_status: Stock levels and low stock alerts
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
const PORT = process.env.MCP_ANALYTICS_PORT || 3012;
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
    name: 'get_sales_dashboard',
    description: 'Get an overview dashboard of sales metrics including total revenue, order count, average order value, and trends. Admin only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'year', 'all'],
          description: 'Time period for the dashboard (default: month)',
        },
      },
    },
  },
  {
    name: 'get_sales_analytics',
    description: 'Get detailed sales analytics with breakdown by day, week, or month. Admin only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        granularity: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'How to group the data (default: day)',
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
    },
  },
  {
    name: 'get_top_products',
    description: 'Get the top selling products by revenue or quantity. Admin only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of products to return (default: 10)',
        },
        sortBy: {
          type: 'string',
          enum: ['revenue', 'quantity'],
          description: 'Sort by revenue or quantity sold (default: revenue)',
        },
        period: {
          type: 'string',
          enum: ['week', 'month', 'year', 'all'],
          description: 'Time period (default: month)',
        },
      },
    },
  },
  {
    name: 'get_revenue_by_category',
    description: 'Get revenue breakdown by product category. Admin only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'year', 'all'],
          description: 'Time period (default: month)',
        },
      },
    },
  },
  {
    name: 'get_inventory_status',
    description: 'Get inventory status including stock levels, low stock alerts, and out-of-stock products. Admin only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        lowStockThreshold: {
          type: 'number',
          description: 'Threshold for low stock alert (default: 10)',
        },
      },
    },
  },
];

// Helper: get date filter
function getDateFilter(period?: string): string {
  switch (period) {
    case 'today':
      return ` AND date(o.created_at) = date('now')`;
    case 'week':
      return ` AND o.created_at >= date('now', '-7 days')`;
    case 'month':
      return ` AND o.created_at >= date('now', '-30 days')`;
    case 'year':
      return ` AND o.created_at >= date('now', '-365 days')`;
    default:
      return '';
  }
}

// Tool implementations
function getSalesDashboard(args: { period?: string }): string {
  const db = getDatabase();
  const period = args.period || 'month';
  const dateFilter = getDateFilter(period);

  const metrics = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_revenue,
      COALESCE(AVG(total), 0) as avg_order_value,
      COUNT(DISTINCT user_id) as unique_customers
    FROM orders o
    WHERE 1=1 ${dateFilter}
  `).get() as any;

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM orders o
    WHERE 1=1 ${dateFilter}
    GROUP BY status
  `).all();

  const previousPeriodFilter = period === 'month' 
    ? ` AND o.created_at >= date('now', '-60 days') AND o.created_at < date('now', '-30 days')`
    : period === 'week'
    ? ` AND o.created_at >= date('now', '-14 days') AND o.created_at < date('now', '-7 days')`
    : '';

  let previousRevenue = 0;
  if (previousPeriodFilter) {
    const prev = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue
      FROM orders o
      WHERE 1=1 ${previousPeriodFilter}
    `).get() as any;
    previousRevenue = prev.revenue;
  }

  const revenueChange = previousRevenue > 0 
    ? ((metrics.total_revenue - previousRevenue) / previousRevenue * 100).toFixed(1)
    : null;

  return JSON.stringify({
    period,
    metrics: {
      totalRevenue: `$${metrics.total_revenue.toFixed(2)}`,
      totalOrders: metrics.total_orders,
      averageOrderValue: `$${metrics.avg_order_value.toFixed(2)}`,
      uniqueCustomers: metrics.unique_customers,
      revenueChange: revenueChange ? `${revenueChange}%` : 'N/A',
    },
    ordersByStatus: byStatus.reduce((acc: any, s: any) => {
      acc[s.status] = s.count;
      return acc;
    }, {}),
  });
}

function getSalesAnalytics(args: { granularity?: string; startDate?: string; endDate?: string }): string {
  const db = getDatabase();
  const granularity = args.granularity || 'day';

  let dateFormat: string;
  switch (granularity) {
    case 'week':
      dateFormat = '%Y-W%W';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  let sql = `
    SELECT 
      strftime('${dateFormat}', created_at) as period,
      COUNT(*) as orders,
      SUM(total) as revenue,
      AVG(total) as avg_order
    FROM orders o
    WHERE 1=1
  `;
  const params: any[] = [];

  if (args.startDate) {
    sql += ` AND o.created_at >= ?`;
    params.push(args.startDate);
  }
  if (args.endDate) {
    sql += ` AND o.created_at <= ?`;
    params.push(args.endDate + ' 23:59:59');
  }

  sql += ` GROUP BY strftime('${dateFormat}', created_at) ORDER BY period DESC LIMIT 30`;

  const data = db.prepare(sql).all(...params);

  return JSON.stringify({
    granularity,
    dateRange: {
      start: args.startDate || 'all time',
      end: args.endDate || 'now',
    },
    data: data.map((d: any) => ({
      period: d.period,
      orders: d.orders,
      revenue: `$${d.revenue.toFixed(2)}`,
      averageOrder: `$${d.avg_order.toFixed(2)}`,
    })),
  });
}

function getTopProducts(args: { limit?: number; sortBy?: string; period?: string }): string {
  const db = getDatabase();
  const limit = args.limit || 10;
  const sortBy = args.sortBy || 'revenue';
  const dateFilter = getDateFilter(args.period);

  const orderByClause = sortBy === 'quantity' 
    ? 'total_quantity DESC'
    : 'total_revenue DESC';

  const products = db.prepare(`
    SELECT 
      p.id,
      p.name,
      p.price,
      p.stock,
      c.name as category,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.quantity * oi.price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1 ${dateFilter}
    GROUP BY p.id
    ORDER BY ${orderByClause}
    LIMIT ?
  `).all(limit);

  return JSON.stringify({
    period: args.period || 'all time',
    sortedBy: sortBy,
    products: products.map((p: any, index: number) => ({
      rank: index + 1,
      productId: p.id,
      name: p.name,
      category: p.category,
      currentPrice: `$${p.price.toFixed(2)}`,
      currentStock: p.stock,
      unitsSold: p.total_quantity,
      totalRevenue: `$${p.total_revenue.toFixed(2)}`,
    })),
  });
}

function getRevenueByCategory(args: { period?: string }): string {
  const db = getDatabase();
  const dateFilter = getDateFilter(args.period);

  const categories = db.prepare(`
    SELECT 
      c.name as category,
      COUNT(DISTINCT o.id) as order_count,
      SUM(oi.quantity) as units_sold,
      SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE 1=1 ${dateFilter}
    GROUP BY c.id
    ORDER BY revenue DESC
  `).all();

  const totalRevenue = categories.reduce((sum: number, c: any) => sum + c.revenue, 0);

  return JSON.stringify({
    period: args.period || 'all time',
    totalRevenue: `$${totalRevenue.toFixed(2)}`,
    categories: categories.map((c: any) => ({
      category: c.category,
      revenue: `$${c.revenue.toFixed(2)}`,
      percentage: `${(c.revenue / totalRevenue * 100).toFixed(1)}%`,
      orderCount: c.order_count,
      unitsSold: c.units_sold,
    })),
  });
}

function getInventoryStatus(args: { lowStockThreshold?: number }): string {
  const db = getDatabase();
  const threshold = args.lowStockThreshold || 10;

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_products,
      SUM(stock) as total_units,
      SUM(stock * price) as inventory_value,
      SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
      SUM(CASE WHEN stock > 0 AND stock <= ? THEN 1 ELSE 0 END) as low_stock
    FROM products
  `).get(threshold) as any;

  const lowStockProducts = db.prepare(`
    SELECT p.id, p.name, p.stock, p.price, c.name as category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= ?
    ORDER BY p.stock ASC
    LIMIT 20
  `).all(threshold);

  const byCategory = db.prepare(`
    SELECT 
      c.name as category,
      COUNT(*) as products,
      SUM(p.stock) as total_stock,
      SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END) as out_of_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY total_stock DESC
  `).all();

  return JSON.stringify({
    summary: {
      totalProducts: stats.total_products,
      totalUnits: stats.total_units,
      inventoryValue: `$${stats.inventory_value.toFixed(2)}`,
      outOfStock: stats.out_of_stock,
      lowStock: stats.low_stock,
      lowStockThreshold: threshold,
    },
    alerts: lowStockProducts.map((p: any) => ({
      productId: p.id,
      name: p.name,
      stock: p.stock,
      status: p.stock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      category: p.category,
      value: `$${(p.stock * p.price).toFixed(2)}`,
    })),
    byCategory: byCategory.map((c: any) => ({
      category: c.category,
      productCount: c.products,
      totalStock: c.total_stock,
      outOfStock: c.out_of_stock,
    })),
  });
}

// Create MCP Server
function createMCPServer(): Server {
  const server = new Server(
    { name: 'smartshop-analytics-mcp', version: '1.0.0' },
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
        case 'get_sales_dashboard':
          result = getSalesDashboard(args as any);
          break;
        case 'get_sales_analytics':
          result = getSalesAnalytics(args as any);
          break;
        case 'get_top_products':
          result = getTopProducts(args as any);
          break;
        case 'get_revenue_by_category':
          result = getRevenueByCategory(args as any);
          break;
        case 'get_inventory_status':
          result = getInventoryStatus(args as any);
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
  res.json({ status: 'ok', server: 'mcp-analytics', port: PORT });
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
      case 'get_sales_dashboard':
        result = getSalesDashboard(args);
        break;
      case 'get_sales_analytics':
        result = getSalesAnalytics(args);
        break;
      case 'get_top_products':
        result = getTopProducts(args);
        break;
      case 'get_revenue_by_category':
        result = getRevenueByCategory(args);
        break;
      case 'get_inventory_status':
        result = getInventoryStatus(args);
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
  📊 Analytics MCP Server (Admin)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ HTTP Server: http://localhost:${PORT}
  📡 SSE Endpoint: http://localhost:${PORT}/sse
  🔧 REST API: http://localhost:${PORT}/tools/:toolName
  
  Available tools:
  • get_sales_dashboard
  • get_sales_analytics
  • get_top_products
  • get_revenue_by_category
  • get_inventory_status
  `);
});
