<script lang="ts">
	let {
		title,
		count,
		disabled = false,
		onExport,
	}: {
		title: string;
		count?: number;
		disabled?: boolean;
		onExport: () => void;
	} = $props();
</script>

<div class="section-header">
	<h2>{title}{count !== undefined ? ` (${count})` : ''}</h2>
	<button class="export-trigger" {disabled} onclick={onExport}>Export</button>
</div>

<style>
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		border-bottom: 2px solid var(--border, #e0e0e0);
		padding-bottom: 4px;
		margin-bottom: 8px;
	}

	.section-header h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin: 0;
		padding: 0;
		border: none;
	}

	.export-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		background: var(--bg-card, #fff);
		color: var(--text-muted, #666);
		cursor: pointer;
	}
	.export-trigger:hover {
		border-color: var(--text-dim, #999);
		color: var(--text, #333);
	}
	.export-trigger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
