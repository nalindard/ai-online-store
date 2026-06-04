/**
 * Products MCP Server - HTTP/SSE Transport
 * 
 * A standalone web server providing MCP tools for product operations.
 * Runs on port 3010 by default.
 * 
 * Tools:
 * - search_products: Search products by query and filters
 * - get_product_details: Get detailed product information
 * - get_product_reviews: Get reviews for a product
 * - get_similar_products: Find similar products by category
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
const PORT = process.env.MCP_PRODUCTS_PORT || 3010;
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
    name: 'search_products',
    description: 'Search for products by name, description, or category. Returns a list of matching products with prices and stock status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against product name or description',
        },
        category: {
          type: 'string',
          description: 'Optional category name to filter by',
        },
        minPrice: {
          type: 'number',
          description: 'Optional minimum price filter',
        },
        maxPrice: {
          type: 'number',
          description: 'Optional maximum price filter',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
    },
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product including full description, stock, and category.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The unique product ID',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'get_product_reviews',
    description: 'Get customer reviews for a specific product.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The unique product ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of reviews (default: 5)',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'get_similar_products',
    description: 'Find products similar to a given product based on category.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The product ID to find similar products for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of similar products (default: 5)',
        },
      },
      required: ['productId'],
    },
  },
];

// Tool implementations
function searchProducts(args: {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): string {
  const db = getDatabase();
  const limit = args.limit || 10;
  
  let sql = `
    SELECT p.id, p.name, p.price, p.stock, p.description, c.name as category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (args.query) {
    sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
    params.push(`%${args.query}%`, `%${args.query}%`);
  }

  if (args.category) {
    sql += ` AND c.name LIKE ?`;
    params.push(`%${args.category}%`);
  }

  if (args.minPrice !== undefined) {
    sql += ` AND p.price >= ?`;
    params.push(args.minPrice);
  }

  if (args.maxPrice !== undefined) {
    sql += ` AND p.price <= ?`;
    params.push(args.maxPrice);
  }

  sql += ` LIMIT ?`;
  params.push(limit);

  const products = db.prepare(sql).all(...params);

  if (products.length === 0) {
    return JSON.stringify({ message: 'No products found matching your criteria.', products: [] });
  }

  return JSON.stringify({
    count: products.length,
    products: products.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: `$${p.price.toFixed(2)}`,
      stock: p.stock,
      inStock: p.stock > 0,
      category: p.category,
      description: p.description?.substring(0, 100) + (p.description?.length > 100 ? '...' : ''),
    })),
  });
}

function getProductDetails(args: { productId: number }): string {
  const db = getDatabase();
  
  const product = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(args.productId) as any;

  if (!product) {
    return JSON.stringify({ error: `Product with ID ${args.productId} not found.` });
  }

  return JSON.stringify({
    id: product.id,
    name: product.name,
    description: product.description,
    price: `$${product.price.toFixed(2)}`,
    priceNumeric: product.price,
    stock: product.stock,
    inStock: product.stock > 0,
    category: product.category_name,
    imageUrl: product.image_url,
  });
}

function getProductReviews(args: { productId: number; limit?: number }): string {
  const db = getDatabase();
  const limit = args.limit || 5;
  
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(args.productId) as any;
  if (!product) {
    return JSON.stringify({ error: `Product with ID ${args.productId} not found.` });
  }

  const reviews = db.prepare(`
    SELECT r.*, u.email as reviewer_email
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(args.productId, limit);

  return JSON.stringify({
    productName: product.name,
    reviewCount: reviews.length,
    reviews: reviews.map((r: any) => ({
      rating: r.rating,
      comment: r.comment,
      reviewer: r.reviewer_email?.split('@')[0] || 'Anonymous',
      date: r.created_at,
    })),
  });
}

function getSimilarProducts(args: { productId: number; limit?: number }): string {
  const db = getDatabase();
  const limit = args.limit || 5;
  
  const product = db.prepare(`
    SELECT id, name, category_id FROM products WHERE id = ?
  `).get(args.productId) as any;

  if (!product) {
    return JSON.stringify({ error: `Product with ID ${args.productId} not found.` });
  }

  const similar = db.prepare(`
    SELECT p.id, p.name, p.price, p.stock, c.name as category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ?
    ORDER BY RANDOM()
    LIMIT ?
  `).all(product.category_id, args.productId, limit);

  return JSON.stringify({
    originalProduct: product.name,
    similarProducts: similar.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: `$${p.price.toFixed(2)}`,
      inStock: p.stock > 0,
      category: p.category,
    })),
  });
}

// Create MCP Server
function createMCPServer(): Server {
  const server = new Server(
    { name: 'smartshop-products-mcp', version: '1.0.0' },
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
        case 'search_products':
          result = searchProducts(args as any);
          break;
        case 'get_product_details':
          result = getProductDetails(args as any);
          break;
        case 'get_product_reviews':
          result = getProductReviews(args as any);
          break;
        case 'get_similar_products':
          result = getSimilarProducts(args as any);
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

// Store active transports
const transports = new Map<string, SSEServerTransport>();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'mcp-products', port: PORT });
});

// SSE endpoint for MCP communication
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

// Message endpoint for MCP requests
app.post('/message', async (req, res) => {
  // Find the transport for this session (simplified - in production use session IDs)
  const transport = Array.from(transports.values())[0];
  if (!transport) {
    return res.status(400).json({ error: 'No active SSE connection' });
  }

  await transport.handlePostMessage(req, res);
});

// Direct REST API for tools (alternative to MCP)
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    let result: string;

    switch (toolName) {
      case 'search_products':
        result = searchProducts(args);
        break;
      case 'get_product_details':
        result = getProductDetails(args);
        break;
      case 'get_product_reviews':
        result = getProductReviews(args);
        break;
      case 'get_similar_products':
        result = getSimilarProducts(args);
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

// List available tools
app.get('/tools', (req, res) => {
  res.json({ tools: TOOLS });
});

app.listen(PORT, () => {
  console.log(`
  🛍️  Products MCP Server
  ━━━━━━━━━━━━━━━━━━━━━━━
  ✅ HTTP Server: http://localhost:${PORT}
  📡 SSE Endpoint: http://localhost:${PORT}/sse
  🔧 REST API: http://localhost:${PORT}/tools/:toolName
  
  Available tools:
  • search_products
  • get_product_details
  • get_product_reviews
  • get_similar_products
  `);
});
