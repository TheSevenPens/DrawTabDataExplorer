<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadPensFromURL, loadPenFamiliesFromURL } from '$data/lib/drawtab-loader.js';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS, PEN_DEFAULT_COLUMNS, PEN_DEFAULT_VIEW, setPenFamilyNames } from '$data/lib/entities/pen-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: Pen[] = $state([]);

	onMount(async () => {
		const [pens, families] = await Promise.all([
			loadPensFromURL(base),
			loadPenFamiliesFromURL(base),
		]);
		const familyNames: Record<string, string> = {};
		for (const f of families) familyNames[f.FamilyId] = f.FamilyName;
		setPenFamilyNames(familyNames);
		data = pens as Pen[];
	});
</script>

<Nav />
<EntityExplorer
	title="Pens"
	entityType="pens"
	entityLabel="pens"
	{data}
	fields={PEN_FIELDS}
	fieldGroups={PEN_FIELD_GROUPS}
	defaultColumns={PEN_DEFAULT_COLUMNS}
	defaultView={PEN_DEFAULT_VIEW}
	detailBasePath="/pens"
	defaultFilterField="PenFamily"
	defaultSortField="PenId"
	quickFilterFields={["Brand"]}
/>
