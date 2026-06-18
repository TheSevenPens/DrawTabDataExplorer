<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	let {
		disabled = false,
		onclick,
	}: {
		disabled?: boolean;
		onclick: () => void;
	} = $props();
</script>

<div class="table-export">
	<Button variant="subtle" {disabled} {onclick}>Export</Button>
</div>

<style>
	.table-export {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}
</style>
