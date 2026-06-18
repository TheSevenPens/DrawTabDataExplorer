<script lang="ts">
	// Shared table chrome (GitHub #229). Owns the *chrome* only — an optional
	// title + count badge + subtitle, a right-aligned table-level actions area
	// (where export/commands live, so they sit with the table they operate on),
	// and a consistent empty state. The table body stays a snippet/child so each
	// caller keeps its own columns/cells (per the #228 ruling: frames standardize
	// chrome, bodies stay specialized). Composes EmptyState (#237).
	import type { Snippet } from 'svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let {
		title,
		count,
		subtitle,
		actions,
		isEmpty = false,
		emptyMessage = 'No data.',
		empty,
		children,
	}: {
		title?: string;
		/** Optional count badge shown next to the title. */
		count?: number;
		subtitle?: string;
		/** Table-level commands (export, etc.), right-aligned in the header. */
		actions?: Snippet;
		isEmpty?: boolean;
		emptyMessage?: string;
		/** Custom empty content; overrides emptyMessage when provided. */
		empty?: Snippet;
		children: Snippet;
	} = $props();

	// Actions operate on the rows, so hide them when there's nothing to act on
	// (matches the prior per-table behavior of hiding export on empty).
	let showActions = $derived(Boolean(actions) && !isEmpty);
	let hasHeader = $derived(Boolean(title || subtitle || showActions));
</script>

<div class="table-frame">
	{#if hasHeader}
		<div class="tf-header">
			{#if title}
				<h3 class="tf-title">
					{title}{#if count != null}<span class="tf-count">{count}</span>{/if}
				</h3>
			{/if}
			{#if subtitle}<span class="tf-subtitle">{subtitle}</span>{/if}
			{#if actions}<div class="tf-actions">{@render actions()}</div>{/if}
		</div>
	{/if}

	{#if isEmpty}
		{#if empty}{@render empty()}{:else}<EmptyState>{emptyMessage}</EmptyState>{/if}
	{:else}
		{@render children()}
	{/if}
</div>

<style>
	.tf-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.tf-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.tf-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 10px;
		padding: 0 7px;
	}

	.tf-subtitle {
		font-size: 12px;
		color: var(--text-muted);
	}

	/* Right-align the actions; works with or without a title present. */
	.tf-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
	}
</style>
