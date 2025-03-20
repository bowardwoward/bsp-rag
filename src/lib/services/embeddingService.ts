import type { DocumentChunk, SearchResult } from '$lib/types';

export class EmbeddingService {
	private embeddingModel = 'nomic-embed-text';
	private apiUrl = 'http://localhost:11434';


	constructor() {}

	/**
	 * Generate embeddings for a single text chunk
	 */
	private async generateEmbedding(text: string): Promise<number[]> {
		const response = await fetch(`${this.apiUrl}/embeddings`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: this.embeddingModel,
				input: text
			})
		});

		const data = await response.json();
		return data.data[0].embedding;
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
				const response = await fetch(`${this.apiUrl}/embeddings`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						model: this.embeddingModel,
						input: texts
					})
				});

				const data = await response.json();

				for (let j = 0; j < batch.length; j++) {
					result.push({
						...batch[j],
						embedding: data.data[j].embedding
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
			return await this.generateEmbedding(query);
		} catch (error) {
			console.error('Error generating query embedding:', error);
			throw error;
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
