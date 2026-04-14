<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadTabletsFromURL, type Tablet } from '$data/lib/drawtab-loader.js';
	import {
		TABLET_FIELDS,
		TABLET_FIELD_GROUPS,
		TABLET_DEFAULT_COLUMNS,
		TABLET_DEFAULT_VIEW,
	} from '$data/lib/entities/tablet-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import { flaggedTablets, toggleFlag } from '$lib/flagged-store.js';

	let data: Tablet[] = $state([]);
	let flaggedSet = $derived(new Set($flaggedTablets));

	onMount(async () => {
		data = await loadTabletsFromURL(base);
	});
</script>

<Nav />
<EntityExplorer
	title="Tablets"
	entityType="tablets"
	entityLabel="tablets"
	{data}
	fields={TABLET_FIELDS}
	fieldGroups={TABLET_FIELD_GROUPS}
	defaultColumns={TABLET_DEFAULT_COLUMNS}
	defaultView={TABLET_DEFAULT_VIEW}
	detailBasePath="/tablets"
	linkField="FullName"
	defaultFilterField="Brand"
	defaultSortField="Brand"
	quickFilterFields={["Brand", "ModelType", "DigitizerSizeCategory"]}
	flaggedIds={flaggedSet}
	onToggleFlag={toggleFlag}
/>
