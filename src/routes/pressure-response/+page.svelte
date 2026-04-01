<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadPressureResponseFromURL } from '$data/lib/drawtab-loader.js';
	import { type PressureResponse, PRESSURE_RESPONSE_FIELDS, PRESSURE_RESPONSE_FIELD_GROUPS, PRESSURE_RESPONSE_DEFAULT_COLUMNS, PRESSURE_RESPONSE_DEFAULT_VIEW } from '$data/lib/entities/pressure-response-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: PressureResponse[] = $state([]);

	onMount(async () => {
		data = await loadPressureResponseFromURL(base);
	});
</script>

<Nav />
<EntityExplorer
	title="Pressure Response"
	entityType="pressure-response"
	entityLabel="sessions"
	{data}
	fields={PRESSURE_RESPONSE_FIELDS}
	fieldGroups={PRESSURE_RESPONSE_FIELD_GROUPS}
	defaultColumns={PRESSURE_RESPONSE_DEFAULT_COLUMNS}
	defaultView={PRESSURE_RESPONSE_DEFAULT_VIEW}
	defaultFilterField="Brand"
	defaultSortField="Date"
/>
