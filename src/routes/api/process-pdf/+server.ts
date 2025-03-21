import { json } from '@sveltejs/kit';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { RequestHandler } from './$types';

interface PdfRequestBody {
    documentId: string;
    downloadLink: string;
    circularNumber: string;
    title: string;
}

async function downloadPdf(url: string): Promise<ArrayBuffer> {
    if (!url) {
        throw new Error('Download URL is required');
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    return await response.arrayBuffer();
}

async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
    if (!pdfBuffer || pdfBuffer.byteLength === 0) {
        throw new Error('Invalid PDF buffer');
    }
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const loader = new PDFLoader(blob);
    const docs = await loader.load();
    if (!docs.length) {
        throw new Error('No content extracted from PDF');
    }
    return docs.map((doc) => doc.pageContent).join('\n');
}

async function createChunks(text: string, metadata: Record<string, unknown>) {
    if (!text) {
        throw new Error('Text content is required for chunking');
    }
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

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as PdfRequestBody;
        const { documentId, downloadLink, circularNumber, title } = body;

        if (!documentId || !downloadLink || !circularNumber || !title) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }), 
                { status: 400 }
            );
        }

        const pdfBuffer = await downloadPdf(downloadLink);
        const content = await extractTextFromPdf(pdfBuffer);
        const chunks = await createChunks(content, {
            documentId,
            circularNumber,
            title,
            source: downloadLink
        });

        return json({ content, chunks });
    } catch (error) {
        console.error('Error processing PDF:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to process PDF' }), 
            { status: 500 }
        );
    }
};