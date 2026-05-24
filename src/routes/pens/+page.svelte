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
	import {
		flaggedPenModels,
		flaggedPenModelCount,
		flaggedPenTotalCount,
		toggleFlaggedPenModel,
	} from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let penTabs = $derived(
		penSubNavTabs({
			flaggedPenCount: $flaggedPenTotalCount,
			flaggedPenModelCount: $flaggedPenModelCount,
		}),
	);

	// flaggedPenModels stores lowercased EntityIds, which matches the lowercase
	// EntityIds the rows expose, so direct Set.has() lookups work.
	let flaggedSet = $derived(new Set($flaggedPenModels));

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
	flaggedIds={flaggedSet}
	onToggleFlag={toggleFlaggedPenModel}
/>
