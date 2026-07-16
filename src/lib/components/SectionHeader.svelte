<script lang="ts">
	// Shared section header (GitHub #231) — promoted out of data-quality into a
	// general component. A title (+ optional count) on the left and a right-aligned
	// action: either the convenience Export button (pass `onExport`) or an
	// arbitrary `actions` snippet (view toggles, multiple commands). The export
	// trigger routes through the shared Button (#239).
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/Button.svelte';

	let {
		title,
		count,
		disabled = false,
		onExport,
		actions,
	}: {
		title: string;
		count?: number;
		disabled?: boolean;
		/** Convenience: renders a right-aligned "Export" button when provided. */
		onExport?: () => void;
		/** Arbitrary right-aligned actions; overrides the default Export button. */
		actions?: Snippet;
	} = $props();
</script>

<div class="section-header">
	<h2>{title}{count !== undefined ? ` (${count})` : ''}</h2>
	{#if actions}
		{@render actions()}
	{:else if onExport}
		<Button variant="subtle" {disabled} onclick={onExport}>Export</Button>
	{/if}
</div>

<style>
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 4px;
		margin-bottom: 8px;
	}

	.section-header h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		padding: 0;
		border: none;
	}
</style>
