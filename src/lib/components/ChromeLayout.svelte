<script lang="ts">
	// Shared app-chrome shell for arbitrary-content (non-list) pages: Nav +
	// optional SubNav + a content slot. List routes use EntityListLayout (which
	// wraps EntityExplorer); this is for pages that render their own content —
	// the Data routes (reference, data-quality, api-explorer). See GitHub #216.
	import type { Snippet } from 'svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import type { SubNavTab } from '$lib/nav/subnav-tabs.js';

	let { subNavTabs, children }: { subNavTabs?: SubNavTab[]; children: Snippet } = $props();
</script>

<Nav />
{#if subNavTabs}
	<SubNav tabs={subNavTabs} />
{/if}
{@render children()}
