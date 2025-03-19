<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { documentStore } from '$lib/services/documentStore';
    import type { IssuanceDocument } from '$lib/types';

    // State variables
    let documents: IssuanceDocument[] = [];
    let filteredDocuments: IssuanceDocument[] = [];
    let isLoading = false;
    let searchQuery = '';
    let selectedType = 'all';
    let processing = false;
    let apiEndpoint = 'https://your-api-endpoint.com/issuances';

    // Filter options
    const issuanceTypes = ['all', 'Circular', 'Memorandum', 'Advisory', 'Resolution'];

    onMount(async () => {
        // Load documents from storage first
        const hasLocalData = documentStore.loadFromStorage();
        
        // Subscribe to the documents store
        const unsubscribe = documentStore.documents.subscribe(docs => {
            documents = docs;
            applyFilters();
        });
        
        // Clean up subscription on component destruction
        return unsubscribe;
    });

    function applyFilters() {
        filteredDocuments = documents.filter(doc => {
            // Filter by search query
            const matchesSearch = searchQuery === '' || 
                doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.circularNumber.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Filter by issuance type
            const matchesType = selectedType === 'all' || 
                doc.issuanceType === selectedType;
            
            return matchesSearch && matchesType;
        });

        // Sort by date (newest first)
        filteredDocuments.sort((a, b) => 
            new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()
        );
    }

    // Watch for changes in filters
    $: if (documents) {
        if (searchQuery !== undefined || selectedType !== undefined) {
            applyFilters();
        }
    }

    async function handleFetchDocuments() {
        isLoading = true;
        try {
            await documentStore.fetchDocuments(apiEndpoint);
        } catch (error) {
            console.error("Error fetching documents:", error);
            alert("Failed to fetch documents. Please check the API endpoint and try again.");
        } finally {
            isLoading = false;
        }
    }

    async function handleProcessDocuments() {
        processing = true;
        try {
            await documentStore.processDocuments();
        } catch (error) {
            console.error("Error processing documents:", error);
        } finally {
            processing = false;
        }
    }

    function handleClearStorage() {
        if (confirm("Are you sure you want to clear all document data? This action cannot be undone.")) {
            documentStore.clearData();
        }
    }

    function goToChat() {
        goto('/chat');
    }

    function formatDate(dateString: string) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<svelte:head>
    <title>Document Management - BSP Legal Assistant</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
    <div class="mb-6 flex justify-between items-center">
        <h1 class="text-2xl font-bold">Document Management</h1>
        <button 
            class="px-3 py-1 bg-orange-200 hover:bg-orange-300 rounded"
            on:click={() => goto('/')}
        >
            ← Back
        </button>
    </div>

    <!-- Control Panel -->
    <div class="bg-white p-6 rounded-lg shadow-lg mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
                <h2 class="text-lg font-semibold mb-2">Document Statistics</h2>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-orange-50 p-3 rounded-lg">
                        <div class="text-sm text-orange-500">Total Documents</div>
                        <div class="text-2xl font-bold">{documents.length}</div>
                    </div>
                    <div class="bg-orange-50 p-3 rounded-lg">
                        <div class="text-sm text-orange-500">Processed</div>
                        <div class="text-2xl font-bold">
                            {documents.filter(d => d.content).length}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h2 class="text-lg font-semibold mb-2">Actions</h2>
                <div class="flex flex-wrap gap-3">
                    <button 
                        class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                        on:click={handleFetchDocuments}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Fetching...' : 'Fetch Documents'}
                    </button>
                    
                    <button 
                        class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                        on:click={handleProcessDocuments}
                        disabled={processing || documents.length === 0}
                    >
                        {processing ? 'Processing...' : 'Process Documents'}
                    </button>
                    
                    <button 
                        class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                        on:click={goToChat}
                    >
                        Go to Chat
                    </button>
                    
                    <button 
                        class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        on:click={handleClearStorage}
                    >
                        Clear Storage
                    </button>
                </div>
            </div>
        </div>

        <!-- Progress Bar -->
        {#if processing}
            <div class="mb-6">
                <div class="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        class="h-full bg-orange-500 transition-all duration-300" 
                        style="width: {$documentStore.progress.total ? 
                            Math.round(($documentStore.progress.processed / $documentStore.progress.total) * 100) : 0}%"
                    ></div>
                </div>
                <div class="text-sm text-gray-600 mt-1">
                    Processing {$documentStore.progress.processed} of {$documentStore.progress.total} documents
                </div>
            </div>
        {/if}

        <!-- API Endpoint Input -->
        <div class="mb-6">
            <label for="apiEndpoint" class="block text-sm font-medium text-gray-700 mb-1">API Endpoint</label>
            <div class="flex gap-2">
                <input 
                    id="apiEndpoint"
                    type="text" 
                    bind:value={apiEndpoint} 
                    placeholder="Enter API endpoint for document fetching"
                    class="flex-grow px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
            </div>
        </div>

        <!-- Search and Filters -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="col-span-2">
                <label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search Documents</label>
                <input 
                    id="search"
                    type="text" 
                    bind:value={searchQuery} 
                    placeholder="Search by title or circular number"
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
            </div>

            <div>
                <label for="typeFilter" class="block text-sm font-medium text-gray-700 mb-1">Issuance Type</label>
                <select 
                    id="typeFilter"
                    bind:value={selectedType} 
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                    {#each issuanceTypes as type}
                        <option value={type}>{type}</option>
                    {/each}
                </select>
            </div>
        </div>
    </div>

    <!-- Documents Table -->
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        {#if filteredDocuments.length > 0}
            <table class="min-w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Circular #</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    {#each filteredDocuments as doc (doc.id)}
                        <tr class="hover:bg-gray-50">
                            <td class="py-3 px-4">{doc.circularNumber}</td>
                            <td class="py-3 px-4">
                                <div class="font-medium">{doc.title}</div>
                                {#if doc.downloadLink}
                                    <a href={doc.downloadLink} target="_blank" class="text-xs text-orange-600 hover:underline">
                                        View Document
                                    </a>
                                {/if}
                            </td>
                            <td class="py-3 px-4">{doc.issuanceType}</td>
                            <td class="py-3 px-4">{formatDate(doc.dateIssued)}</td>
                            <td class="py-3 px-4">
                                {#if doc.content}
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Processed
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        Not Processed
                                    </span>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {:else if documents.length === 0}
            <div class="text-center py-12">
                <p class="text-gray-500">No documents found. Click "Fetch Documents" to load documents from API.</p>
            </div>
        {:else}
            <div class="text-center py-12">
                <p class="text-gray-500">No documents match your search criteria.</p>
            </div>
        {/if}
    </div>
</div>