<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadPenFamiliesFromURL } from '$data/lib/drawtab-loader.js';
	import { type PenFamily, PEN_FAMILY_FIELDS, PEN_FAMILY_FIELD_GROUPS, PEN_FAMILY_DEFAULT_COLUMNS, PEN_FAMILY_DEFAULT_VIEW } from '$data/lib/entities/pen-family-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: PenFamily[] = $state([]);

	onMount(async () => {
		data = (await loadPenFamiliesFromURL(base)) as PenFamily[];
	});
</script>

<Nav />
<EntityExplorer
	title="Pen Families"
	entityType="pen-families"
	entityLabel="pen families"
	{data}
	fields={PEN_FAMILY_FIELDS}
	fieldGroups={PEN_FAMILY_FIELD_GROUPS}
	defaultColumns={PEN_FAMILY_DEFAULT_COLUMNS}
	defaultView={PEN_FAMILY_DEFAULT_VIEW}
	detailBasePath="/pen-families"
	defaultFilterField="FamilyId"
	defaultSortField="FamilyId"
	quickFilterFields={["Brand"]}
/>
