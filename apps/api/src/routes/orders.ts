import { Router, type IRouter } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import type { Order, OrderWithItems } from '@smartshop/shared';

const router: IRouter = Router();

// All order routes require authentication
router.use(authenticateToken);

// GET /orders
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status as string);
    }

    const orders = db.prepare(`
      SELECT id, user_id as userId, status, total, created_at as createdAt
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as Order[];

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM orders ${whereClause}
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
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /orders/:id
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const order = db.prepare(`
      SELECT id, user_id as userId, status, total, created_at as createdAt
      FROM orders
      WHERE id = ? AND user_id = ?
    `).get(id, userId) as Order | undefined;

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const items = db.prepare(`
      SELECT 
        oi.id, oi.order_id as orderId, oi.product_id as productId, 
        oi.quantity, oi.price,
        p.name, p.description, p.image_url as imageUrl
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(id) as any[];

    const orderWithItems = {
      ...order,
      items: items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        product: {
          id: item.productId,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
        },
      })),
    };

    res.json({ success: true, data: orderWithItems });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /orders (create from cart)
router.post('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get cart items
    const cartItems = db.prepare(`
      SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(userId) as { product_id: number; quantity: number; price: number; stock: number; name: string }[];

    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return res.status(400).json({ 
          success: false, 
          error: `Not enough stock for ${item.name}` 
        });
      }
    }

    // Calculate total
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Create order (transaction)
    const createOrder = db.transaction(() => {
      // Insert order
      const orderResult = db.prepare(`
        INSERT INTO orders (user_id, status, total) VALUES (?, 'pending', ?)
      `).run(userId, Math.round(total * 100) / 100);
      
      const orderId = orderResult.lastInsertRowid;

      // Insert order items and update stock
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)
      `);
      const updateStock = db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `);

      for (const item of cartItems) {
        insertItem.run(orderId, item.product_id, item.quantity, item.price);
        updateStock.run(item.quantity, item.product_id);
      }

      // Clear cart
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

      // Update daily sales
      const today = new Date().toISOString().split('T')[0];
      db.prepare(`
        INSERT INTO daily_sales (date, total_orders, total_revenue, avg_order_value)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          total_orders = total_orders + 1,
          total_revenue = total_revenue + excluded.total_revenue,
          avg_order_value = (total_revenue + excluded.total_revenue) / (total_orders + 1)
      `).run(today, total, total);

      return orderId;
    });

    const orderId = createOrder();

    res.status(201).json({ 
      success: true, 
      data: { 
        orderId, 
        message: 'Order created successfully' 
      } 
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
