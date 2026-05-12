<script lang="ts">
	import {
		DRIVER_FIELDS,
		DRIVER_FIELD_GROUPS,
		DRIVER_DEFAULT_COLUMNS,
		DRIVER_DEFAULT_VIEW,
	} from '$data/lib/entities/driver-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();
</script>

<Nav />
<EntityExplorer
	title="Drivers"
	entityType="drivers"
	entityLabel="drivers"
	data={data.drivers}
	fields={DRIVER_FIELDS}
	fieldGroups={DRIVER_FIELD_GROUPS}
	defaultColumns={DRIVER_DEFAULT_COLUMNS}
	defaultView={DRIVER_DEFAULT_VIEW}
	detailBasePath="/entity"
	linkField="DriverName"
	defaultFilterField="OSFamily"
	quickFilterFields={['Brand']}
/>
