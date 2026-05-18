<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import { penFullName, comparePenByYearDesc } from '$lib/pen-helpers.js';

	let { tablet, compatiblePens }: { tablet: Tablet; compatiblePens: Pen[] } = $props();

	let sortedPens: Pen[] = $derived([...compatiblePens].sort(comparePenByYearDesc));
</script>

{#if sortedPens.length > 0}
	<div class="table-header">
		<ExportTableButton
			entityType="tablet-pens"
			title={`Compatible Pens — ${tabletBrandAndName(tablet)}`}
			filename={`${tablet.Meta.EntityId}-compatible-pens`}
			headers={['Pen', 'Entity ID', 'Brand', 'Year']}
			rows={sortedPens.map((p) => [
				penFullName(p),
				p.EntityId,
				brandName(p.Brand),
				p.PenYear ?? '',
			])}
		/>
	</div>
	<table class="compat-table">
		<thead>
			<tr>
				<th>Pen</th>
				<th>Brand</th>
				<th>Year</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedPens as pen (pen.EntityId)}
				<tr>
					<td
						><a href={resolve('/entity/[entityId]', { entityId: pen.EntityId })}
							>{penFullName(pen)}</a
						></td
					>
					<td>{brandName(pen.Brand)}</td>
					<td>{pen.PenYear ?? ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="no-data">No pen compatibility data available for this tablet.</p>
{/if}

<style>
	.table-header {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 8px;
	}

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

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
