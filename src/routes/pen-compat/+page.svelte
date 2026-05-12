<script lang="ts">
	import {
		PEN_COMPAT_FIELDS,
		PEN_COMPAT_FIELD_GROUPS,
		PEN_COMPAT_DEFAULT_COLUMNS,
		PEN_COMPAT_DEFAULT_VIEW,
	} from '$data/lib/entities/pen-compat-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	let { data } = $props();

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/api-explorer', label: 'API Explorer' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];
</script>

<Nav />
<SubNav tabs={dataTabs} />
<EntityExplorer
	title="Pen Compatibility"
	entityType="pen-compat"
	entityLabel="compatibility rows"
	data={data.data}
	fields={PEN_COMPAT_FIELDS}
	fieldGroups={PEN_COMPAT_FIELD_GROUPS}
	defaultColumns={PEN_COMPAT_DEFAULT_COLUMNS}
	defaultView={PEN_COMPAT_DEFAULT_VIEW}
	defaultFilterField="TabletFullName"
	quickFilterFields={['Brand']}
/>
