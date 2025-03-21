import type { DocumentChunk, SearchResult } from '$lib/types';

export class EmbeddingService {
	private embeddingModel = 'mxbai-embed-large';
	private apiUrl = 'http://localhost:11434/api';

	constructor() {}

	public async saveEmbeddingsToChroma(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
		try {
			const response = await fetch('/api/embeddings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'add',
					data: {
						chunks: chunks
					}
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save embeddings to ChromaDB');
			}

			const result = await response.json();
			return result.chunks;
		} catch (error) {
			console.error('Error saving embeddings to ChromaDB:', error);
			throw error;
		}
	}

	/**
	 * Generate embeddings for a single text chunk
	 */
	private async generateEmbedding(text: string): Promise<number[]> {
		const response = await fetch(`${this.apiUrl}/embed`, {
			method: 'POST',
			// headers: {
			// 	'Content-Type': 'application/json',
			// 	"ngrok-skip-browser-warning": "69420",
			// },
			body: JSON.stringify({
				model: this.embeddingModel,
				input: text
			})
		});

		const data = await response.json();
		return data.embeddings;
	}

	/**
	 * Generate embeddings for multiple chunks efficiently
	 */
	public async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
		const batchSize = 20;
		const result: DocumentChunk[] = [];

		for (let i = 0; i < chunks.length; i += batchSize) {
			const batch = chunks.slice(i, i + batchSize);
			const texts = batch.map((chunk) => chunk.text);

			try {
				const response = await fetch(`${this.apiUrl}/embed`, {
					method: 'POST',
					// headers: {
					// 	"ngrok-skip-browser-warning": "69420",
					// 	'Content-Type': 'application/json'
					// },
					body: JSON.stringify({
						model: this.embeddingModel,
						input: texts
					})
				});

				const data = await response.json();

				for (let j = 0; j < batch.length; j++) {
					result.push({
						...batch[j],
						embedding: data.embeddings
					});
				}

				console.log(`Generated embeddings for ${i + batch.length} of ${chunks.length} chunks`);

				if (i + batchSize < chunks.length) {
					await new Promise((resolve) => setTimeout(resolve, 200));
				}
			} catch (error) {
				console.error('Error generating embeddings:', error);
				result.push(...batch);
			}
		}

		return result;
	}

	/**
	 * Generate a query embedding for search
	 */
	public async generateQueryEmbedding(query: string): Promise<number[]> {
		try {
			// Try to use the server endpoint first for consistent embeddings
			const response = await fetch('/api/embeddings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'embed',
					data: {
						text: query
					}
				})
			});

			if (response.ok) {
				const result = await response.json();
				if (result.embedding) {
					return result.embedding;
				}
			}

			// Fall back to local embedding if the server endpoint fails
			return await this.generateEmbedding(query);
		} catch (error) {
			console.error('Error generating query embedding:', error);
			return await this.generateEmbedding(query);
		}
	}

	/**
	 * Calculate cosine similarity between two vectors
	 */
	private cosineSimilarity(vecA: number[], vecB: number[]): number {
		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (let i = 0; i < vecA.length; i++) {
			dotProduct += vecA[i] * vecB[i];
			normA += vecA[i] * vecA[i];
			normB += vecB[i] * vecB[i];
		}

		return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
	}

	/**
	 * Search for relevant chunks based on query embedding
	 */
	public searchSimilarChunks(
		queryEmbedding: number[],
		chunks: DocumentChunk[],
		limit: number = 5
	): SearchResult[] {
		const chunksWithEmbeddings = chunks.filter(
			(chunk) => chunk.embedding && chunk.embedding.length > 0
		);

		if (chunksWithEmbeddings.length === 0) {
			return [];
		}

		const results = chunksWithEmbeddings.map((chunk) => {
			const score = this.cosineSimilarity(queryEmbedding, chunk.embedding!);
			return {
				documentId: chunk.metadata.documentId,
				circularNumber: chunk.metadata.circularNumber,
				title: chunk.metadata.title,
				source: chunk.metadata.source,
				text: chunk.text,
				score
			};
		});

		return results.sort((a, b) => b.score - a.score).slice(0, limit);
	}
}
