<script lang="ts">
	// Import each type-specific detail page as a reusable Svelte component.
	// SvelteKit +page.svelte files are plain Svelte components and can be
	// imported and composed like any other component.
	import TabletPage      from '../../tablets/[entityId]/+page.svelte';
	import PenPage         from '../../pens/[entityId]/+page.svelte';
	import BrandPage       from '../../brands/[entityId]/+page.svelte';
	import DriverPage      from '../../drivers/[entityId]/+page.svelte';
	import PenFamilyPage   from '../../pen-families/[entityId]/+page.svelte';
	import TabletFamilyPage from '../../tablet-families/[entityId]/+page.svelte';

	let { data } = $props();
</script>

{#if data.entityType === 'tablet'}
	<TabletPage data={data as any} />
{:else if data.entityType === 'pen'}
	<PenPage data={data as any} />
{:else if data.entityType === 'brand'}
	<BrandPage data={data as any} />
{:else if data.entityType === 'driver'}
	<DriverPage data={data as any} />
{:else if data.entityType === 'penfamily'}
	<PenFamilyPage data={data as any} />
{:else if data.entityType === 'tabletfamily'}
	<TabletFamilyPage data={data as any} />
{:else}
	<h1>Unknown entity</h1>
	<p>Entity type not recognised.</p>
{/if}
