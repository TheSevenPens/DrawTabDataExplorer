<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadISOPaperSizesFromURL, loadTabletsFromURL, getDiagonal, type ISOPaperSize, type Tablet } from '$data/lib/drawtab-loader.js';
	import { unitPreference } from '$lib/unit-store.js';
	import ValueHistogram, { type HistogramRange, type HistogramMarker } from '$lib/components/ValueHistogram.svelte';

	let activeTab: 'tablet-sizes' | 'iso-paper' = $state('tablet-sizes');
	let paperSizes: ISOPaperSize[] = $state([]);
	let allTablets: Tablet[] = $state([]);

	const MM_TO_IN = 0.03937;
	const MM_TO_CM = 0.1;
	const currentYear = new Date().getFullYear();
	let isMetric = $derived($unitPreference === 'metric');

	let penTabletCompareYears = $state<number | null>(15);
	let penDisplayCompareYears = $state<number | null>(15);

	function filterByYears(tablets: Tablet[], type: string, years: number | null): Tablet[] {
		return tablets.filter(t => {
			if (t.ModelType !== type && !(type === 'PENDISPLAY' && t.ModelType === 'STANDALONE')) return false;
			if (years !== null) {
				const year = parseInt(t.ModelLaunchYear, 10);
				if (!isNaN(year) && year < currentYear - years) return false;
			}
			return true;
		});
	}

	let penTabletValues = $derived(
		filterByYears(allTablets, 'PENTABLET', penTabletCompareYears)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let penDisplayValues = $derived(
		filterByYears(allTablets, 'PENDISPLAY', penDisplayCompareYears)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let penTabletHistRanges = $derived<HistogramRange[]>(isMetric ? penTabletRangesCm : penTabletRangesIn);
	let penDisplayHistRanges = $derived<HistogramRange[]>(isMetric ? displayRangesCm : displayRangesIn);

	let isoAMarkers = $derived<HistogramMarker[]>(
		aSeries.map(p => {
			const diagMm = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			return { value: isMetric ? diagMm / 10 : diagMm * MM_TO_IN, label: p.Name };
		})
	);

	let isoCompareYearsPenTablet = $state<number | null>(15);
	let isoCompareYearsPenDisplay = $state<number | null>(15);

	let isoPenTabletValues = $derived(
		filterByYears(allTablets, 'PENTABLET', isoCompareYearsPenTablet)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let isoPenDisplayValues = $derived(
		filterByYears(allTablets, 'PENDISPLAY', isoCompareYearsPenDisplay)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	const penTabletRangesIn = [
		{ label: 'TINY', min: 2, max: 6 },
		{ label: 'SMALL', min: 6, max: 9 },
		{ label: 'MEDIUM', min: 9, max: 14 },
		{ label: 'LARGE', min: 14, max: 20 },
		{ label: 'EXTRA LARGE', min: 20, max: 29 },
	];
	const penTabletRangesCm = [
		{ label: 'TINY', min: 6, max: 16 },
		{ label: 'SMALL', min: 16, max: 24 },
		{ label: 'MEDIUM', min: 24, max: 36 },
		{ label: 'LARGE', min: 36, max: 50 },
		{ label: 'EXTRA LARGE', min: 50, max: 74 },
	];
	const displayRangesIn = [
		{ label: 'TINY', min: 9, max: 11 },
		{ label: 'SMALL', min: 11, max: 15 },
		{ label: 'MEDIUM', min: 15, max: 20 },
		{ label: 'LARGE', min: 20, max: 30 },
		{ label: 'EXTRA LARGE', min: 30, max: 34 },
	];
	const displayRangesCm = [
		{ label: 'TINY', min: 23, max: 28 },
		{ label: 'SMALL', min: 28, max: 38 },
		{ label: 'MEDIUM', min: 38, max: 50 },
		{ label: 'LARGE', min: 50, max: 76 },
		{ label: 'EXTRA LARGE', min: 76, max: 86 },
	];

	let aSeries = $derived(paperSizes.filter(p => p.Series === 'A'));

	function closestISOA(midpointCm: number): string {
		if (aSeries.length === 0) return '';
		let best = aSeries[0];
		let bestDist = Infinity;
		for (const p of aSeries) {
			const diagCm = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2) / 10;
			const dist = Math.abs(diagCm - midpointCm);
			if (dist < bestDist) { bestDist = dist; best = p; }
		}
		return best.Name;
	}

	onMount(async () => {
		const [p, t] = await Promise.all([
			loadISOPaperSizesFromURL(base),
			loadTabletsFromURL(base),
		]);
		paperSizes = p;
		allTablets = t;
	});
</script>

<h1>Reference</h1>

<div class="tabs">
	<button class:active={activeTab === 'tablet-sizes'} onclick={() => activeTab = 'tablet-sizes'}>
		Tablet Sizes
	</button>
	<button class:active={activeTab === 'iso-paper'} onclick={() => activeTab = 'iso-paper'}>
		ISO Paper Sizes
	</button>
</div>

{#if activeTab === 'tablet-sizes'}
	<section>
		<div class="section-header">
			<h2>Pen Tablet Size Categories</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#pen-tablet-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		<table id="pen-tablet-table" class="ref-table">
			<thead><tr><th>Category</th><th>Range (cm)</th><th>Range (in)</th><th>Similar ISO A</th></tr></thead>
			<tbody>
				{#each penTabletRangesCm as range, i}
					{@const inRange = penTabletRangesIn[i]}
					{@const midCm = (range.min + range.max) / 2}
					<tr>
						<td>{range.label}</td>
						<td>{range.min} cm – {range.max} cm</td>
						<td>{inRange.min}″ – {inRange.max}″</td>
						<td>{closestISOA(midCm)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if penTabletValues.length > 0}
			<ValueHistogram
				title="Pen tablet active area diagonal distribution"
				values={penTabletValues}
				currentValue={null}
				ranges={penTabletHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={penTabletCompareYears}
			/>
		{/if}
	</section>

	<section>
		<div class="section-header">
			<h2>Pen Display Size Categories</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#pen-display-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		<table id="pen-display-table" class="ref-table">
			<thead><tr><th>Category</th><th>Range (cm)</th><th>Range (in)</th><th>Similar ISO A</th></tr></thead>
			<tbody>
				{#each displayRangesCm as range, i}
					{@const inRange = displayRangesIn[i]}
					{@const midCm = (range.min + range.max) / 2}
					<tr>
						<td>{range.label}</td>
						<td>{range.min} cm – {range.max} cm</td>
						<td>{inRange.min}″ – {inRange.max}″</td>
						<td>{closestISOA(midCm)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if penDisplayValues.length > 0}
			<ValueHistogram
				title="Pen display active area diagonal distribution"
				values={penDisplayValues}
				currentValue={null}
				ranges={penDisplayHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={penDisplayCompareYears}
			/>
		{/if}
	</section>
{:else}
	<section>
		<div class="section-header">
			<h2>ISO Paper Sizes</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#iso-paper-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		{#if paperSizes.length > 0}
			<table id="iso-paper-table" class="ref-table">
				<thead><tr><th>Name</th><th>Width (cm)</th><th>Height (cm)</th><th>Diagonal (cm)</th><th>Width (in)</th><th>Height (in)</th><th>Diagonal (in)</th></tr></thead>
				<tbody>
					{#each paperSizes as size}
						{@const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10}
						{@const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2)}
						<tr>
							<td>{size.Name}</td>
							<td>{(size.Width_mm / 10).toFixed(1)}</td>
							<td>{(size.Height_mm / 10).toFixed(1)}</td>
							<td>{diagCm.toFixed(1)}</td>
							<td>{size.Width_in}</td>
							<td>{size.Height_in}</td>
							<td>{diagIn.toFixed(1)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">Loading...</p>
		{/if}
	</section>

	{#if isoPenTabletValues.length > 0}
		<section>
			<h2>Pen Tablet Diagonal Distribution with ISO A Sizes</h2>
			<ValueHistogram
				title="Pen tablet active area diagonal with ISO A paper sizes"
				values={isoPenTabletValues}
				currentValue={null}
				ranges={penTabletHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={isoCompareYearsPenTablet}
				markers={isoAMarkers}
			/>
		</section>
	{/if}

	{#if isoPenDisplayValues.length > 0}
		<section>
			<h2>Pen Display Diagonal Distribution with ISO A Sizes</h2>
			<ValueHistogram
				title="Pen display active area diagonal with ISO A paper sizes"
				values={isoPenDisplayValues}
				currentValue={null}
				ranges={penDisplayHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={isoCompareYearsPenDisplay}
				markers={isoAMarkers}
			/>
		</section>
	{/if}
{/if}

<style>
	h1 {
		margin-bottom: 16px;
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

	section {
		margin-bottom: 24px;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 0;
	}

	.copy-btn {
		padding: 2px 8px;
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

	.ref-table {
		border-collapse: collapse;
		font-size: 13px;
	}

	.ref-table th, .ref-table td {
		padding: 4px 12px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	.ref-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
