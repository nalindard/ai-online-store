/**
 * Embedding Service
 * 
 * Generates text embeddings using Google's Gemini embedding model.
 * Used for semantic search and RAG (Retrieval Augmented Generation).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export type TaskType = 
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
}

export class EmbeddingService {
  private client: GoogleGenerativeAI;
  private model: string;
  private dimensions: number;

  constructor(
    apiKey?: string,
    model = 'gemini-embedding-001',
    dimensions = 768
  ) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is required for embeddings');
    }
    this.client = new GoogleGenerativeAI(key);
    this.model = model;
    this.dimensions = dimensions;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string, taskType: TaskType = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
    const model = this.client.getGenerativeModel({ model: this.model });
    
    const result = await model.embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: taskType as any,
    });

    let embedding = result.embedding.values;

    // Truncate to desired dimensions if needed
    if (embedding.length > this.dimensions) {
      embedding = embedding.slice(0, this.dimensions);
      // Normalize after truncation
      embedding = this.normalize(embedding);
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(
    texts: string[],
    taskType: TaskType = 'RETRIEVAL_DOCUMENT'
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    // Process in smaller batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const embeddings = await Promise.all(
        batch.map(text => this.embed(text, taskType))
      );

      embeddings.forEach((embedding, idx) => {
        results.push({
          text: batch[idx],
          embedding,
          dimensions: embedding.length,
        });
      });

      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Generate query embedding (optimized for search queries)
   */
  async embedQuery(query: string): Promise<number[]> {
    return this.embed(query, 'RETRIEVAL_QUERY');
  }

  /**
   * Generate document embedding (optimized for documents to be searched)
   */
  async embedDocument(document: string): Promise<number[]> {
    return this.embed(document, 'RETRIEVAL_DOCUMENT');
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Normalize an embedding vector
   */
  private normalize(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}
