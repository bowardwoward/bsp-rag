export interface IssuanceDocument {
	id: number;
	title: string;
	circularNumber: string;
	issuanceType: string;
	dateIssued: string;
	downloadLink: string | null;
	content?: string; // Added content field to store extracted text
	chunks?: DocumentChunk[]; // Text chunks for efficient retrieval
}

export interface DocumentChunk {
	text: string;
	embedding?: number[];
	metadata: {
		documentId: number;
		circularNumber: string;
		title: string;
		source: string;
	};
}

export interface SearchResult {
	documentId: number;
	circularNumber: string;
	title: string;
	source: string;
	text: string;
	score: number;
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface RagResponse {
	answer: string;
	sources: {
		documentId: number;
		circularNumber: string;
		title: string;
		source: string;
		excerpt: string;
	}[];
}
