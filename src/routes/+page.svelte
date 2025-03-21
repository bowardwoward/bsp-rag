<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { documentStore } from '$lib/services/documentStore';
	// import { API_URL } from '$lib/config';

	let isLoading = false;

	onMount(async () => {
		// Try to load from localStorage first
		const hasLocalData = documentStore.loadFromStorage();

		if (!hasLocalData) {
			isLoading = true;
			await documentStore.fetchDocuments(`http://localhost:3000/api/issuances/paginated?pageSize=10`);
			isLoading = false;
		}
	});

	function handleStartChatting() {
		goto('/chat');
	}

	async function handleManageDocuments() {
		goto('/documents');
	}
</script>

<svelte:head>
	<title>BSP Legal Assistant</title>
</svelte:head>

<style>
	.orange-text {
		color: #FFA500;
	}
	.orange-bg {
		background-color: #FFA500;
	}
</style>

<div class="max-w-3xl mx-auto">
	<div class="text-center mb-12">
		<h1 class="text-4xl font-bold mb-4 orange-text">BSP Legal Assistant</h1>
		<p class="text-xl text-gray-600 mb-8">
			Your intelligent assistant for Philippine banking and financial regulations
		</p>

		{#if isLoading}
			<div class="mb-8">
				<div
					class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-orange-border"
				></div>
				<p class="mt-2 text-gray-600">Loading documents...</p>
			</div>
		{:else}
			<div class="text-center">
				<div class="text-sm font-medium text-gray-500">Processed</div>
				<div class="text-3xl font-bold orange-text">
					{typeof documentStore.processedCount === 'object'
						? 0
						: documentStore.processedCount}/{documentStore.documents.length || 0}
				</div>
				<div class="text-xs text-gray-500">Documents with extracted text</div>
			</div>
		{/if}

		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<button
				class="px-6 py-3 text-white orange-bg hover:bg-orange-700 rounded-lg shadow-lg font-medium transition-colors"
				on:click={handleStartChatting}
			>
				Start Chatting
			</button>

			<button
				class="px-6 py-3 text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-lg shadow-lg font-medium transition-colors"
				on:click={handleManageDocuments}
			>
				Manage Documents
			</button>
		</div>
	</div>

	<div class="mt-16 grid gap-8 grid-cols-1 md:grid-cols-2">
		<div class="bg-white rounded-lg shadow-lg p-6">
			<h2 class="text-xl font-bold mb-4 orange-text">How It Works</h2>
			<ol class="list-decimal list-inside space-y-2">
				<li>Our system downloads BSP regulatory documents</li>
				<li>The content is processed and indexed for semantic search</li>
				<li>Ask questions about regulations in natural language</li>
				<li>Get accurate answers with references to specific circulars</li>
			</ol>
		</div>

		<div class="bg-white rounded-lg shadow-lg p-6">
			<h2 class="text-xl font-bold mb-4 orange-text">Features</h2>
			<ul class="list-disc list-inside space-y-2">
				<li>Natural language understanding of regulatory questions</li>
				<li>Citations to specific circulars and regulations</li>
				<li>Local document processing for improved privacy</li>
				<li>Up-to-date with latest BSP issuances</li>
				<li>Handles complex regulatory questions with context</li>
			</ul>
		</div>
	</div>
</div>
