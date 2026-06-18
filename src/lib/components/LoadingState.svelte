<script lang="ts">
	// Shared loading placeholder (GitHub #237). Standardizes the ad-hoc
	// "Loading..." paragraphs (e.g. DetailView, sectioned pages) into one muted
	// style. Defaults to "Loading…"; pass children to override the copy.
	import type { Snippet } from 'svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<p class="loading-state">
	{#if children}{@render children()}{:else}Loading…{/if}
</p>

<style>
	.loading-state {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		margin: 0;
	}
</style>
