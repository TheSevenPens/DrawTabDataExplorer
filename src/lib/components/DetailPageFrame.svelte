<script lang="ts">
	// Shared entity-detail page header (GitHub #233). Owns the top chrome every
	// detail page repeats: <Nav/> + a title row with an optional right-aligned
	// actions area (flag / copy / export). The page body (DetailView, Tabs, etc.)
	// stays a sibling after this component — deliberately NOT wrapped as children,
	// so each detail page keeps its own structure and we avoid nesting its
	// top-level snippets.
	import type { Snippet } from 'svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { title, actions }: { title: string; actions?: Snippet } = $props();
</script>

<Nav />

<div class="detail-header">
	<h1>{title}</h1>
	{#if actions}{@render actions()}{/if}
</div>

<style>
	.detail-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}

	.detail-header h1 {
		margin: 0;
	}
</style>
