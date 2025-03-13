<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { documentStore } from '$lib/services/documentStore';
    import { RagService } from '$lib/services/ragService';
    import type { ChatMessage, RagResponse } from '$lib/types';

    // Initialize the RAG service
    const ragService = new RagService();

    // State variables
    let userInput = '';
    let messages: Array<ChatMessage & { sources?: any[] }> = [];
    let isProcessing = false;
    let error = '';

    // Track if auto-scroll should be enabled
    let chatContainer: HTMLElement;
    let autoScroll = true;

    onMount(async () => {
        // Load documents from storage if needed
        if (documentStore.documents.length === 0) {
            const hasData = documentStore.loadFromStorage();
            if (!hasData) {
                // Redirect to home if no documents are available
                goto('/');
                return;
            }
        }

        // Add initial welcome message
        messages = [
            {
                role: 'assistant',
                content: 'Hello! I\'m your BSP Legal Assistant. How can I help you with Philippine banking and financial regulations today?'
            }
        ];
    });

    // Auto-scroll to bottom when messages change
    $: if (messages && autoScroll && chatContainer) {
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    }

    async function handleSubmit() {
        if (!userInput.trim() || isProcessing) return;

        const userMessage = userInput.trim();
        userInput = '';
        isProcessing = true;
        error = '';

        // Add user message to the chat
        messages = [...messages, { role: 'user', content: userMessage }];

        try {
            // Add a temporary loading message
            messages = [
                ...messages,
                { role: 'assistant', content: '...' }
            ];

            // Search for relevant document chunks
            const searchResults = await documentStore.semanticSearch(userMessage, 5);
            
            // Generate response using RAG
            const response: RagResponse = await ragService.generateResponse(userMessage, searchResults);
            
            // Replace loading message with real response
            messages = messages.slice(0, -1);
            messages = [
                ...messages,
                {
                    role: 'assistant',
                    content: response.answer,
                    sources: response.sources
                }
            ];
        } catch (e) {
            console.error('Error processing message:', e);
            error = 'Sorry, there was an error processing your request. Please try again.';
            
            // Remove loading message
            messages = messages.slice(0, -1);
        } finally {
            isProcessing = false;
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    function goHome() {
        goto('/');
    }
</script>

<svelte:head>
    <title>Chat - BSP Legal Assistant</title>
</svelte:head>

<div class="flex flex-col h-full max-w-4xl mx-auto">
    <div class="mb-4 flex justify-between items-center">
        <h1 class="text-2xl font-bold">Chat with BSP Legal Assistant</h1>
        <button 
            class="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded"
            on:click={goHome}
        >
            ← Back
        </button>
    </div>

    <!-- Chat messages container -->
    <div 
        class="bg-white rounded-lg shadow-lg p-4 mb-4 flex-grow overflow-y-auto max-h-[60vh]"
        bind:this={chatContainer}
        on:scroll={() => {
            const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 50;
            autoScroll = isAtBottom;
        }}
    >
        {#each messages as message, i (i)}
            <div class={`mb-4 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div 
                    class={`inline-block p-3 rounded-lg ${
                        message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-800'
                    } ${message.content === '...' ? 'animate-pulse' : ''}`}
                >
                    {#if message.content === '...'}
                        <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                            <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                            <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                        </div>
                    {:else}
                        <p class="whitespace-pre-line">{message.content}</p>
                    {/if}
                </div>

                {#if message.sources && message.sources.length > 0}
                    <div class="mt-2 text-left text-xs">
                        <p class="font-semibold text-gray-700 mt-2">Sources:</p>
                        <div class="space-y-1 mt-1">
                            {#each message.sources as source}
                                <div class="border border-gray-200 bg-gray-50 p-2 rounded">
                                    <p class="font-medium">{source.circularNumber}: {source.title}</p>
                                    <p class="text-gray-600 text-xs mt-1">{source.excerpt}</p>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/each}

        {#if error}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
            </div>
        {/if}
    </div>

    <!-- Input area -->
    <div class="bg-white rounded-lg shadow-lg p-4">
        <form on:submit|preventDefault={handleSubmit} class="flex">
            <textarea
                bind:value={userInput}
                on:keydown={handleKeyDown}
                placeholder="Type your question about BSP regulations..."
                class="flex-grow px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="2"
                disabled={isProcessing}
            ></textarea>
            <button
                type="submit"
                class={`px-6 py-2 bg-blue-600 text-white rounded-r-lg ${
                    isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                }`}
                disabled={isProcessing}
            >
                Send
            </button>
        </form>
        <p class="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for a new line
        </p>
    </div>
</div>