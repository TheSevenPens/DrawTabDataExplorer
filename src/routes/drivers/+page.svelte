<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadDriversFromURL } from '$data/lib/drawtab-loader.js';
	import { type Driver, DRIVER_FIELDS, DRIVER_FIELD_GROUPS, DRIVER_DEFAULT_COLUMNS, DRIVER_DEFAULT_VIEW } from '$data/lib/entities/driver-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: Driver[] = $state([]);

	onMount(async () => {
		data = (await loadDriversFromURL(base)) as Driver[];
	});
</script>

<Nav />
<EntityExplorer
	title="Drivers"
	entityType="drivers"
	entityLabel="drivers"
	{data}
	fields={DRIVER_FIELDS}
	fieldGroups={DRIVER_FIELD_GROUPS}
	defaultColumns={DRIVER_DEFAULT_COLUMNS}
	defaultView={DRIVER_DEFAULT_VIEW}
	detailBasePath="/entity"
	linkField="DriverName"
	defaultFilterField="OSFamily"
	defaultSortField="ReleaseDate"
	quickFilterFields={["Brand"]}
/>
