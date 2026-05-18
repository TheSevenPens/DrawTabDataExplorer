<script lang="ts">
	import { buildFilterUrl } from '$lib/filter-url.js';
	import SectionHeader from '$lib/data-quality/SectionHeader.svelte';
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
</script>

<SectionHeader {title} disabled={stats.length === 0} onExport={doExport} />
{#if description}
	<p class="description">{description}</p>
{/if}
<table class="compact">
	<thead>
		<tr>
			<th>Field</th>
			<th>Populated</th>
			<th>%</th>
			<th></th>
			{#if filterBase}<th></th>{/if}
		</tr>
	</thead>
	<tbody>
		{#each stats as stat (stat.field)}
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
		color: #888;
		margin-bottom: 8px;
	}

	table {
		width: auto;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
		margin-bottom: 8px;
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
	tr:hover td {
		background: #f0f7ff;
	}

	.bar-bg {
		width: 120px;
		height: 14px;
		background: #eee;
		border-radius: 3px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		background: #2563eb;
		border-radius: 3px;
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
