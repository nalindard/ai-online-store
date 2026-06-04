/**
 * Document Loader
 * 
 * Loads products from the database and creates embeddings for RAG.
 * This should be run once to initialize the vector store, then
 * incrementally when products are added/updated.
 */

import Database from 'bun:sqlite';
import { resolve } from 'path';
import { getEmbeddingService } from './EmbeddingService.js';
import { getVectorStore } from './VectorStore.js';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

/**
 * Create a searchable text representation of a product
 */
function productToText(product: Product): string {
  return `
Product: ${product.name}
Category: ${product.category}
Price: $${product.price.toFixed(2)}
${product.stock > 0 ? 'In Stock' : 'Out of Stock'}
Description: ${product.description}
  `.trim();
}

/**
 * Load all products and create embeddings
 */
export async function loadProductsToVectorStore(
  dbPath?: string,
  forceReload = false
): Promise<{ loaded: number; skipped: number }> {
  const sqlitePath = dbPath || resolve(process.cwd(), 'data', 'smartshop.db');
  const db = new Database(sqlitePath, { readonly: true });
  
  const embeddingService = getEmbeddingService();
  const vectorStore = getVectorStore();

  // Check if already loaded
  const existingCount = vectorStore.count();
  if (existingCount > 0 && !forceReload) {
    console.log(`Vector store already has ${existingCount} documents. Use forceReload=true to reload.`);
    return { loaded: 0, skipped: existingCount };
  }

  if (forceReload) {
    console.log('Clearing existing embeddings...');
    vectorStore.clear();
  }

  // Load products with categories
  const products = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.stock, c.name as category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `).all() as Product[];

  console.log(`Loading ${products.length} products into vector store...`);

  let loaded = 0;
  const batchSize = 5;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    // Generate embeddings for batch
    const texts = batch.map(productToText);
    const embeddings = await Promise.all(
      texts.map(text => embeddingService.embedDocument(text))
    );

    // Add to vector store
    const docs = batch.map((product, idx) => ({
      id: `product-${product.id}`,
      content: texts[idx],
      embedding: embeddings[idx],
      metadata: {
        type: 'product',
        productId: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        inStock: product.stock > 0,
      },
    }));

    vectorStore.addBatch(docs);
    loaded += batch.length;

    console.log(`Loaded ${loaded}/${products.length} products`);

    // Rate limit delay
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
    }
  }

  db.close();
  console.log(`✅ Loaded ${loaded} products into vector store`);
  
  return { loaded, skipped: 0 };
}

/**
 * Update embedding for a single product
 */
export async function updateProductEmbedding(
  productId: number,
  dbPath?: string
): Promise<void> {
  const sqlitePath = dbPath || resolve(process.cwd(), 'data', 'smartshop.db');
  const db = new Database(sqlitePath, { readonly: true });
  
  const embeddingService = getEmbeddingService();
  const vectorStore = getVectorStore();

  const product = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.stock, c.name as category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(productId) as Product | undefined;

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const text = productToText(product);
  const embedding = await embeddingService.embedDocument(text);

  vectorStore.add({
    id: `product-${product.id}`,
    content: text,
    embedding,
    metadata: {
      type: 'product',
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      inStock: product.stock > 0,
    },
  });

  db.close();
}

/**
 * Remove a product from the vector store
 */
export function removeProductFromVectorStore(productId: number): void {
  const vectorStore = getVectorStore();
  vectorStore.delete(`product-${productId}`);
}
