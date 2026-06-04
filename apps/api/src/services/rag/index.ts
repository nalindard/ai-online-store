/**
 * RAG Module Exports
 */

export { EmbeddingService, getEmbeddingService } from './EmbeddingService.js';
export type { EmbeddingResult, TaskType } from './EmbeddingService.js';

export { VectorStore, getVectorStore } from './VectorStore.js';
export type { VectorDocument, SearchResult } from './VectorStore.js';

export { RAGQueryEngine, getRAGQueryEngine } from './RAGQueryEngine.js';
export type { RAGResult } from './RAGQueryEngine.js';

export {
  loadProductsToVectorStore,
  updateProductEmbedding,
  removeProductFromVectorStore,
} from './DocumentLoader.js';
