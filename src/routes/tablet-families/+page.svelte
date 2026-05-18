<script lang="ts">
	import {
		TABLET_FAMILY_FIELDS,
		TABLET_FAMILY_FIELD_GROUPS,
		TABLET_FAMILY_DEFAULT_COLUMNS,
		TABLET_FAMILY_DEFAULT_VIEW,
	} from '$data/lib/entities/tablet-family-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';
	import { tabletSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let tabletTabs = $derived(tabletSubNavTabs({ flaggedCount: $flaggedCount }));
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<EntityExplorer
	title="Tablet Families"
	entityType="tablet-families"
	entityLabel="tablet families"
	data={data.data}
	fields={TABLET_FAMILY_FIELDS}
	fieldGroups={TABLET_FAMILY_FIELD_GROUPS}
	defaultColumns={TABLET_FAMILY_DEFAULT_COLUMNS}
	defaultView={TABLET_FAMILY_DEFAULT_VIEW}
	linkField="FamilyName"
	detailBasePath="/entity"
	defaultFilterField="FamilyName"
	quickFilterFields={['Brand']}
/>
