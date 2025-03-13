import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { IssuanceDocument, DocumentChunk } from '$lib/types';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export class PdfService {
	/**
	 * Downloads a PDF file from a URL
	 */
	private async downloadPdf(url: string): Promise<ArrayBuffer> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to download PDF: ${response.statusText}`);
		}
		return await response.arrayBuffer();
	}

	/**
	 * Extracts text content from a PDF buffer
	 */
	private async extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
		
		const blob = new Blob([pdfBuffer], { type: 'application/pdf' });

		
		const loader = new PDFLoader(blob);
		const docs = await loader.load();

		
		return docs.map((doc) => doc.pageContent).join('\n');
	}

	/**
	 * Creates chunks from text content for efficient retrieval
	 */
	private async createChunks(
		text: string,
		metadata: { documentId: number; circularNumber: string; title: string; source: string }
	): Promise<DocumentChunk[]> {
		
		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 1000,
			chunkOverlap: 200
		});

		const rawChunks = await splitter.createDocuments([text]);

		
		return rawChunks.map((chunk) => ({
			text: chunk.pageContent,
			metadata
		}));
	}

	/**
	 * Process a PDF document from a URL and extract text and chunks
	 */
	public async processPdf(document: IssuanceDocument): Promise<IssuanceDocument> {
		if (!document.downloadLink) {
			console.warn(`No download link for document ${document.id}`);
			return { ...document, content: '', chunks: [] };
		}

		try {
			
			const pdfBuffer = await this.downloadPdf(document.downloadLink);
			const content = await this.extractTextFromPdf(pdfBuffer);

			
			const chunks = await this.createChunks(content, {
				documentId: document.id,
				circularNumber: document.circularNumber,
				title: document.title,
				source: document.downloadLink
			});

			return {
				...document,
				content,
				chunks
			};
		} catch (error) {
			console.error(`Error processing PDF ${document.id}:`, error);
			return { ...document, content: '', chunks: [] };
		}
	}

	/**
	 * Process multiple PDF documents in parallel with rate limiting
	 */
	public async processMultiplePdfs(documents: IssuanceDocument[]): Promise<IssuanceDocument[]> {
		
		const batchSize = 5;
		const results: IssuanceDocument[] = [];

		for (let i = 0; i < documents.length; i += batchSize) {
			const batch = documents.slice(i, i + batchSize);
			const batchResults = await Promise.all(batch.map((doc) => this.processPdf(doc)));
			results.push(...batchResults);

			
			console.log(
				`Processed ${Math.min(i + batchSize, documents.length)} of ${documents.length} documents`
			);

			
			if (i + batchSize < documents.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		return results;
	}
}
