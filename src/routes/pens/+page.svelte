<script lang="ts">
	import { base } from '$app/paths';
	import {
		type Pen,
		PEN_FIELDS,
		PEN_FIELD_GROUPS,
		PEN_DEFAULT_COLUMNS,
		PEN_DEFAULT_VIEW,
	} from '$data/lib/entities/pen-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let penTabs = $derived(penSubNavTabs({ flaggedPenCount: $flaggedPenTotalCount }));

	let cellLinks = $derived({
		PenFamily: (p: Pen) => {
			const id = p.PenFamily;
			if (!id) return [];
			return [
				{
					label: data.familyNames[id] ?? id,
					href: `${base}/entity/${encodeURIComponent(id)}`,
				},
			];
		},
	});
</script>

<Nav />
<SubNav tabs={penTabs} />
<EntityExplorer
	title="Pens"
	entityType="pens"
	entityLabel="pens"
	data={data.pens}
	fields={PEN_FIELDS}
	fieldGroups={PEN_FIELD_GROUPS}
	defaultColumns={PEN_DEFAULT_COLUMNS}
	defaultView={PEN_DEFAULT_VIEW}
	linkField="FullName"
	detailBasePath="/entity"
	{cellLinks}
	defaultFilterField="PenFamily"
	quickFilterFields={['Brand']}
/>
