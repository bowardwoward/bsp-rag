import type { IssuanceDocument, DocumentChunk } from '$lib/types';

export class PdfService {
    /**
     * Process a PDF document by sending it to the server
     */
    public async processPdf(document: IssuanceDocument): Promise<IssuanceDocument> {
        if (!document.downloadLink) {
            console.warn(`No download link for document ${document.id}`);
            return { ...document, content: '', chunks: [] };
        }

        try {
            const response = await fetch('/api/process-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentId: document.id,
                    downloadLink: document.downloadLink,
                    circularNumber: document.circularNumber,
                    title: document.title
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const result = await response.json();
            return {
                ...document,
                content: result.content,
                chunks: result.chunks
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