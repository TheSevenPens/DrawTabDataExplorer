<script lang="ts">
	import {
		BRAND_FIELDS,
		BRAND_FIELD_GROUPS,
		BRAND_DEFAULT_COLUMNS,
		BRAND_DEFAULT_VIEW,
	} from '$data/lib/entities/brand-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();
</script>

<Nav />
<EntityExplorer
	title="Brands"
	entityType="brands"
	entityLabel="brands"
	data={data.brands}
	fields={BRAND_FIELDS}
	fieldGroups={BRAND_FIELD_GROUPS}
	defaultColumns={BRAND_DEFAULT_COLUMNS}
	defaultView={BRAND_DEFAULT_VIEW}
	detailBasePath="/entity"
	linkField="BrandName"
	defaultFilterField="BrandName"
/>
