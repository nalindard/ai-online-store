import { Router, type IRouter } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { loadProductsToVectorStore, updateProductEmbedding } from '../services/rag/DocumentLoader.js';
import { getVectorStore } from '../services/rag/index.js';

const router: IRouter = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// GET /admin/dashboard
router.get('/dashboard', (req: AuthRequest, res) => {
  try {
    // Summary stats
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM orders) as totalOrders,
        (SELECT COALESCE(SUM(total), 0) FROM orders) as totalRevenue,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as totalCustomers,
        (SELECT COUNT(*) FROM products) as totalProducts,
        (SELECT COUNT(*) FROM products WHERE stock < 10) as lowStockProducts
    `).get() as any;

    // Recent orders
    const recentOrders = db.prepare(`
      SELECT o.id, o.total, o.status, o.created_at as createdAt, u.name as customerName
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all();

    // Sales by category
    const salesByCategory = db.prepare(`
      SELECT c.name as category, SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY revenue DESC
    `).all();

    res.json({
      success: true,
      data: {
        stats,
        recentOrders,
        salesByCategory,
      },
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /admin/analytics/sales
router.get('/analytics/sales', (req: AuthRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);

    const salesData = db.prepare(`
      SELECT date, total_orders as totalOrders, total_revenue as totalRevenue, avg_order_value as avgOrderValue
      FROM daily_sales
      WHERE date >= date('now', '-' || ? || ' days')
      ORDER BY date ASC
    `).all(daysNum);

    res.json({ success: true, data: salesData });
  } catch (error) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /admin/analytics/top-products
router.get('/analytics/top-products', (req: AuthRequest, res) => {
  try {
    const { limit = '10' } = req.query;

    const topProducts = db.prepare(`
      SELECT 
        p.id, p.name, p.price,
        SUM(oi.quantity) as totalSold,
        SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.id
      ORDER BY totalSold DESC
      LIMIT ?
    `).all(parseInt(limit as string, 10));

    res.json({ success: true, data: topProducts });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /admin/inventory
router.get('/inventory', (req: AuthRequest, res) => {
  try {
    const { lowStock } = req.query;

    let query = `
      SELECT p.id, p.name, p.stock, p.price, c.name as category
      FROM products p
      JOIN categories c ON p.category_id = c.id
    `;

    if (lowStock === 'true') {
      query += ' WHERE p.stock < 10';
    }

    query += ' ORDER BY p.stock ASC';

    const inventory = db.prepare(query).all();

    res.json({ success: true, data: inventory });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /admin/inventory/:productId
router.put('/inventory/:productId', (req: AuthRequest, res) => {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    const { stock } = req.body;

    if (isNaN(productId)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({ success: false, error: 'Valid stock quantity required' });
    }

    const result = db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, productId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: { message: 'Stock updated' } });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /admin/orders
router.get('/orders', (req: AuthRequest, res) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (status) {
      whereClause = 'WHERE o.status = ?';
      params.push(status as string);
    }

    const orders = db.prepare(`
      SELECT o.id, o.total, o.status, o.created_at as createdAt, 
             u.name as customerName, u.email as customerEmail
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM orders o ${whereClause}
    `).get(...params) as { count: number };

    res.json({
      success: true,
      data: {
        items: orders,
        total: totalResult.count,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(totalResult.count / limitNum),
      },
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /admin/orders/:id/status
router.put('/orders/:id/status', (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: { message: 'Order status updated' } });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /admin/rag/init - Initialize RAG embeddings for all products
router.post('/rag/init', async (req: AuthRequest, res) => {
  try {
    const vectorStore = getVectorStore();
    const currentCount = vectorStore.count();
    
    console.log('[RAG Init] Starting embeddings initialization...');
    console.log(`[RAG Init] Current vectors in store: ${currentCount}`);
    
    const result = await loadProductsToVectorStore();
    
    res.json({
      success: true,
      data: {
        message: 'RAG embeddings initialized successfully',
        productsProcessed: result.success,
        failed: result.failed,
        totalVectors: vectorStore.count()
      }
    });
  } catch (error) {
    console.error('RAG init error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to initialize RAG embeddings' 
    });
  }
});

// GET /admin/rag/status - Get RAG system status
router.get('/rag/status', (req: AuthRequest, res) => {
  try {
    const vectorStore = getVectorStore();
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    
    res.json({
      success: true,
      data: {
        vectorCount: vectorStore.count(),
        totalProducts: totalProducts.count,
        isReady: vectorStore.count() > 0,
        coverage: totalProducts.count > 0 
          ? Math.round((vectorStore.count() / totalProducts.count) * 100) 
          : 0
      }
    });
  } catch (error) {
    console.error('RAG status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get RAG status' });
  }
});

export default router;
