<script lang="ts">
	import {
		BRAND_FIELDS,
		BRAND_FIELD_GROUPS,
		BRAND_DEFAULT_COLUMNS,
		BRAND_DEFAULT_VIEW,
	} from '$data/lib/entities/brand-fields.js';
	import EntityListLayout from '$lib/components/EntityListLayout.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();
</script>

<EntityListLayout
	title="Brands"
	subNavTabs={dataSubNavTabs()}
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
