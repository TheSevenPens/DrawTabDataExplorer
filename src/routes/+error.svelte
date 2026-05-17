<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
</script>

<Nav />

<div class="error-page">
	<div class="error-code">{$page.status}</div>
	<h1 class="error-title">
		{#if $page.status === 404}
			Page not found
		{:else}
			Something went wrong
		{/if}
	</h1>
	{#if $page.error?.message}
		<p class="error-message">{$page.error.message}</p>
	{/if}
	<a class="back-link" href={resolve('/tablets')}>← Back to tablets</a>
</div>

<style>
	.error-page {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 48px 0;
	}

	.error-code {
		font-size: 72px;
		font-weight: 800;
		color: var(--border);
		line-height: 1;
	}

	.error-title {
		font-size: 24px;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.error-message {
		font-size: 13px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #dc2626;
		background: #fef2f2;
		border: 1px solid #fca5a5;
		border-radius: 4px;
		padding: 8px 12px;
		margin: 0;
		max-width: 600px;
		word-break: break-word;
	}

	.back-link {
		font-size: 13px;
		color: var(--link);
		text-decoration: none;
		margin-top: 4px;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
