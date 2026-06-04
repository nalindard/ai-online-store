import express, { Express } from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/index.js';

// Import routes
import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shop.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';

const app: Express = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/shop', shopRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);
app.use('/chat', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`
  🛒 SmartShop API Server
  ━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Server running on http://localhost:${PORT}
  📦 Database initialized
  
  Available endpoints:
  • POST /auth/login
  • POST /auth/register
  • GET  /shop/products
  • GET  /shop/categories
  • GET  /cart (auth required)
  • POST /orders (auth required)
  • POST /chat/message (auth, SSE streaming)
  • GET  /admin/* (admin only)
  `);
});

export default app;
