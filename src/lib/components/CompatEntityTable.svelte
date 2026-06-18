<script lang="ts">
	// Shared "compatible entities" table used by:
	//   - PenDetail (Compatible Tablets, Included With tabs)
	//   - TabletCompatiblePensTab (Compatible Pens tab)
	//   - PenFamilyDetail (Members list)
	//
	// Each row's first cell is rendered as a link via `href`; remaining
	// cells render as plain text. Export rows can differ in shape from
	// display rows (e.g. include the Entity ID column) so they're passed
	// separately.

	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import TableFrame from '$lib/components/TableFrame.svelte';

	type Cell = string | number | null | undefined;

	export type CompatRow = {
		/** Anchor href (already resolved). Used by the first cell. */
		href: string;
		/** Display cells in column order; the first becomes the linked label. */
		cells: [Cell, ...Cell[]];
	};

	let {
		columns,
		rows,
		emptyMessage,
		exportEntityType,
		exportTitle,
		exportFilename,
		exportHeaders,
		exportRows,
	}: {
		columns: string[];
		rows: CompatRow[];
		emptyMessage: string;
		exportEntityType: string;
		exportTitle: string;
		exportFilename: string;
		exportHeaders: string[];
		exportRows: (string | number)[][];
	} = $props();
</script>

<TableFrame isEmpty={rows.length === 0} {emptyMessage}>
	{#snippet actions()}
		<ExportTableButton
			entityType={exportEntityType}
			title={exportTitle}
			filename={exportFilename}
			headers={exportHeaders}
			rows={exportRows}
		/>
	{/snippet}
	<table class="compat-table">
		<thead>
			<tr>
				{#each columns as col (col)}
					<th>{col}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, i (i)}
				<tr>
					<td>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={row.href}>{row.cells[0] ?? ''}</a>
					</td>
					{#each row.cells.slice(1) as cell, j (j)}
						<td>{cell ?? ''}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</TableFrame>

<style>
	.compat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.compat-table th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.compat-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.compat-table a {
		color: var(--link);
		text-decoration: none;
	}
	.compat-table a:hover {
		text-decoration: underline;
	}
</style>
