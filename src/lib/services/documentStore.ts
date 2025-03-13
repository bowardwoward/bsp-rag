import { writable, derived, get } from 'svelte/store';
import type { IssuanceDocument, DocumentChunk, SearchResult } from '$lib/types';
import { browser } from '$app/environment';
import { PdfService } from './pdfService';
import { EmbeddingService } from './embeddingService';


const documentsStore = writable<IssuanceDocument[]>([]);
const chunksStore = writable<DocumentChunk[]>([]);
const isLoadingStore = writable(false);
const progressStore = writable({ total: 0, processed: 0 });


const pdfService = new PdfService();
const embeddingService = new EmbeddingService();


const processedDocumentsCount = derived(
  documentsStore,
  $docs => $docs.filter(doc => doc.content).length
);

export const documentStore = {
  
  documents: derived(documentsStore, $docs => $docs),
  chunks: derived(chunksStore, $chunks => $chunks),
  isLoading: derived(isLoadingStore, $loading => $loading),
  progress: derived(progressStore, $progress => $progress),
  processedCount: processedDocumentsCount,
  
  /**
   * Initialize the store with documents from the API
   */
  async fetchDocuments(apiUrl: string): Promise<void> {
    isLoadingStore.set(true);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      
      const data = await response.json();
      documentsStore.set(data.issuances || []);
      progressStore.set({ total: data.issuances.length, processed: 0 });
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      isLoadingStore.set(false);
    }
  },
  
  /**
   * Process documents to extract content and create embeddings
   */
  async processDocuments(): Promise<void> {
    isLoadingStore.set(true);
    try {
      const docs = get(documentsStore);
      
      
      const unprocessedDocs = docs.filter(doc => !doc.content && doc.downloadLink);
      
      if (unprocessedDocs.length === 0) {
        console.log('All documents already processed');
        return;
      }
      
      console.log(`Processing ${unprocessedDocs.length} documents`);
      
      
      progressStore.set({ total: unprocessedDocs.length, processed: 0 });
      
      
      const batchSize = 5;
      const allProcessedDocs: IssuanceDocument[] = [...docs.filter(doc => doc.content)];
      
      for (let i = 0; i < unprocessedDocs.length; i += batchSize) {
        const batch = unprocessedDocs.slice(i, i + batchSize);
        
        
        const processedBatch = await pdfService.processMultiplePdfs(batch);
        
        
        const allChunks: DocumentChunk[] = [];
        processedBatch.forEach(doc => {
          if (doc.chunks) {
            allChunks.push(...doc.chunks);
          }
        });
        
        
        const chunksWithEmbeddings = await embeddingService.generateEmbeddings(allChunks);
        
        
        const finalProcessedBatch = processedBatch.map(doc => {
          if (!doc.chunks) return doc;
          
          const docChunksWithEmbeddings = chunksWithEmbeddings.filter(
            chunk => chunk.metadata.documentId === doc.id
          );
          
          return {
            ...doc,
            chunks: docChunksWithEmbeddings
          };
        });
        
        
        allProcessedDocs.push(...finalProcessedBatch);
        
        
        documentsStore.set(allProcessedDocs);
        
        
        const currentChunks = get(chunksStore);
        const newChunks = chunksWithEmbeddings.filter(chunk => chunk.embedding);
        chunksStore.set([...currentChunks, ...newChunks]);
        
        
        progressStore.update(p => ({ ...p, processed: p.processed + batch.length }));
        
        
        if (browser) {
          try {
            
            const docsForStorage = allProcessedDocs.map(doc => ({
              ...doc,
              chunks: undefined 
            }));
            localStorage.setItem('rag_documents', JSON.stringify(docsForStorage));
            
            
            const chunksForStorage = newChunks.map(chunk => ({
              ...chunk,
              embedding: undefined 
            }));
            
            const existingChunksStr = localStorage.getItem('rag_chunks');
            const existingChunks = existingChunksStr ? JSON.parse(existingChunksStr) : [];
            
            
            const maxStoredChunks = 1000;
            const combinedChunks = [...existingChunks, ...chunksForStorage].slice(-maxStoredChunks);
            
            localStorage.setItem('rag_chunks', JSON.stringify(combinedChunks));
          } catch (e) {
            console.warn('Failed to save to localStorage (likely size exceeded):', e);
          }
        }
      }
    } catch (error) {
      console.error('Error processing documents:', error);
    } finally {
      isLoadingStore.set(false);
    }
  },
  
  /**
   * Load documents from localStorage
   */
  loadFromStorage(): boolean {
    if (!browser) return false;
    
    try {
      const docsStr = localStorage.getItem('rag_documents');
      const chunksStr = localStorage.getItem('rag_chunks');
      
      if (docsStr) {
        const docs = JSON.parse(docsStr);
        documentsStore.set(docs);
        console.log(`Loaded ${docs.length} documents from localStorage`);
      }
      
      if (chunksStr) {
        const chunks = JSON.parse(chunksStr);
        
        chunksStore.set(chunks);
        console.log(`Loaded ${chunks.length} chunks from localStorage`);
      }
      
      return !!(docsStr || chunksStr);
    } catch (e) {
      console.error('Error loading from localStorage:', e);
      return false;
    }
  },
  
  /**
   * Search for documents based on a query
   */
  async semanticSearch(query: string, limit = 5): Promise<SearchResult[]> {
    const chunks = get(chunksStore);
    
    
    const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding && chunk.embedding.length > 0);
    
    if (chunksWithEmbeddings.length === 0) {
      console.log('No chunks with embeddings found, regenerating embeddings');
      const regeneratedChunks = await embeddingService.generateEmbeddings(chunks);
      chunksStore.set(regeneratedChunks);
      
      
      if (regeneratedChunks.filter(c => c.embedding).length === 0) {
        return [];
      }
    }
    
    
    const queryEmbedding = await embeddingService.generateQueryEmbedding(query);
    
    
    return embeddingService.searchSimilarChunks(queryEmbedding, get(chunksStore), limit);
  },
  
  
  clearData() {
    documentsStore.set([]);
    chunksStore.set([]);
    
    if (browser) {
      localStorage.removeItem('rag_documents');
      localStorage.removeItem('rag_chunks');
    }
  }
};