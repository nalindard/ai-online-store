/**
 * RAG Query Engine
 * 
 * Performs semantic search over the product catalog and builds
 * context for LLM responses.
 */

import { getEmbeddingService } from './EmbeddingService.js';
import { getVectorStore, type SearchResult } from './VectorStore.js';

export interface RAGResult {
  query: string;
  results: SearchResult[];
  context: string;
}

export class RAGQueryEngine {
  private minScore: number;

  constructor(minScore = 0.5) {
    this.minScore = minScore;
  }

  /**
   * Perform semantic search for products
   */
  async search(
    query: string,
    topK = 5,
    filter?: Record<string, any>
  ): Promise<RAGResult> {
    const embeddingService = getEmbeddingService();
    const vectorStore = getVectorStore();

    // Generate query embedding
    const queryEmbedding = await embeddingService.embedQuery(query);

    // Search vector store
    const results = vectorStore.search(queryEmbedding, topK, filter);

    // Filter by minimum score
    const filteredResults = results.filter(r => r.score >= this.minScore);

    // Build context string for LLM
    const context = this.buildContext(query, filteredResults);

    return {
      query,
      results: filteredResults,
      context,
    };
  }

  /**
   * Search for products in a specific category
   */
  async searchByCategory(
    query: string,
    category: string,
    topK = 5
  ): Promise<RAGResult> {
    return this.search(query, topK, { category });
  }

  /**
   * Search for in-stock products only
   */
  async searchInStock(query: string, topK = 5): Promise<RAGResult> {
    return this.search(query, topK, { inStock: true });
  }

  /**
   * Build context string for LLM augmentation
   */
  private buildContext(query: string, results: SearchResult[]): string {
    if (results.length === 0) {
      return `No relevant products found for: "${query}"`;
    }

    const productList = results.map((r, i) => {
      const meta = r.metadata;
      return `${i + 1}. ${meta.name} (${meta.category}) - $${meta.price?.toFixed(2) || 'N/A'}
   ${r.content.split('\n').find(l => l.startsWith('Description:'))?.replace('Description: ', '') || ''}
   Relevance: ${(r.score * 100).toFixed(1)}%`;
    }).join('\n\n');

    return `Found ${results.length} relevant products for "${query}":\n\n${productList}`;
  }

  /**
   * Get similar products to a given product
   */
  async getSimilarProducts(productId: number, topK = 5): Promise<SearchResult[]> {
    const vectorStore = getVectorStore();
    
    // Get the product's embedding
    const product = vectorStore.get(`product-${productId}`);
    if (!product) {
      throw new Error(`Product ${productId} not found in vector store`);
    }

    // Search for similar products, excluding the original
    const results = vectorStore.search(product.embedding, topK + 1);
    
    // Remove the original product from results
    return results.filter(r => r.id !== `product-${productId}`).slice(0, topK);
  }
}

// Singleton instance
let ragEngine: RAGQueryEngine | null = null;

export function getRAGQueryEngine(): RAGQueryEngine {
  if (!ragEngine) {
    ragEngine = new RAGQueryEngine();
  }
  return ragEngine;
}
