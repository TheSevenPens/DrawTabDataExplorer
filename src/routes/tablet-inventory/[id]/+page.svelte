<script lang="ts">
	import InventoryTabletDetail from '$lib/components/InventoryTabletDetail.svelte';

	let { data } = $props();
</script>

<InventoryTabletDetail {data} />
