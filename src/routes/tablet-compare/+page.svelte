<script lang="ts">
	import { base } from '$app/paths';
	import { brandName, getDiagonal, type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
	import ValueHistogram, {
		type HistogramRange,
		type HistogramMarker,
	} from '$lib/components/ValueHistogram.svelte';
	import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from '$data/lib/entities/tablet-fields.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue } from '$data/lib/units.js';
	import { flaggedTablets, flaggedCount, toggleFlag, clearFlags } from '$lib/flagged-store.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import TabletPicker from '$lib/components/TabletPicker.svelte';
	import TabletDimensionComparison from '$lib/components/TabletDimensionComparison.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import {
		penTabletRangesCm,
		penTabletRangesIn,
		displayRangesCm,
		displayRangesIn,
		mixedRangesCm,
		mixedRangesIn,
		MM_TO_IN,
		MM_TO_CM,
	} from '$lib/tablet-size-ranges.js';
	import { stripUnit, valueSuffix } from '$lib/field-display.js';
	import { buildPenNameMap, formatPenIds } from '$lib/pen-helpers.js';

	let { data } = $props();

	let tabletTabs = $derived([
		{ href: '/tablets', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/tablet-inventory', label: 'Inventory' },
		{ href: '/tablet-compare', label: 'Compare', badge: $flaggedCount },
	]);

	let activeTab: 'flagged' | 'compare' | 'sizes' = $state('flagged');
	let showPicker = $state(false);
	let allTablets: Tablet[] = $derived(data.allTablets ?? []);
	let allPens: Pen[] = $derived(data.allPens ?? []);

	let penNameMap = $derived(buildPenNameMap(allPens));

	let flaggedItems = $derived(
		$flaggedTablets
			.map((id) => allTablets.find((t) => t.Meta.EntityId === id))
			.filter((t): t is Tablet => !!t),
	);

	function getDisplayVal(f: (typeof TABLET_FIELDS)[0], tablet: Tablet): string {
		if (f.key === 'ModelIncludedPen') {
			return formatPenIds(tablet.Model.IncludedPen ?? [], penNameMap);
		}
		const val = f.getValue(tablet);
		if (!val || val === '-') return '';
		const converted = formatValue(val, f.unit, $unitPreference);
		return converted + valueSuffix(f.label, f.unit, $unitPreference);
	}

	// Group fields and filter out those with no data across all flagged tablets
	let comparisonGroups = $derived.by(() => {
		if (flaggedItems.length === 0) return [];
		const groups: {
			group: string;
			fields: { label: string; values: string[]; differs: boolean }[];
		}[] = [];
		for (const groupName of TABLET_FIELD_GROUPS) {
			const groupFields = TABLET_FIELDS.filter((f) => f.group === groupName);
			const rows: { label: string; values: string[]; differs: boolean }[] = [];
			for (const f of groupFields) {
				const values = flaggedItems.map((t) => getDisplayVal(f, t));
				if (values.every((v) => v === '')) continue;
				const unique = new Set(values.filter((v) => v !== ''));
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
	let compareYearsMixed = $state<number | null>(15);

	let hasFlaggedPenTablets = $derived(flaggedItems.some((t) => t.Model.Type === 'PENTABLET'));
	let hasFlaggedPenDisplays = $derived(flaggedItems.some((t) => t.Model.Type !== 'PENTABLET'));
	let hasMixedTypes = $derived(hasFlaggedPenTablets && hasFlaggedPenDisplays);

	let dimCompItems = $derived(
		flaggedItems
			.filter(
				(t) => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null,
			)
			.map((t) => ({
				dims: t.Digitizer!.Dimensions!,
				label: `${brandName(t.Model.Brand)} ${t.Model.Name}`,
			})),
	);
	let stackedDims = $state(true);

	function histValues(
		typeFilter: 'PENTABLET' | 'PENDISPLAY' | 'ALL',
		compareYears: number | null,
	): number[] {
		return allTablets
			.filter((t) => {
				if (typeFilter === 'PENTABLET' && t.Model.Type !== 'PENTABLET') return false;
				if (typeFilter === 'PENDISPLAY' && t.Model.Type === 'PENTABLET') return false;
				if (compareYears !== null) {
					const y = parseInt(t.Model.LaunchYear, 10);
					if (!isNaN(y) && y < currentYear - compareYears) return false;
				}
				return true;
			})
			.map((t) => {
				const d = getDiagonal(t.Digitizer?.Dimensions);
				return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
			})
			.filter((d): d is number => d !== null);
	}

	let ptHistValues = $derived(histValues('PENTABLET', compareYearsPT));
	let pdHistValues = $derived(histValues('PENDISPLAY', compareYearsPD));
	let mixedHistValues = $derived(histValues('ALL', compareYearsMixed));

	function flaggedMarkers(typeFilter: 'PENTABLET' | 'PENDISPLAY' | 'ALL'): HistogramMarker[] {
		return flaggedItems
			.filter((t) => {
				if (typeFilter === 'PENTABLET') return t.Model.Type === 'PENTABLET';
				if (typeFilter === 'PENDISPLAY') return t.Model.Type !== 'PENTABLET';
				return true;
			})
			.map((t) => {
				const d = getDiagonal(t.Digitizer?.Dimensions);
				if (!d) return null;
				return { value: isMetric ? d * MM_TO_CM : d * MM_TO_IN, label: t.Model.Name };
			})
			.filter((m): m is HistogramMarker => m !== null);
	}

	let ptMarkers = $derived(flaggedMarkers('PENTABLET'));
	let pdMarkers = $derived(flaggedMarkers('PENDISPLAY'));
	let mixedMarkers = $derived(flaggedMarkers('ALL'));

	let copyFlaggedStatus = $state('');
	function copyFlaggedList() {
		const text = flaggedItems
			.map((t) => `${brandName(t.Model.Brand)} ${t.Model.Name} (${t.Model.Id})`)
			.join('\n');
		navigator.clipboard
			.writeText(text)
			.then(() => {
				copyFlaggedStatus = 'Copied!';
				setTimeout(() => (copyFlaggedStatus = ''), 2000);
			})
			.catch(() => {
				copyFlaggedStatus = 'Failed';
				setTimeout(() => (copyFlaggedStatus = ''), 2000);
			});
	}

	// Build a flat headers + rows pair for the comparison table, suitable
	// for ExportDialog. Group rows are emitted as a single non-blank cell
	// in the first column so they're visible when the export is opened in
	// a spreadsheet. The differs-highlighting (a CSS class on cells with
	// values that vary across the flagged tablets) is dropped — the
	// underlying values are exported faithfully, and the user can compute
	// "differs" themselves from the data.
	let showExport = $state(false);
	let compareExportHeaders: string[] = $derived.by(() => {
		const tabletCols = flaggedItems.map((t) => `${brandName(t.Model.Brand)} ${t.Model.Name}`);
		return ['Field', ...tabletCols];
	});
	let compareExportRows: (string | number)[][] = $derived.by(() => {
		const blanks = flaggedItems.map(() => '');
		const out: (string | number)[][] = [];
		for (const group of comparisonGroups) {
			out.push([group.group, ...blanks]);
			for (const f of group.fields) {
				out.push([f.label, ...f.values]);
			}
		}
		return out;
	});
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<h1>Compare Tablets</h1>

<div class="tabs">
	<button class:active={activeTab === 'flagged'} onclick={() => (activeTab = 'flagged')}>
		Flagged ({$flaggedTablets.length})
	</button>
	<button class:active={activeTab === 'compare'} onclick={() => (activeTab = 'compare')}>
		Compare
	</button>
	<button class:active={activeTab === 'sizes'} onclick={() => (activeTab = 'sizes')}>
		Compare sizes
	</button>
</div>

{#if activeTab === 'flagged'}
	<div class="flagged-actions">
		<button
			class="add-tablet-btn"
			onclick={() => (showPicker = true)}
			disabled={$flaggedTablets.length >= 6}
			title={$flaggedTablets.length >= 6 ? 'All 6 slots are used' : 'Add a tablet to compare'}
			>+ Add tablet</button
		>
		{#if flaggedItems.length > 0}
			<button class="copy-btn" onclick={copyFlaggedList}>{copyFlaggedStatus || 'Copy list'}</button>
		{/if}
		<button class="clear-btn" onclick={clearFlags}>Clear all</button>
	</div>
	{#if flaggedItems.length > 0}
		<ul class="flagged-list">
			{#each flaggedItems as t}
				<li>
					<button class="unflag-btn" onclick={() => toggleFlag(t.Meta.EntityId)} title="Unflag"
						>&#x2691;</button
					>
					<a href="{base}/entity/{encodeURIComponent(t.Meta.EntityId)}"
						>{brandName(t.Model.Brand)} {t.Model.Name} ({t.Model.Id})</a
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="no-data">
			No tablets added yet. Use the button above, or flag tablets from the <a href="{base}/"
				>tablets list</a
			> or individual tablet pages.
		</p>
	{/if}
{:else if activeTab === 'compare'}
	{#if flaggedItems.length < 2}
		<p class="no-data">
			Flag at least 2 tablets to compare. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		<div class="compare-toolbar">
			<button
				class="copy-btn"
				onclick={() => (showExport = true)}
				disabled={compareExportRows.length === 0}>Export</button
			>
		</div>
		<div class="compare-wrap">
			<table id="compare-table" class="compare-table">
				<thead>
					<tr>
						<th class="spec-col">Spec</th>
						{#each flaggedItems as t}
							<th
								><a href="{base}/entity/{encodeURIComponent(t.Meta.EntityId)}"
									>{brandName(t.Model.Brand)} {t.Model.Name}</a
								></th
							>
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
	{/if}
{:else if activeTab === 'sizes'}
	{#if flaggedItems.length < 2}
		<p class="no-data">
			Flag at least 2 tablets to compare. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		{#if dimCompItems.length >= 2}
			<section class="hist-section">
				<div class="dim-chart-header">
					<h2>Digitizer Dimensions</h2>
					<button
						class="stack-toggle"
						class:active={stackedDims}
						onclick={() => (stackedDims = !stackedDims)}
					>
						{stackedDims ? 'Side by side' : 'Stacked'}
					</button>
				</div>
				<TabletDimensionComparison items={dimCompItems} showISO={false} stacked={stackedDims} />
			</section>
		{/if}

		{#if hasMixedTypes && mixedHistValues.length > 0}
			<section class="hist-section">
				<h2>Size Comparison</h2>
				<ValueHistogram
					title="Flagged tablets compared to all tablets"
					values={mixedHistValues}
					currentValue={null}
					ranges={isMetric ? mixedRangesCm : mixedRangesIn}
					unit={isMetric ? ' cm' : '"'}
					binSize={isMetric ? 1 : 0.5}
					bandwidthMultiplier={0.2}
					markers={mixedMarkers}
					bind:compareYears={compareYearsMixed}
				/>
			</section>
		{/if}

		{#if !hasMixedTypes && hasFlaggedPenTablets && ptHistValues.length > 0}
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

		{#if !hasMixedTypes && hasFlaggedPenDisplays && pdHistValues.length > 0}
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

{#if showPicker && allTablets.length > 0}
	<TabletPicker {allTablets} flaggedIds={$flaggedTablets} onclose={() => (showPicker = false)} />
{/if}

{#if showExport}
	<ExportDialog
		entityType="tablet-comparison"
		title="Export Tablet Comparison"
		filename="tablet-comparison"
		headers={compareExportHeaders}
		rows={compareExportRows}
		onclose={() => (showExport = false)}
	/>
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}

	.hist-section {
		margin-top: 24px;
	}

	.dim-chart-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
	}

	.dim-chart-header h2 {
		margin-bottom: 0;
	}

	.stack-toggle {
		padding: 2px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.stack-toggle:hover {
		background: var(--hover-bg);
		color: var(--text);
	}
	.stack-toggle.active {
		background: #ede9fe;
		border-color: #7c3aed;
		color: #6b21a8;
		font-weight: 600;
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
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 18px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		bottom: -2px;
	}

	.tabs button:hover {
		color: #2563eb;
		background: var(--hover-bg);
	}

	.tabs button.active {
		background: var(--bg-card);
		color: var(--text);
		font-weight: 600;
		border-color: var(--border);
		border-bottom-color: var(--bg-card);
	}

	.flagged-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.add-tablet-btn {
		padding: 5px 14px;
		font-size: 13px;
		font-weight: 600;
		border: 1px solid #2563eb;
		border-radius: 4px;
		background: #2563eb;
		color: #fff;
		cursor: pointer;
	}

	.add-tablet-btn:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	.add-tablet-btn:disabled {
		opacity: 0.45;
		cursor: default;
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

	.clear-btn:hover:not(:disabled) {
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

	.flagged-list a:hover {
		text-decoration: underline;
	}

	.unflag-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #d97706;
		padding: 0;
		line-height: 1;
	}

	.unflag-btn:hover {
		color: #b45309;
	}

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

	.compare-table th,
	.compare-table td {
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

	.compare-table th a:hover {
		text-decoration: underline;
	}

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
