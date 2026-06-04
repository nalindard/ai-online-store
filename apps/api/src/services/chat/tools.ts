import { db } from '../../db/index.js';
import type { Tool, ToolResult, ChatContext } from '../llm/types.js';
import { getRAGQueryEngine, getVectorStore } from '../rag/index.js';

// Tool definitions for customer and admin
export const customerTools: Tool[] = [
  {
    name: 'semantic_search_products',
    description: 'Perform intelligent semantic search for products. Use this when the user asks natural language questions about products, looking for recommendations, or when keyword search might miss relevant results.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "something to listen to music while running")',
        },
        category: {
          type: 'string',
          description: 'Optional category filter',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_products',
    description: 'Search for products in the catalog by name, description, or category',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find products',
        },
        category: {
          type: 'string',
          description: 'Filter by category name',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price filter',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product including reviews',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'number',
          description: 'The ID of the product',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'get_my_orders',
    description: 'Get the current user\'s order history',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by order status',
          enum: ['pending', 'confirmed', 'shipped', 'delivered'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return (default 10)',
        },
      },
    },
  },
  {
    name: 'get_order_details',
    description: 'Get details of a specific order',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'number',
          description: 'The ID of the order',
        },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'get_my_cart',
    description: 'Get the current items in the user\'s shopping cart',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_my_spending',
    description: 'Get the user\'s spending summary and analytics',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze (default 30)',
        },
      },
    },
  },
];

export const adminTools: Tool[] = [
  ...customerTools,
  {
    name: 'get_sales_dashboard',
    description: 'Get overall sales statistics and dashboard data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_sales_analytics',
    description: 'Get sales data over time for analysis. Returns data suitable for charts.',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days of data to retrieve (default 30)',
        },
        includeChart: {
          type: 'boolean',
          description: 'Whether to generate a chart visualization (default true)',
        },
      },
    },
  },
  {
    name: 'get_top_products',
    description: 'Get the top selling products. Can include a chart visualization.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of top products to return (default 10)',
        },
        includeChart: {
          type: 'boolean',
          description: 'Whether to generate a chart visualization (default false)',
        },
      },
    },
  },
  {
    name: 'get_inventory_status',
    description: 'Get inventory levels, optionally filtered by low stock',
    parameters: {
      type: 'object',
      properties: {
        lowStockThreshold: {
          type: 'number',
          description: 'Threshold to consider as low stock (default 10)',
        },
      },
    },
  },
  {
    name: 'get_revenue_by_category',
    description: 'Get revenue breakdown by product category. Can include a pie chart visualization.',
    parameters: {
      type: 'object',
      properties: {
        includeChart: {
          type: 'boolean',
          description: 'Whether to generate a pie chart visualization (default true)',
        },
      },
    },
  },
];

export function getToolsForRole(role: 'customer' | 'admin'): Tool[] {
  return role === 'admin' ? adminTools : customerTools;
}

// Extended ToolResult that can include chart data
export interface ExtendedToolResult {
  toolCallId: string;
  content: string;
  chart?: unknown;
}

// Tool execution
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ChatContext
): Promise<ExtendedToolResult> {
  const toolCallId = `tool_${Date.now()}`;

  try {
    const result = await executeToolInternal(toolName, args, context);
    
    // Extract chart if present in result
    let chart: unknown = undefined;
    if (result && typeof result === 'object' && 'chart' in result) {
      chart = (result as { chart: unknown }).chart;
    }
    
    return {
      toolCallId,
      content: JSON.stringify(result, null, 2),
      chart,
    };
  } catch (error) {
    return {
      toolCallId,
      content: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

async function executeToolInternal(
  toolName: string,
  args: Record<string, unknown>,
  context: ChatContext
): Promise<unknown> {
  switch (toolName) {
    case 'semantic_search_products':
      return semanticSearchProducts(args);
    case 'search_products':
      return searchProducts(args);
    case 'get_product_details':
      return getProductDetails(args.productId as number);
    case 'get_my_orders':
      return getMyOrders(context.userId, args);
    case 'get_order_details':
      return getOrderDetails(context.userId, args.orderId as number);
    case 'get_my_cart':
      return getMyCart(context.userId);
    case 'get_my_spending':
      return getMySpending(context.userId, args.days as number);
    case 'get_sales_dashboard':
      if (context.userRole !== 'admin') throw new Error('Admin only');
      return getSalesDashboard();
    case 'get_sales_analytics':
      if (context.userRole !== 'admin') throw new Error('Admin only');
      return getSalesAnalytics(args.days as number, args.includeChart as boolean);
    case 'get_top_products':
      if (context.userRole !== 'admin') throw new Error('Admin only');
      return getTopProducts(args.limit as number, args.includeChart as boolean);
    case 'get_inventory_status':
      if (context.userRole !== 'admin') throw new Error('Admin only');
      return getInventoryStatus(args.lowStockThreshold as number);
    case 'get_revenue_by_category':
      if (context.userRole !== 'admin') throw new Error('Admin only');
      return getRevenueByCategory(args.includeChart as boolean);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Tool implementations

// Semantic search using RAG (embeddings-based)
async function semanticSearchProducts(args: Record<string, unknown>) {
  const query = args.query as string;
  const category = args.category as string | undefined;
  const limit = (args.limit as number) || 5;

  try {
    const vectorStore = getVectorStore();
    
    // Check if vector store has data
    if (vectorStore.count() === 0) {
      // Fall back to regular search if no embeddings
      return {
        message: 'Semantic search not available (no embeddings loaded). Using keyword search.',
        results: await searchProducts(args),
      };
    }

    const ragEngine = getRAGQueryEngine();
    
    // Build filter if category specified
    const filter = category ? { category } : undefined;
    
    const result = await ragEngine.search(query, limit, filter);
    
    return {
      query: result.query,
      resultCount: result.results.length,
      products: result.results.map(r => ({
        id: r.metadata.productId,
        name: r.metadata.name,
        category: r.metadata.category,
        price: r.metadata.price,
        inStock: r.metadata.inStock,
        relevanceScore: (r.score * 100).toFixed(1) + '%',
      })),
      context: result.context,
    };
  } catch (error) {
    // Fall back to keyword search on error
    console.error('Semantic search error:', error);
    return {
      message: 'Semantic search failed, using keyword search.',
      results: await searchProducts(args),
    };
  }
}

// Keyword-based search (original)
function searchProducts(args: Record<string, unknown>) {
  const query = args.query as string;
  const category = args.category as string | undefined;
  const maxPrice = args.maxPrice as number | undefined;
  const limit = (args.limit as number) || 5;

  let sql = `
    SELECT p.id, p.name, p.description, p.price, p.stock, c.name as category
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE (p.name LIKE ? OR p.description LIKE ?)
  `;
  const params: (string | number)[] = [`%${query}%`, `%${query}%`];

  if (category) {
    sql += ' AND c.name = ?';
    params.push(category);
  }
  if (maxPrice) {
    sql += ' AND p.price <= ?';
    params.push(maxPrice);
  }

  sql += ' LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

function getProductDetails(productId: number) {
  const product = db.prepare(`
    SELECT p.*, c.name as category
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(productId);

  if (!product) throw new Error('Product not found');

  const reviews = db.prepare(`
    SELECT r.rating, r.comment, u.name as user_name, r.created_at
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
    LIMIT 5
  `).all(productId);

  return { ...product, reviews };
}

function getMyOrders(userId: number, args: Record<string, unknown>) {
  const status = args.status as string | undefined;
  const limit = (args.limit as number) || 10;

  let sql = `
    SELECT o.id, o.status, o.total, o.created_at,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
    FROM orders o
    WHERE o.user_id = ?
  `;
  const params: (string | number)[] = [userId];

  if (status) {
    sql += ' AND o.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY o.created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

function getOrderDetails(userId: number, orderId: number) {
  const order = db.prepare(`
    SELECT o.* FROM orders o WHERE o.id = ? AND o.user_id = ?
  `).get(orderId, userId);

  if (!order) throw new Error('Order not found');

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(orderId);

  return { ...(order as object), items };
}

function getMyCart(userId: number) {
  return db.prepare(`
    SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.stock
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.user_id = ?
  `).all(userId);
}

function getMySpending(userId: number, days = 30) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_spent,
      COALESCE(AVG(total), 0) as avg_order_value
    FROM orders
    WHERE user_id = ? AND created_at >= ?
  `).get(userId, dateLimit.toISOString());

  const byCategory = db.prepare(`
    SELECT c.name as category, SUM(oi.price * oi.quantity) as spent
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE o.user_id = ? AND o.created_at >= ?
    GROUP BY c.id
    ORDER BY spent DESC
  `).all(userId, dateLimit.toISOString());

  return { summary, byCategory, periodDays: days };
}

function getSalesDashboard() {
  const metrics = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT COALESCE(SUM(total), 0) FROM orders) as total_revenue,
      (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
      (SELECT COUNT(*) FROM products) as total_products,
      (SELECT COUNT(*) FROM products WHERE stock < 10) as low_stock_products
  `).get();

  // Also fetch analytics to provide a chart
  const analytics = getSalesAnalytics(30, true);

  return {
    metrics,
    chart: analytics.chart
  };
}

function getSalesAnalytics(days = 30, includeChart = true) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  const data = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as orders,
      SUM(total) as revenue
    FROM orders
    WHERE created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all(dateLimit.toISOString()) as { date: string; orders: number; revenue: number }[];

  const result: { data: typeof data; chart?: object } = { data };

  if (includeChart && data.length > 0) {
    result.chart = {
      chartType: 'line',
      title: `Sales Trend (Last ${days} Days)`,
      data: data.map(d => ({
        label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: d.revenue,
        orders: d.orders,
      })),
      xKey: 'label',
      yKey: 'value',
      config: {
        showLegend: false,
        showGrid: true,
      },
    };
  }

  return result;
}

function getTopProducts(limit = 10, includeChart = false) {
  const data = db.prepare(`
    SELECT 
      p.id, p.name, p.price,
      SUM(oi.quantity) as units_sold,
      SUM(oi.price * oi.quantity) as revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    GROUP BY p.id
    ORDER BY revenue DESC
    LIMIT ?
  `).all(limit) as { id: number; name: string; price: number; units_sold: number; revenue: number }[];

  const result: { data: typeof data; chart?: object } = { data };

  if (includeChart && data.length > 0) {
    result.chart = {
      chartType: 'bar',
      title: `Top ${limit} Products by Revenue`,
      data: data.map(p => ({
        label: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        value: p.revenue,
      })),
      xKey: 'label',
      yKey: 'value',
      config: {
        showLegend: false,
        showGrid: true,
      },
    };
  }

  return result;
}

function getInventoryStatus(threshold = 10) {
  return db.prepare(`
    SELECT p.id, p.name, p.stock, c.name as category
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= ?
    ORDER BY p.stock ASC
  `).all(threshold);
}

function getRevenueByCategory(includeChart = true) {
  const data = db.prepare(`
    SELECT c.name as category, SUM(oi.price * oi.quantity) as revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY revenue DESC
  `).all() as { category: string; revenue: number }[];

  const result: { data: typeof data; chart?: object } = { data };

  if (includeChart && data.length > 0) {
    result.chart = {
      chartType: 'pie',
      title: 'Revenue by Category',
      data: data.map(d => ({
        label: d.category,
        value: d.revenue,
      })),
      xKey: 'label',
      yKey: 'value',
      config: {
        showLegend: true,
      },
    };
  }

  return result;
}
