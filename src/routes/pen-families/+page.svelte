<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadPenFamiliesFromURL, loadPensFromURL } from '$data/lib/drawtab-loader.js';
	import { type PenFamily, PEN_FAMILY_FIELDS, PEN_FAMILY_FIELD_GROUPS, PEN_FAMILY_DEFAULT_COLUMNS, PEN_FAMILY_DEFAULT_VIEW, setPenFamilyMemberCounts } from '$data/lib/entities/pen-family-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: PenFamily[] = $state([]);

	onMount(async () => {
		const [families, pens] = await Promise.all([
			loadPenFamiliesFromURL(base),
			loadPensFromURL(base),
		]);
		const counts: Record<string, number> = {};
		for (const p of pens) {
			if (p.PenFamily) counts[p.PenFamily] = (counts[p.PenFamily] ?? 0) + 1;
		}
		setPenFamilyMemberCounts(counts);
		data = families as PenFamily[];
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
	linkField="FamilyName"
	detailBasePath="/entity"
	defaultFilterField="FamilyId"
	defaultSortField="FamilyId"
	quickFilterFields={["Brand"]}
/>
