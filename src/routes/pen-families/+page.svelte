<script lang="ts">
	import {
		PEN_FAMILY_FIELDS,
		PEN_FAMILY_FIELD_GROUPS,
		PEN_FAMILY_DEFAULT_COLUMNS,
		PEN_FAMILY_DEFAULT_VIEW,
	} from '$data/lib/entities/pen-family-fields.js';
	import EntityListLayout from '$lib/components/EntityListLayout.svelte';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let penTabs = $derived(penSubNavTabs({ flaggedPenCount: $flaggedPenTotalCount }));
</script>

<EntityListLayout
	subNavTabs={penTabs}
	title="Pen Families"
	entityType="pen-families"
	entityLabel="pen families"
	data={data.families}
	fields={PEN_FAMILY_FIELDS}
	fieldGroups={PEN_FAMILY_FIELD_GROUPS}
	defaultColumns={PEN_FAMILY_DEFAULT_COLUMNS}
	defaultView={PEN_FAMILY_DEFAULT_VIEW}
	linkField="FamilyName"
	detailBasePath="/entity"
	defaultFilterField="EntityId"
	quickFilterFields={['Brand']}
/>
