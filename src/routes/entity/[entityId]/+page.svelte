<script lang="ts">
	import TabletDetail from '$lib/components/TabletDetail.svelte';
	import PenDetail from '$lib/components/PenDetail.svelte';
	import BrandDetail from '$lib/components/BrandDetail.svelte';
	import DriverDetail from '$lib/components/DriverDetail.svelte';
	import PenFamilyDetail from '$lib/components/PenFamilyDetail.svelte';
	import TabletFamilyDetail from '$lib/components/TabletFamilyDetail.svelte';
	import SessionDetail from '$lib/components/SessionDetail.svelte';

	let { data } = $props();
</script>

{#if data.entityType === 'tablet'}
	<TabletDetail {data} />
{:else if data.entityType === 'pen'}
	<PenDetail {data} />
{:else if data.entityType === 'brand'}
	<BrandDetail {data} />
{:else if data.entityType === 'driver'}
	<DriverDetail {data} />
{:else if data.entityType === 'penfamily'}
	<PenFamilyDetail {data} />
{:else if data.entityType === 'tabletfamily'}
	<TabletFamilyDetail {data} />
{:else if data.entityType === 'session'}
	<SessionDetail {data} />
{:else}
	<h1>Unknown entity</h1>
	<p>Entity type not recognised.</p>
{/if}
