<script lang="ts">
	// Generic clickable-header sortable table with an Export button on a
	// controls row directly above the table. Used by the Data Quality tables.
	// Cells are configured via `columns` (see SortableColumn); link cells render
	// an <a href>. Sorting is column-driven and lives in component state.
	import Button from '$lib/components/Button.svelte';
	import { sortRows, type SortDir, type SortableColumn } from './sortable-table.js';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Row = any;

	let {
		columns,
		rows,
		rowKey = (_row: Row, i: number) => i,
		tableClass = '',
		onExport,
		exportDisabled = false,
	}: {
		columns: SortableColumn[];
		rows: Row[];
		rowKey?: (row: Row, i: number) => string | number;
		tableClass?: string;
		onExport?: () => void;
		exportDisabled?: boolean;
	} = $props();

	let sortKey = $state('');
	let sortDir = $state<SortDir>('asc');

	function headerClick(col: SortableColumn) {
		if (col.sortable === false) return;
		if (sortKey === col.key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = col.key;
			sortDir = 'asc';
		}
	}

	let sortedRows = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey);
		if (!col) return rows;
		const acc = col.sortValue ?? col.get;
		return sortRows(rows, acc, sortDir);
	});
</script>

{#if onExport}
	<div class="table-controls">
		<Button variant="subtle" disabled={exportDisabled} onclick={onExport}>Export</Button>
	</div>
{/if}

<table class={tableClass}>
	<thead>
		<tr>
			{#each columns as col (col.key)}
				{@const isSortable = col.sortable !== false}
				{@const active = sortKey === col.key}
				<th
					class:num={col.num}
					class:sortable={isSortable}
					aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
					onclick={() => headerClick(col)}
				>
					{col.label}{#if active}<span class="arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>{/if}
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each sortedRows as row, i (rowKey(row, i))}
			<tr>
				{#each columns as col (col.key)}
					{@const val = col.get(row)}
					{@const href = col.href?.(row)}
					<td class:num={col.num} class:mono={col.mono}>
						{#if href}<a {href}>{val}</a>{:else}{val}{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.table-controls {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 8px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
		margin-bottom: 8px;
	}

	table.compact {
		width: auto;
	}

	th,
	td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #333;
		color: #fff;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		background: #444;
	}

	th.num,
	td.num {
		text-align: right;
	}

	.arrow {
		font-size: 10px;
	}

	tr:hover td {
		background: #f0f7ff;
	}

	td :global(a) {
		color: var(--link);
		text-decoration: none;
	}

	td :global(a:hover) {
		text-decoration: underline;
	}

	.mono {
		font-family: monospace;
		font-size: 12px;
	}
</style>
