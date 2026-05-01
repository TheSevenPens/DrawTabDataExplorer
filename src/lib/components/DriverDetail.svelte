<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import {
		type Driver,
		DRIVER_FIELDS,
		DRIVER_FIELD_GROUPS,
	} from '$data/lib/entities/driver-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let { data } = $props();
	let driver: Driver = $derived(data.driver);

	const nameField = DRIVER_FIELDS.find((f) => f.key === 'DriverName');
	let driverName = $derived(nameField ? nameField.getValue(driver) : driver.DriverVersion);
</script>

<Nav />

<h1>{driverName}</h1>
<DetailView item={driver} fields={DRIVER_FIELDS} fieldGroups={DRIVER_FIELD_GROUPS} />
