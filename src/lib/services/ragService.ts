import type { ChatMessage, RagResponse, SearchResult } from '$lib/types';

export class RagService {
  private model = 'gemma3'; 
  private apiUrl = 'http://localhost:11434/v1/completions';

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
    
    const systemPrompt = `You are a helpful assistant specializing in Philippine Banking and Financial regulations from the Bangko Sentral ng Pilipinas (BSP).
  Answer the user's question based on the following context information. If the answer is not contained in the context, say "I don't have enough information to answer this question" and suggest what additional information might help.
  
  Context information:
  ${contextText}
  
  Instructions:
  1. Base your answer ONLY on the provided context information.
  2. Cite specific circular numbers or regulations when relevant.
  3. Be concise but thorough.
  4. If multiple documents are relevant, synthesize the information.
  5. If the question is unclear or cannot be answered with the given context, ask for clarification.`;

    return [
    { role: 'system', content: systemPrompt },
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
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({
      model: this.model,
      messages,
      temperature: 0.3, 
      max_tokens: 1000,
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
