<script lang="ts">
	let {
		disabled = false,
		onclick,
	}: {
		disabled?: boolean;
		onclick: () => void;
	} = $props();
</script>

<div class="table-export">
	<button class="export-trigger" {disabled} {onclick}>Export</button>
</div>

<style>
	.table-export {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.export-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}
	.export-trigger:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}
	.export-trigger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
