import { Router, type IRouter } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import type { CartItemWithProduct } from '@smartshop/shared';

const router: IRouter = Router();

// All cart routes require authentication
router.use(authenticateToken);

// GET /cart
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const items = db.prepare(`
      SELECT 
        ci.id, ci.user_id as userId, ci.product_id as productId, ci.quantity,
        p.name, p.description, p.price, p.image_url as imageUrl, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(userId) as any[];

    const cartItems = items.map((item) => ({
      id: item.id,
      userId: item.userId,
      productId: item.productId,
      quantity: item.quantity,
      product: {
        id: item.productId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        stock: item.stock,
      },
    }));

    const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    res.json({
      success: true,
      data: {
        items: cartItems,
        total: Math.round(total * 100) / 100,
        itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /cart/add
router.post('/add', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    // Check if product exists and has stock
    const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(productId) as { id: number; stock: number } | undefined;
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check existing cart item
    const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(userId, productId) as { id: number; quantity: number } | undefined;

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ success: false, error: 'Not enough stock available' });
      }
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQuantity, existing.id);
    } else {
      if (quantity > product.stock) {
        return res.status(400).json({ success: false, error: 'Not enough stock available' });
      }
      db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, productId, quantity);
    }

    res.json({ success: true, data: { message: 'Item added to cart' } });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /cart/:itemId
router.put('/:itemId', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const itemId = parseInt(req.params.itemId as string, 10);
    const { quantity } = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }

    if (quantity < 1) {
      return res.status(400).json({ success: false, error: 'Quantity must be at least 1' });
    }

    const item = db.prepare(`
      SELECT ci.id, ci.product_id, p.stock 
      FROM cart_items ci 
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ? AND ci.user_id = ?
    `).get(itemId, userId) as { id: number; product_id: number; stock: number } | undefined;

    if (!item) {
      return res.status(404).json({ success: false, error: 'Cart item not found' });
    }

    if (quantity > item.stock) {
      return res.status(400).json({ success: false, error: 'Not enough stock available' });
    }

    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
    res.json({ success: true, data: { message: 'Cart updated' } });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /cart/:itemId
router.delete('/:itemId', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const itemId = parseInt(req.params.itemId as string, 10);

    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }

    const result = db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(itemId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Cart item not found' });
    }

    res.json({ success: true, data: { message: 'Item removed from cart' } });
  } catch (error) {
    console.error('Delete cart item error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /cart (clear all)
router.delete('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    res.json({ success: true, data: { message: 'Cart cleared' } });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
