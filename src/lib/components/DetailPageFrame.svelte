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
		gap: 12px;
		margin-bottom: 18px;
	}

	/*
	 * Unlike the list routes, an entity's name is not restated by the Nav,
	 * so this is where Metro's light display type earns its place.
	 *
	 * Deliberately NOT lowercased: in Zune the chrome words were lowercase
	 * but content kept its authored case. "KP-503E" is data, not chrome —
	 * lowercasing it would misrepresent the record.
	 */
	.detail-header h1 {
		margin: 0;
		font-size: var(--type-title);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-display);
		line-height: 1.05;
	}
</style>
