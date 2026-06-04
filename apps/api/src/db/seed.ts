import { db, initializeDatabase } from './index.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Initialize schema first
  initializeDatabase();

  // Clear existing data
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM cart_items;
    DELETE FROM reviews;
    DELETE FROM product_embeddings;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM daily_sales;
  `);

  // Seed users
  console.log('👤 Creating users...');
  const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
  const customerPassword = await bcrypt.hash('customer123', SALT_ROUNDS);

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)
  `);

  insertUser.run('admin@smartshop.com', adminPassword, 'Admin User', 'admin');
  insertUser.run('john@example.com', customerPassword, 'John Doe', 'customer');
  insertUser.run('jane@example.com', customerPassword, 'Jane Smith', 'customer');
  insertUser.run('bob@example.com', customerPassword, 'Bob Wilson', 'customer');

  // Seed categories
  console.log('📁 Creating categories...');
  const insertCategory = db.prepare(`
    INSERT INTO categories (name, description) VALUES (?, ?)
  `);

  const categories = [
    ['Electronics', 'Gadgets, devices, and electronic accessories'],
    ['Clothing', 'Apparel and fashion items'],
    ['Home & Garden', 'Home decor and garden supplies'],
    ['Books', 'Physical and digital books'],
    ['Sports', 'Sports equipment and activewear'],
    ['Beauty', 'Skincare, makeup, and personal care'],
  ];

  categories.forEach(([name, desc]) => insertCategory.run(name, desc));

  // Seed products
  console.log('📦 Creating products...');
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, price, category_id, image_url, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const products = [
    // Electronics (category_id: 1)
    ['Wireless Bluetooth Headphones', 'Premium noise-canceling headphones with 30-hour battery life. Features include active noise cancellation, comfortable over-ear design, and high-fidelity audio.', 79.99, 1, '/images/headphones.jpg', 150],
    ['Smart Watch Pro', 'Advanced fitness tracking smartwatch with heart rate monitor, GPS, and 7-day battery. Water resistant to 50m.', 199.99, 1, '/images/smartwatch.jpg', 80],
    ['USB-C Hub 7-in-1', 'Multi-port USB-C hub with HDMI, USB 3.0, SD card reader, and power delivery. Compatible with laptops and tablets.', 45.99, 1, '/images/usbhub.jpg', 200],
    ['Wireless Charging Pad', 'Fast 15W wireless charger compatible with all Qi-enabled devices. Sleek minimalist design.', 29.99, 1, '/images/charger.jpg', 300],
    ['Portable Bluetooth Speaker', 'Waterproof portable speaker with 360° sound and 12-hour playback. Perfect for outdoor adventures.', 59.99, 1, '/images/speaker.jpg', 120],

    // Clothing (category_id: 2)
    ['Classic Cotton T-Shirt', 'Soft 100% cotton t-shirt available in multiple colors. Comfortable fit for everyday wear.', 24.99, 2, '/images/tshirt.jpg', 500],
    ['Slim Fit Jeans', 'Modern slim fit denim jeans with stretch comfort. Classic 5-pocket styling.', 49.99, 2, '/images/jeans.jpg', 250],
    ['Hooded Sweatshirt', 'Cozy fleece-lined hoodie with kangaroo pocket. Perfect for casual days.', 39.99, 2, '/images/hoodie.jpg', 180],
    ['Running Sneakers', 'Lightweight running shoes with responsive cushioning and breathable mesh upper.', 89.99, 2, '/images/sneakers.jpg', 100],
    ['Winter Jacket', 'Insulated waterproof jacket with hood. Keeps you warm in temperatures down to -20°C.', 129.99, 2, '/images/jacket.jpg', 75],

    // Home & Garden (category_id: 3)
    ['LED Desk Lamp', 'Adjustable LED desk lamp with 5 brightness levels and 3 color temperatures. USB charging port included.', 34.99, 3, '/images/desklamp.jpg', 200],
    ['Indoor Plant Set', 'Set of 3 low-maintenance indoor plants in decorative ceramic pots. Perfect for beginners.', 44.99, 3, '/images/plants.jpg', 60],
    ['Kitchen Knife Set', 'Professional 6-piece knife set with bamboo block. High-carbon stainless steel blades.', 79.99, 3, '/images/knives.jpg', 90],
    ['Throw Blanket', 'Luxurious soft throw blanket. 50x60 inches, machine washable.', 29.99, 3, '/images/blanket.jpg', 150],
    ['Garden Tool Set', 'Complete 5-piece garden tool set with ergonomic handles. Includes trowel, cultivator, and more.', 39.99, 3, '/images/gardentools.jpg', 80],

    // Books (category_id: 4)
    ['The AI Revolution', 'Comprehensive guide to artificial intelligence and its impact on society. Bestseller.', 19.99, 4, '/images/aibook.jpg', 300],
    ['Cooking Masterclass', 'Learn professional cooking techniques from world-renowned chefs. 200+ recipes included.', 34.99, 4, '/images/cookbook.jpg', 150],
    ['Mindfulness Guide', 'Practical guide to meditation and mindfulness for stress relief and mental clarity.', 14.99, 4, '/images/mindfulness.jpg', 200],
    ['Web Development 2026', 'Complete guide to modern web development including React, Node.js, and more.', 49.99, 4, '/images/webdev.jpg', 100],
    ['Science Fiction Anthology', 'Collection of award-winning science fiction short stories from top authors.', 24.99, 4, '/images/scifi.jpg', 180],

    // Sports (category_id: 5)
    ['Yoga Mat Premium', 'Extra thick 6mm yoga mat with non-slip surface. Includes carrying strap.', 39.99, 5, '/images/yogamat.jpg', 200],
    ['Dumbbell Set', 'Adjustable dumbbell set ranging from 5-25 lbs. Space-saving design.', 149.99, 5, '/images/dumbbells.jpg', 50],
    ['Tennis Racket Pro', 'Professional-grade tennis racket with graphite frame. Lightweight and powerful.', 89.99, 5, '/images/tennis.jpg', 40],
    ['Fitness Tracker Band', 'Simple fitness band tracking steps, calories, and sleep. 14-day battery life.', 49.99, 5, '/images/fitband.jpg', 250],
    ['Camping Tent 4-Person', 'Waterproof dome tent with easy setup. Perfect for family camping trips.', 119.99, 5, '/images/tent.jpg', 35],

    // Beauty (category_id: 6)
    ['Skincare Essentials Kit', 'Complete skincare routine with cleanser, toner, serum, and moisturizer.', 59.99, 6, '/images/skincare.jpg', 150],
    ['Hair Styling Set', 'Professional hair dryer and straightener set with heat protection spray.', 79.99, 6, '/images/hairstyle.jpg', 80],
    ['Natural Lip Collection', 'Set of 5 natural lip colors with moisturizing formula. Long-lasting wear.', 34.99, 6, '/images/lipstick.jpg', 200],
    ['Beard Grooming Kit', 'Complete beard care kit with oil, balm, brush, and comb. Natural ingredients.', 44.99, 6, '/images/beardkit.jpg', 100],
    ['Perfume Gift Set', 'Luxury fragrance collection with 3 signature scents. Elegant gift packaging.', 89.99, 6, '/images/perfume.jpg', 60],
  ];

  products.forEach(([name, desc, price, catId, img, stock]) => {
    insertProduct.run(name, desc, price, catId, img, stock);
  });

  // Seed reviews
  console.log('⭐ Creating reviews...');
  const insertReview = db.prepare(`
    INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
  `);

  const reviews = [
    [1, 2, 5, 'Amazing sound quality! Best headphones I have ever owned.'],
    [1, 3, 4, 'Great headphones, comfortable for long use. Battery life is impressive.'],
    [2, 2, 5, 'This smartwatch has everything I need. GPS tracking is very accurate.'],
    [3, 4, 4, 'Works perfectly with my MacBook. All ports function as expected.'],
    [5, 2, 5, 'Incredible sound for its size. Took it camping and it was perfect!'],
    [6, 3, 5, 'Super soft cotton, fits perfectly. Ordered 3 more in different colors.'],
    [9, 2, 4, 'Comfortable running shoes. Great cushioning for long runs.'],
    [11, 4, 5, 'Perfect desk lamp for working from home. Love the USB port feature.'],
    [13, 3, 5, 'Sharp knives, great quality. The bamboo block looks beautiful.'],
    [16, 2, 5, 'Fascinating read about AI. Very accessible for non-technical readers.'],
    [21, 3, 4, 'Good quality yoga mat. The extra thickness is nice for joints.'],
    [26, 4, 5, 'My skin has never looked better! Love this skincare routine.'],
  ];

  reviews.forEach(([prodId, userId, rating, comment]) => {
    insertReview.run(prodId, userId, rating, comment);
  });

  // Seed orders with historical data for analytics
  console.log('🛒 Creating orders...');
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, status, total, created_at) VALUES (?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)
  `);

  // Generate orders over the past 30 days
  const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'confirmed', 'pending'];
  const now = new Date();
  
  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const ordersPerDay = Math.floor(Math.random() * 5) + 2; // 2-6 orders per day
    
    for (let i = 0; i < ordersPerDay; i++) {
      const userId = Math.floor(Math.random() * 3) + 2; // users 2, 3, or 4
      const status = daysAgo > 5 ? 'delivered' : statuses[Math.floor(Math.random() * statuses.length)];
      
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(Math.floor(Math.random() * 12) + 8); // 8am - 8pm
      const dateStr = date.toISOString();

      // Random items per order (1-4)
      const numItems = Math.floor(Math.random() * 4) + 1;
      let orderTotal = 0;
      const orderItems: Array<{ productId: number; quantity: number; price: number }> = [];

      for (let j = 0; j < numItems; j++) {
        const productId = Math.floor(Math.random() * 30) + 1;
        const quantity = Math.floor(Math.random() * 3) + 1;
        const product = db.prepare('SELECT price FROM products WHERE id = ?').get(productId) as { price: number };
        
        if (product) {
          const itemPrice = product.price;
          orderTotal += itemPrice * quantity;
          orderItems.push({ productId, quantity, price: itemPrice });
        }
      }

      const result = insertOrder.run(userId, status, orderTotal, dateStr);
      const orderId = result.lastInsertRowid;

      orderItems.forEach((item) => {
        insertOrderItem.run(orderId, item.productId, item.quantity, item.price);
      });
    }
  }

  // Update daily sales analytics
  console.log('📊 Calculating analytics...');
  db.exec(`
    INSERT OR REPLACE INTO daily_sales (date, total_orders, total_revenue, avg_order_value)
    SELECT 
      date(created_at) as date,
      COUNT(*) as total_orders,
      SUM(total) as total_revenue,
      AVG(total) as avg_order_value
    FROM orders
    GROUP BY date(created_at)
  `);

  // Summary
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  const orderCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
  const reviewCount = (db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number }).count;

  console.log('\n✅ Database seeded successfully!');
  console.log(`   • ${userCount} users (1 admin, ${userCount - 1} customers)`);
  console.log(`   • ${productCount} products across 6 categories`);
  console.log(`   • ${orderCount} orders`);
  console.log(`   • ${reviewCount} reviews`);
  console.log('\n📧 Test accounts:');
  console.log('   Admin: admin@smartshop.com / admin123');
  console.log('   Customer: john@example.com / customer123');
}

seed().catch(console.error);
