<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadDriversFromURL } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Driver, DRIVER_FIELDS, DRIVER_FIELD_GROUPS } from '$data/lib/entities/driver-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let driver: Driver | null = $state(null);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId!);
		const all = (await loadDriversFromURL(base)) as Driver[];
		const found = all.find((d) => d.EntityId === entityId);
		if (found) {
			driver = found;
		} else {
			notFound = true;
		}
	});
</script>

<Nav />

{#if notFound}
	<h1>Driver not found</h1>
	<p><a href="{base}/drivers">Back to drivers</a></p>
{:else}
	<h1>{driver?.DriverName ?? 'Loading...'}</h1>
	<DetailView
		item={driver}
		fields={DRIVER_FIELDS}
		fieldGroups={DRIVER_FIELD_GROUPS}
/>
{/if}
