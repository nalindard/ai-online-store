import { Router, type IRouter } from 'express';
import { db } from '../db/index.js';
import { getRAGQueryEngine, getVectorStore } from '../services/rag/index.js';
import type { Product, ProductWithCategory, Category, Review } from '@smartshop/shared';

const router: IRouter = Router();

// GET /shop/products
router.get('/products', (req, res) => {
  try {
    const { category, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (category) {
      whereClause += ' AND c.name = ?';
      params.push(category as string);
    }

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const products = db.prepare(`
      SELECT 
        p.id, p.name, p.description, p.price, p.category_id as categoryId,
        p.image_url as imageUrl, p.stock, p.created_at as createdAt,
        c.name as categoryName, c.description as categoryDescription
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1 ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as any[];

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1 ${whereClause}
    `).get(...params) as { count: number };

    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      stock: p.stock,
      createdAt: p.createdAt,
      category: {
        id: p.categoryId,
        name: p.categoryName,
        description: p.categoryDescription,
      },
    }));

    res.json({
      success: true,
      data: {
        items: formattedProducts,
        total: totalResult.count,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(totalResult.count / limitNum),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shop/products/:id
router.get('/products/:id', (req, res) => {
  try {
    const { id } = req.params;

    const product = db.prepare(`
      SELECT 
        p.id, p.name, p.description, p.price, p.category_id as categoryId,
        p.image_url as imageUrl, p.stock, p.created_at as createdAt,
        c.name as categoryName, c.description as categoryDescription
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id) as any;

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const reviews = db.prepare(`
      SELECT r.id, r.rating, r.comment, r.created_at as createdAt, u.name as userName
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `).all(id);

    res.json({
      success: true,
      data: {
        ...product,
        category: {
          id: product.categoryId,
          name: product.categoryName,
          description: product.categoryDescription,
        },
        reviews,
      },
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shop/categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT id, name, description FROM categories ORDER BY name
    `).all() as Category[];

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shop/semantic-search - Search products using RAG/semantic search
router.get('/semantic-search', async (req, res) => {
  try {
    const { q: query, limit = '5' } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }
    
    const vectorStore = getVectorStore();
    if (vectorStore.count() === 0) {
      return res.status(503).json({ 
        success: false, 
        error: 'RAG system not initialized. Please initialize embeddings first.' 
      });
    }
    
    const ragEngine = getRAGQueryEngine();
    const result = await ragEngine.search(query, parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: {
        query: result.query,
        results: result.results.map(r => ({
          id: r.id,
          name: r.metadata.name,
          description: r.metadata.description,
          price: r.metadata.price,
          category: r.metadata.category,
          relevanceScore: (r.score * 100).toFixed(1) + '%'
        }))
      }
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
