<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadTabletsFromURL, loadPensFromURL, brandName, getDiagonal, type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
	import ValueHistogram, { type HistogramRange, type HistogramMarker } from '$lib/components/ValueHistogram.svelte';
	import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from '$data/lib/entities/tablet-fields.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue } from '$data/lib/units.js';
	import { flaggedTablets, toggleFlag, clearFlags } from '$lib/flagged-store.js';
	import Nav from '$lib/components/Nav.svelte';
	import { penTabletRangesCm, penTabletRangesIn, displayRangesCm, displayRangesIn, MM_TO_IN, MM_TO_CM } from '$lib/tablet-size-ranges.js';
	import { stripUnit, valueSuffix } from '$lib/field-display.js';
	import { buildPenNameMap, formatPenIds } from '$lib/pen-helpers.js';

	let activeTab: 'flagged' | 'compare' = $state('flagged');
	let allTablets: Tablet[] = $state([]);
	let allPens: Pen[] = $state([]);

	let penNameMap = $derived(buildPenNameMap(allPens));

	let flaggedItems = $derived(
		$flaggedTablets.map(id => allTablets.find(t => t.EntityId === id)).filter((t): t is Tablet => !!t)
	);

	function getDisplayVal(f: typeof TABLET_FIELDS[0], tablet: Tablet): string {
		if (f.key === 'ModelIncludedPen') {
			return formatPenIds(tablet.ModelIncludedPen ?? [], penNameMap);
		}
		const val = f.getValue(tablet);
		if (!val || val === '-') return '';
		const converted = formatValue(val, f.unit, $unitPreference);
		return converted + valueSuffix(f.label, f.unit, $unitPreference);
	}

	// Group fields and filter out those with no data across all flagged tablets
	let comparisonGroups = $derived.by(() => {
		if (flaggedItems.length === 0) return [];
		const groups: { group: string; fields: { label: string; values: string[]; differs: boolean }[] }[] = [];
		for (const groupName of TABLET_FIELD_GROUPS) {
			const groupFields = TABLET_FIELDS.filter(f => f.group === groupName);
			const rows: { label: string; values: string[]; differs: boolean }[] = [];
			for (const f of groupFields) {
				const values = flaggedItems.map(t => getDisplayVal(f, t));
				if (values.every(v => v === '')) continue;
				const unique = new Set(values.filter(v => v !== ''));
				rows.push({
					label: stripUnit(f.label, f.unit),
					values,
					differs: unique.size > 1,
				});
			}
			if (rows.length > 0) groups.push({ group: groupName, fields: rows });
		}
		return groups;
	});

	const currentYear = new Date().getFullYear();
	let isMetric = $derived($unitPreference === 'metric');

	let compareYearsPT = $state<number | null>(15);
	let compareYearsPD = $state<number | null>(15);

	let hasFlaggedPenTablets = $derived(flaggedItems.some(t => t.ModelType === 'PENTABLET'));
	let hasFlaggedPenDisplays = $derived(flaggedItems.some(t => t.ModelType !== 'PENTABLET'));

	let ptHistValues = $derived(
		allTablets
			.filter(t => {
				if (t.ModelType !== 'PENTABLET') return false;
				if (compareYearsPT !== null) {
					const y = parseInt(t.ModelLaunchYear, 10);
					if (!isNaN(y) && y < currentYear - compareYearsPT) return false;
				}
				return true;
			})
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let pdHistValues = $derived(
		allTablets
			.filter(t => {
				if (t.ModelType === 'PENTABLET') return false;
				if (compareYearsPD !== null) {
					const y = parseInt(t.ModelLaunchYear, 10);
					if (!isNaN(y) && y < currentYear - compareYearsPD) return false;
				}
				return true;
			})
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	function flaggedMarkers(type: 'PENTABLET' | 'PENDISPLAY'): HistogramMarker[] {
		return flaggedItems
			.filter(t => type === 'PENTABLET' ? t.ModelType === 'PENTABLET' : t.ModelType !== 'PENTABLET')
			.map(t => {
				const d = getDiagonal(t.DigitizerDimensions);
				if (!d) return null;
				return { value: isMetric ? d * MM_TO_CM : d * MM_TO_IN, label: `${t.ModelName}` };
			})
			.filter((m): m is HistogramMarker => m !== null);
	}

	let ptMarkers = $derived(flaggedMarkers('PENTABLET'));
	let pdMarkers = $derived(flaggedMarkers('PENDISPLAY'));

	function copyCompareTable() {
		const table = document.querySelector('#compare-table');
		if (table) navigator.clipboard.writeText(table.outerHTML);
	}

	function exportCompareHTML() {
		const table = document.querySelector('#compare-table');
		if (!table) return;
		const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Tablet Comparison</title>
<style>table{border-collapse:collapse;font-family:sans-serif;font-size:13px}th,td{padding:4px 10px;text-align:left;border:1px solid #ddd}th{background:#f3f4f6;font-weight:600}.group-header{background:#e5e7eb;font-weight:700}.differs{background:#fef3c7}</style>
</head><body>${table.outerHTML}</body></html>`;
		const blob = new Blob([html], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'tablet-comparison.html';
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(async () => {
		const [t, p] = await Promise.all([
			loadTabletsFromURL(base),
			loadPensFromURL(base) as Promise<Pen[]>,
		]);
		allTablets = t;
		allPens = p;
	});
</script>

<Nav />
<h1>Compare Tablets</h1>

<div class="tabs">
	<button class:active={activeTab === 'flagged'} onclick={() => activeTab = 'flagged'}>
		Flagged ({$flaggedTablets.length})
	</button>
	<button class:active={activeTab === 'compare'} onclick={() => activeTab = 'compare'}>
		Compare
	</button>
</div>

{#if activeTab === 'flagged'}
	{#if flaggedItems.length > 0}
		<div class="flagged-actions">
			<button class="clear-btn" onclick={clearFlags}>Clear all</button>
		</div>
		<ul class="flagged-list">
			{#each flaggedItems as t}
				<li>
					<button class="unflag-btn" onclick={() => toggleFlag(t.EntityId)} title="Unflag">&#x2691;</button>
					<a href="{base}/tablets/{encodeURIComponent(t.EntityId)}">{brandName(t.Brand)} {t.ModelName} ({t.ModelId})</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="no-data">No tablets flagged. Flag tablets from the <a href="{base}/">tablets list</a> or individual tablet detail pages.</p>
	{/if}
{:else}
	{#if flaggedItems.length < 2}
		<p class="no-data">Flag at least 2 tablets to compare. Currently {flaggedItems.length} flagged.</p>
	{:else}
		<div class="compare-toolbar">
			<button class="copy-btn" onclick={copyCompareTable}>Copy as HTML</button>
			<button class="copy-btn" onclick={exportCompareHTML}>Export as HTML</button>
		</div>
		<div class="compare-wrap">
			<table id="compare-table" class="compare-table">
				<thead>
					<tr>
						<th class="spec-col">Spec</th>
						{#each flaggedItems as t}
							<th><a href="{base}/tablets/{encodeURIComponent(t.EntityId)}">{brandName(t.Brand)} {t.ModelName}</a></th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each comparisonGroups as group}
						<tr class="group-row">
							<td class="group-header" colspan={flaggedItems.length + 1}>{group.group}</td>
						</tr>
						{#each group.fields as row}
							<tr>
								<td class="spec-label">{row.label}</td>
								{#each row.values as val}
									<td class:differs={row.differs && val !== ''}>{val || '-'}</td>
								{/each}
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>

		{#if hasFlaggedPenTablets && ptHistValues.length > 0}
			<section class="hist-section">
				<h2>Pen Tablet Size Comparison</h2>
				<ValueHistogram
					title="Flagged pen tablets compared to all pen tablets"
					values={ptHistValues}
					currentValue={null}
					ranges={isMetric ? penTabletRangesCm : penTabletRangesIn}
					unit={isMetric ? ' cm' : '"'}
					binSize={isMetric ? 1 : 0.5}
					bandwidthMultiplier={0.2}
					markers={ptMarkers}
					bind:compareYears={compareYearsPT}
				/>
			</section>
		{/if}

		{#if hasFlaggedPenDisplays && pdHistValues.length > 0}
			<section class="hist-section">
				<h2>Pen Display Size Comparison</h2>
				<ValueHistogram
					title="Flagged pen displays compared to all pen displays"
					values={pdHistValues}
					currentValue={null}
					ranges={isMetric ? displayRangesCm : displayRangesIn}
					unit={isMetric ? ' cm' : '"'}
					binSize={isMetric ? 1 : 0.5}
					bandwidthMultiplier={0.2}
					markers={pdMarkers}
					bind:compareYears={compareYearsPD}
				/>
			</section>
		{/if}
	{/if}
{/if}

<style>
	h1 { margin-bottom: 16px; }

	.hist-section {
		margin-top: 24px;
	}

	.hist-section h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 16px;
		font-size: 13px;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.tabs button:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	.tabs button.active {
		background: #2563eb;
		color: #fff;
		border-color: #2563eb;
	}

	.flagged-actions {
		margin-bottom: 12px;
	}

	.clear-btn {
		padding: 4px 12px;
		font-size: 13px;
		border: 1px solid #dc2626;
		border-radius: 4px;
		background: var(--bg-card);
		color: #dc2626;
		cursor: pointer;
	}

	.clear-btn:hover {
		background: #dc2626;
		color: #fff;
	}

	.flagged-list {
		list-style: none;
		padding: 0;
	}

	.flagged-list li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		font-size: 13px;
	}

	.flagged-list a {
		color: var(--link);
		text-decoration: none;
	}

	.flagged-list a:hover { text-decoration: underline; }

	.unflag-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #d97706;
		padding: 0;
		line-height: 1;
	}

	.unflag-btn:hover { color: #b45309; }

	.compare-toolbar {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.copy-btn {
		padding: 4px 12px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.copy-btn:hover {
		background: var(--hover-bg);
		color: var(--text);
	}

	.compare-wrap {
		overflow-x: auto;
	}

	.compare-table {
		border-collapse: collapse;
		font-size: 13px;
		min-width: 100%;
	}

	.compare-table th, .compare-table td {
		padding: 4px 10px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.compare-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
		position: sticky;
		top: 0;
	}

	.compare-table th a {
		color: var(--link);
		text-decoration: none;
	}

	.compare-table th a:hover { text-decoration: underline; }

	.spec-col {
		min-width: 150px;
	}

	.spec-label {
		font-weight: 600;
		color: var(--text-muted);
	}

	.group-header {
		font-weight: 700;
		background: var(--th-bg);
		color: #6b21a8;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.group-row td {
		border-bottom: 2px solid var(--border);
	}

	.differs {
		background: #fef3c7;
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}

	.no-data a {
		color: var(--link);
	}
</style>
