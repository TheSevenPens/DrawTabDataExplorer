<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadTabletFamiliesFromURL } from '$data/lib/drawtab-loader.js';
	import { type TabletFamily, TABLET_FAMILY_FIELDS, TABLET_FAMILY_FIELD_GROUPS, TABLET_FAMILY_DEFAULT_COLUMNS, TABLET_FAMILY_DEFAULT_VIEW } from '$data/lib/entities/tablet-family-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: TabletFamily[] = $state([]);

	onMount(async () => {
		data = (await loadTabletFamiliesFromURL(base)) as TabletFamily[];
	});
</script>

<Nav />
<EntityExplorer
	title="Tablet Families"
	entityType="tablet-families"
	entityLabel="tablet families"
	{data}
	fields={TABLET_FAMILY_FIELDS}
	fieldGroups={TABLET_FAMILY_FIELD_GROUPS}
	defaultColumns={TABLET_FAMILY_DEFAULT_COLUMNS}
	defaultView={TABLET_FAMILY_DEFAULT_VIEW}
	linkField="FamilyName"
	detailBasePath="/tablet-families"
	defaultFilterField="FamilyId"
	defaultSortField="FamilyId"
	quickFilterFields={["Brand"]}
/>
