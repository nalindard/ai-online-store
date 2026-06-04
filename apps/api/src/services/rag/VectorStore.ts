/**
 * Vector Store
 * 
 * SQLite-based vector store for storing and querying embeddings.
 * Uses cosine similarity for vector search.
 */

import Database from 'bun:sqlite';
import { resolve } from 'path';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export class VectorStore {
  private db: Database;
  private tableName: string;

  constructor(dbPath?: string, tableName = 'embeddings') {
    const path = dbPath || resolve(process.cwd(), 'data', 'vectors.db');
    this.db = new Database(path);
    this.tableName = tableName;
    this.initialize();
  }

  /**
   * Initialize the vector store table
   */
  private initialize(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster lookups
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_id ON ${this.tableName}(id)
    `);
  }

  /**
   * Add a document with its embedding
   */
  add(doc: Omit<VectorDocument, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tableName} (id, content, embedding, metadata)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      doc.id,
      doc.content,
      JSON.stringify(doc.embedding),
      JSON.stringify(doc.metadata)
    );
  }

  /**
   * Add multiple documents
   */
  addBatch(docs: Array<Omit<VectorDocument, 'createdAt'>>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tableName} (id, content, embedding, metadata)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const doc of docs) {
        stmt.run(
          doc.id,
          doc.content,
          JSON.stringify(doc.embedding),
          JSON.stringify(doc.metadata)
        );
      }
    });

    transaction();
  }

  /**
   * Search for similar documents using cosine similarity
   */
  search(queryEmbedding: number[], topK = 5, filter?: Record<string, any>): SearchResult[] {
    // Get all documents (for small datasets; for large datasets use approximate methods)
    let sql = `SELECT id, content, embedding, metadata FROM ${this.tableName}`;
    const params: any[] = [];

    // Apply metadata filters if provided
    if (filter && Object.keys(filter).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(filter)) {
        conditions.push(`json_extract(metadata, '$.${key}') = ?`);
        params.push(value);
      }
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    // Calculate similarity scores
    const results: SearchResult[] = rows.map(row => {
      const embedding = JSON.parse(row.embedding) as number[];
      const score = this.cosineSimilarity(queryEmbedding, embedding);
      return {
        id: row.id,
        content: row.content,
        metadata: JSON.parse(row.metadata),
        score,
      };
    });

    // Sort by score descending and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get a document by ID
   */
  get(id: string): VectorDocument | null {
    const row = this.db.prepare(`
      SELECT * FROM ${this.tableName} WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      content: row.content,
      embedding: JSON.parse(row.embedding),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
    };
  }

  /**
   * Delete a document by ID
   */
  delete(id: string): void {
    this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  /**
   * Delete all documents
   */
  clear(): void {
    this.db.run(`DELETE FROM ${this.tableName}`);
  }

  /**
   * Get document count
   */
  count(): number {
    const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as any;
    return result.count;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      // Truncate to shorter length if dimensions don't match
      const minLen = Math.min(a.length, b.length);
      a = a.slice(0, minLen);
      b = b.slice(0, minLen);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let vectorStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStore) {
    vectorStore = new VectorStore();
  }
  return vectorStore;
}
