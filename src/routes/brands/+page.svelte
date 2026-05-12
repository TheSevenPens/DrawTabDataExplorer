<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import {
		type Brand,
		BRAND_FIELDS,
		BRAND_FIELD_GROUPS,
		BRAND_DEFAULT_COLUMNS,
		BRAND_DEFAULT_VIEW,
	} from '$data/lib/entities/brand-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: Brand[] = $state([]);

	onMount(async () => {
		const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base });
		data = await ds.Brands.toArray();
	});
</script>

<Nav />
<EntityExplorer
	title="Brands"
	entityType="brands"
	entityLabel="brands"
	{data}
	fields={BRAND_FIELDS}
	fieldGroups={BRAND_FIELD_GROUPS}
	defaultColumns={BRAND_DEFAULT_COLUMNS}
	defaultView={BRAND_DEFAULT_VIEW}
	detailBasePath="/entity"
	linkField="BrandName"
	defaultFilterField="BrandName"
/>
