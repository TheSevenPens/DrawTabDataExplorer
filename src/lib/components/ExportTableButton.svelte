<script lang="ts">
	import ExportDialog from '$lib/components/ExportDialog.svelte';

	interface Props {
		title: string;
		filename: string;
		headers: string[];
		rows: (string | number)[][];
		entityType?: string;
		disabled?: boolean;
	}

	let { title, filename, headers, rows, entityType = 'table', disabled = false }: Props = $props();

	let open = $state(false);
</script>

<button class="export-btn" {disabled} onclick={() => (open = true)}>Export</button>

{#if open}
	<ExportDialog {entityType} {title} {filename} {headers} {rows} onclose={() => (open = false)} />
{/if}

<style>
	.export-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #6b7280;
		border-radius: 4px;
		background: var(--bg-card);
		color: #6b7280;
		cursor: pointer;
		font-weight: 600;
	}
	.export-btn:hover:not(:disabled) {
		background: #6b7280;
		color: #fff;
	}
	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
