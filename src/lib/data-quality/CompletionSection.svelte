<script lang="ts">
	import { buildFilterUrl } from '$lib/filter-url.js';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import { sortRows, type SortDir } from '$lib/components/sortable-table.js';
	import type { CompletionStat } from '$lib/data-quality/helpers.js';

	type ExportRow = string | number;
	type OpenExport = (
		title: string,
		filename: string,
		headers: string[],
		rows: ExportRow[][],
	) => void;

	let {
		title,
		exportTitle,
		filename,
		description,
		stats,
		filterBase,
		openExport,
	}: {
		/** Section heading, e.g. "Tablet Field Completion". */
		title: string;
		/** ExportDialog title, e.g. "Tablet Field Completion". */
		exportTitle: string;
		/** Slug for downloaded files. */
		filename: string;
		/** Optional paragraph rendered before the table. */
		description?: string;
		stats: CompletionStat[];
		/** Path to filter-link from each row, or null/undefined to hide the link column. */
		filterBase?: string | null;
		openExport: OpenExport;
	} = $props();

	function doExport() {
		openExport(
			exportTitle,
			filename,
			['Field', 'Populated', '%'],
			stats.map((s) => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`]),
		);
	}

	// Clickable-header sorting (Field / Populated / %); other columns are static.
	let sortKey = $state('');
	let sortDir = $state<SortDir>('asc');
	const accessors: Record<string, (s: CompletionStat) => string | number> = {
		field: (s) => s.field,
		populated: (s) => s.populated,
		percent: (s) => s.percent,
	};
	function toggleSort(key: string) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
	}
	let sortedStats = $derived(sortKey ? sortRows(stats, accessors[sortKey], sortDir) : stats);
	const arrow = (key: string) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');
</script>

<SectionHeader {title} />
{#if description}
	<p class="description">{description}</p>
{/if}
<div class="table-controls">
	<Button variant="subtle" disabled={stats.length === 0} onclick={doExport}>Export</Button>
</div>
<table class="compact">
	<thead>
		<tr>
			<th class="sortable" onclick={() => toggleSort('field')}>Field{arrow('field')}</th>
			<th class="sortable" onclick={() => toggleSort('populated')}>Populated{arrow('populated')}</th
			>
			<th class="sortable" onclick={() => toggleSort('percent')}>%{arrow('percent')}</th>
			<th></th>
			{#if filterBase}<th></th>{/if}
		</tr>
	</thead>
	<tbody>
		{#each sortedStats as stat (stat.field)}
			<tr>
				<td>{stat.field}</td>
				<td>{stat.populated} / {stat.total}</td>
				<td>{stat.percent}%</td>
				<td>
					<div class="bar-bg">
						<div class="bar-fill" style="width: {stat.percent}%"></div>
					</div>
				</td>
				{#if filterBase}
					<td>
						{#if stat.populated < stat.total}
							{@const u = buildFilterUrl(filterBase, [
								{ field: stat.field, operator: 'empty', value: '' },
							])}
							<a class="view-link" href={u}>show</a>
						{/if}
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.description {
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.table-controls {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 8px;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}
	th.sortable:hover {
		color: var(--text);
	}

	/*
	 * Restated the whole table locally with hard-coded light-mode colours
	 * (#fff ground, #333 header, #e0e0e0 rules) that overrode the globals
	 * and rendered wrong on dark. The shared :global(table) rules in
	 * +layout.svelte cover all of it; only the width override is local.
	 */
	table {
		width: auto;
		margin-bottom: 8px;
	}

	.bar-bg {
		width: 120px;
		height: 14px;
		background: var(--hover-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	/* The completion bar is a measure, so it reads as the accent. */
	.bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: var(--radius);
		transition: width 0.3s;
	}

	.view-link {
		font-size: 12px;
		color: var(--link);
		text-decoration: none;
		white-space: nowrap;
	}
	.view-link:hover {
		text-decoration: underline;
	}
</style>
