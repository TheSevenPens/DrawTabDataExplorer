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
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		font-weight: 600;
	}
	.export-btn:hover:not(:disabled) {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
