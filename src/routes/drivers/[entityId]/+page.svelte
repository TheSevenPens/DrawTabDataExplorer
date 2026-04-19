<script lang="ts">
	import { base } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import { type Driver, DRIVER_FIELDS, DRIVER_FIELD_GROUPS } from '$data/lib/entities/driver-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let { data } = $props();
	let driver: Driver = $derived(data.driver);
</script>

<Nav />

<h1>{driver.DriverName}</h1>
<DetailView item={driver} fields={DRIVER_FIELDS} fieldGroups={DRIVER_FIELD_GROUPS} />
