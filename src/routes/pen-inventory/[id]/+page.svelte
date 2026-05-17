<script lang="ts">
	import InventoryPenDetail from '$lib/components/InventoryPenDetail.svelte';

	let { data } = $props();
</script>

<InventoryPenDetail {data} />
