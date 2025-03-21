import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ChromaClient, OllamaEmbeddingFunction, type Collection } from 'chromadb';
import type { DocumentChunk, SearchResult } from '$lib/types';

class ServerEmbeddingService {
	private embeddingModel = 'mxbai-embed-large';
	private client: ChromaClient;
	private embedder: OllamaEmbeddingFunction;
	private collection: Collection | null = null;
	private collectionName = 'bsp_documents';
	private ollamaApi = 'http://localhost:11434/api/embed'; // Updated API endpoint

	constructor() {
		this.client = new ChromaClient({
			path: 'http://localhost:8000'
		});

		this.embedder = new OllamaEmbeddingFunction({
			url: 'http://localhost:11434',
			model: 'mxbai-embed-large'
		});
	}

	private async generateEmbeddings(texts: string[]): Promise<number[][]> {
		try {
			const response = await fetch(this.ollamaApi, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: this.embeddingModel,
					input: texts
				})
			});

			if (!response.ok) {
				throw new Error(`Ollama API error: ${response.statusText}`);
			}

			const result = await response.json();
			return result.embeddings;
		} catch (error) {
			console.error('Error generating embeddings:', error);
			// Return zero vectors as fallback
			return texts.map(() => new Array(1024).fill(0));
		}
	}

	public async initCollection() {
		try {
			if (!this.collection) {
				this.collection = await this.client.getOrCreateCollection({
					name: this.collectionName,
					embeddingFunction: this.embedder
				});
			}
		} catch {
			throw new Error('Failed to initialize collection');
		}
		return this.collection;
	}

	public async addDocuments(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
		const collection = await this.initCollection();

		try {
			const ids = chunks.map((_, i) => `chunk_${Date.now()}_${i}`);
			const documents = chunks.map((chunk) => chunk.text);
			const embeddings = await this.generateEmbeddings(documents); // Explicitly generate embeddings

            if (documents.length !== embeddings.length) {
                throw new Error('Embedding count does not match document count.');
            }

			const metadatas = chunks.map((chunk) => ({
				documentId: Number(chunk.metadata.documentId),
				circularNumber: chunk.metadata.circularNumber,
				title: chunk.metadata.title,
				source: chunk.metadata.source
			}));

			await collection.add({
				ids,
				documents: metadatas.map((chunk) => chunk.circularNumber), // Pass the original text
				embeddings, // Pass the generated embeddings
				metadatas
			});

			

			return chunks;
		} catch (error) {
			console.error('Error adding documents to ChromaDB:', error);
			return chunks;
		}
	}

	public async search(query: string, limit: number = 5): Promise<SearchResult[]> {
		const collection = await this.initCollection();

		try {
			// Use the embedder for querying as well
			const results = await collection.query({
				queryTexts: [query],
				nResults: limit
			});

			if (!results.documents[0]) {
				return [];
			}

			return results.documents[0].map((text, i) => ({
				documentId: String(results.metadatas[0][i]?.documentId),
				circularNumber: results.metadatas[0][i]?.circularNumber,
				title: results.metadatas[0][i]?.title,
				source: results.metadatas[0] ? results.metadatas[0][i]?.source : '',
				text,
				score: results.distances ? results.distances[0][i] : 0
			}));
		} catch (error) {
			console.error('Error querying ChromaDB:', error);
			return [];
		}
	}

	public async clearData(): Promise<void> {
		try {
			await this.client.deleteCollection({
				name: this.collectionName
			});
			this.collection = null;
		} catch (error) {
			console.error('Error clearing ChromaDB collection:', error);
		}
	}
}

const embeddingService = new ServerEmbeddingService();

export const POST: RequestHandler = async ({ request }) => {
	const { action, data } = await request.json();

	try {
		switch (action) {
			case 'add':
				const chunks = await embeddingService.addDocuments(data.chunks);
				return json({ chunks });

			case 'search':
				const results = await embeddingService.search(data.query, data.limit);
				return json({ results });

			case 'clear':
				await embeddingService.clearData();
				return json({ success: true });

			default:
				return new Response('Invalid action', { status: 400 });
		}
	} catch (error) {
		console.error('API error:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
