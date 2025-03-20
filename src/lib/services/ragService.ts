import type { ChatMessage, RagResponse, SearchResult } from '$lib/types';

export class RagService {
  private model = 'gemma3';
  private apiUrl = 'http://localhost:11434/v1/chat/completions';
  private messageBuffer: ChatMessage[] = [];

  constructor() {}

  /**
   * Create a prompt with context for the RAG system
   */
  private createPromptWithContext(query: string, searchResults: SearchResult[]): ChatMessage[] {
    const contextText = searchResults
      .map(result => {
        return `Document: ${result.circularNumber} - ${result.title}\nSource: ${result.source}\nContent:\n${result.text}\n`;
      })
      .join('\n---\n\n');

      const systemPrompt = `
      You are a helpful assistant specializing in Philippine Banking and Financial regulations from the Bangko Sentral ng Pilipinas (BSP) and technical implementation guidance.

      Answer the user's question based on the following context information. For technical implementation questions, provide guidance using the approved tech stack: NestJS, ReactJS, React Native/Expo, and PostgreSQL.
      
      Context information:
      ${contextText}
      
      Instructions:
      1. For regulatory questions:
         - Base your answer ONLY on the provided context information
         - Cite specific circular numbers or regulations when relevant
         - If the answer isn't in the context, say "I don't have enough information to answer this question"
      
      2. For technical implementation questions:
         - Provide guidance using only the approved tech stack:
           * Backend: NestJS
           * Frontend: ReactJS (web) and React Native/Expo (mobile)
           * Database: PostgreSQL
         - Suggest best practices and architectural patterns
         - Consider BSP compliance requirements in technical solutions
      
      3. General guidelines:
         - Be concise but thorough
         - If multiple documents are relevant, synthesize the information
         - If the question is unclear or cannot be answered with the given context, ask for clarification
         - When suggesting technical solutions, ensure they align with BSP security and compliance requirements`;
    return [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: query }
    ];
  }

  /**
   * Generate a RAG response using Ollama
   */
  public async generateResponse(query: string, searchResults: SearchResult[]): Promise<RagResponse> {
    if (searchResults.length === 0) {
      return {
        answer: "I couldn't find any relevant information to answer your question. Could you rephrase or provide more context?",
        sources: []
      };
    }

    try {
      const messages = this.createPromptWithContext(query, searchResults);
      this.messageBuffer.push(...messages);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        // headers: {
        //   "ngrok-skip-browser-warning": "69420",
        //   'Content-Type': 'application/json'
        // },
        body: JSON.stringify({
          model: this.model,
          messages: this.messageBuffer,
          options: {
            temperature: 0.3,
          },
          stream: false
        })
      });

      const responseData = await response.json();
      const answer = responseData.choices[0].message.content || "I couldn't generate a response. Please try again.";

      const sources = searchResults.map(result => ({
        documentId: result.documentId,
        circularNumber: result.circularNumber,
        title: result.title,
        source: result.source,
        excerpt: result.text.length > 150 ? result.text.substring(0, 150) + '...' : result.text
      }));

      return { answer, sources };
    } catch (error) {
      console.error('Error generating RAG response:', error);
      throw error;
    }
  }
}
