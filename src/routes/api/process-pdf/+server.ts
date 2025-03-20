import { json } from '@sveltejs/kit';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { RequestHandler } from './$types';

async function downloadPdf(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    return await response.arrayBuffer();
}

async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const loader = new PDFLoader(blob);
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join('\n');
}

async function createChunks(text: string, metadata: any) {
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
        const { documentId, downloadLink, circularNumber, title } = await request.json();

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
        return new Response(JSON.stringify({ error: 'Failed to process PDF' }), {
            status: 500
        });
    }
};