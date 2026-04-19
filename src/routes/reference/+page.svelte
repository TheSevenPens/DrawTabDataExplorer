<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadISOPaperSizesFromURL, loadUSPaperSizesFromURL, loadTabletsFromURL, getDiagonal, type ISOPaperSize, type USPaperSize, type Tablet } from '$data/lib/drawtab-loader.js';
	import { unitPreference } from '$lib/unit-store.js';
	import ValueHistogram, { type HistogramRange, type HistogramMarker } from '$lib/components/ValueHistogram.svelte';
	import { penTabletRangesCm, penTabletRangesIn, displayRangesCm, displayRangesIn, MM_TO_IN, MM_TO_CM } from '$lib/tablet-size-ranges.js';
	import Nav from '$lib/components/Nav.svelte';

	let activeTab: 'tablet-sizes' | 'iso-paper-a' | 'iso-paper-b' | 'us-paper' | 'display-resolutions' = $state('tablet-sizes');
	let paperSizes: ISOPaperSize[] = $state([]);
	let usPaperSizes: USPaperSize[] = $state([]);
	let allTablets: Tablet[] = $state([]);

	const currentYear = new Date().getFullYear();
	let isMetric = $derived($unitPreference === 'metric');

	let penTabletCompareYears = $state<number | null>(15);
	let penDisplayCompareYears = $state<number | null>(15);

	function filterByYears(tablets: Tablet[], type: string, years: number | null): Tablet[] {
		return tablets.filter(t => {
			if (t.Model.Type !== type && !(type === 'PENDISPLAY' && t.Model.Type === 'STANDALONE')) return false;
			if (years !== null) {
				const year = parseInt(t.Model.LaunchYear, 10);
				if (!isNaN(year) && year < currentYear - years) return false;
			}
			return true;
		});
	}

	let penTabletValues = $derived(
		filterByYears(allTablets, 'PENTABLET', penTabletCompareYears)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let penDisplayValues = $derived(
		filterByYears(allTablets, 'PENDISPLAY', penDisplayCompareYears)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let penTabletHistRanges = $derived<HistogramRange[]>(isMetric ? penTabletRangesCm : penTabletRangesIn);
	let penDisplayHistRanges = $derived<HistogramRange[]>(isMetric ? displayRangesCm : displayRangesIn);

	let aSeries = $derived(paperSizes.filter(p => p.Series === 'A'));
	let bSeries = $derived(paperSizes.filter(p => p.Series === 'B'));

	function isoMarkers(series: typeof aSeries): HistogramMarker[] {
		return series.map(p => {
			const diagMm = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			return { value: isMetric ? diagMm / 10 : diagMm * MM_TO_IN, label: p.Name };
		});
	}

	let isoAMarkers = $derived<HistogramMarker[]>(isoMarkers(aSeries));
	let isoBMarkers = $derived<HistogramMarker[]>(isoMarkers(bSeries));

	let isoACompareYearsPenTablet = $state<number | null>(15);
	let isoACompareYearsPenDisplay = $state<number | null>(15);
	let isoBCompareYearsPenTablet = $state<number | null>(15);
	let isoBCompareYearsPenDisplay = $state<number | null>(15);

	let usCompareYearsPenTablet = $state<number | null>(15);
	let usCompareYearsPenDisplay = $state<number | null>(15);

	let usCommonSeries = $derived(usPaperSizes.filter(p => p.Series === 'Common'));

	let usMarkers = $derived<HistogramMarker[]>(
		usCommonSeries.map(p => {
			const diagMm = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			return { value: isMetric ? diagMm / 10 : diagMm * MM_TO_IN, label: p.Name };
		})
	);

	let usPenTabletValues = $derived(
		filterByYears(allTablets, 'PENTABLET', usCompareYearsPenTablet)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let usPenDisplayValues = $derived(
		filterByYears(allTablets, 'PENDISPLAY', usCompareYearsPenDisplay)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let isoAPenTabletValues = $derived(
		filterByYears(allTablets, 'PENTABLET', isoACompareYearsPenTablet)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let isoAPenDisplayValues = $derived(
		filterByYears(allTablets, 'PENDISPLAY', isoACompareYearsPenDisplay)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let isoBPenTabletValues = $derived(
		filterByYears(allTablets, 'PENTABLET', isoBCompareYearsPenTablet)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let isoBPenDisplayValues = $derived(
		filterByYears(allTablets, 'PENDISPLAY', isoBCompareYearsPenDisplay)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

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

	// --- Display resolution categories ---

	const resolutionCategories = [
		{ name: 'Full HD',  resolutions: [{ w: 1920, h: 1080 }] },
		{ name: '2.5K',     resolutions: [{ w: 2560, h: 1440 }, { w: 2560, h: 1600 }] },
		{ name: '3K',       resolutions: [{ w: 2880, h: 1800 }] },
		{ name: '4K',       resolutions: [{ w: 3840, h: 2160 }] },
	];

	function getResolutionCategory(w: number, h: number): string {
		if (w === 1920 && h === 1080) return 'Full HD';
		if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K';
		if (w === 2880 && h === 1800) return '3K';
		if (w === 3840 && h === 2160) return '4K';
		return 'Other';
	}

	let displayTablets = $derived(
		allTablets.filter(t => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE')
	);

	let resolutionCounts = $derived(
		displayTablets.reduce<Record<string, number>>((acc, t) => {
			const d = t.Display?.PixelDimensions;
			if (!d?.Width || !d?.Height) return acc;
			const cat = getResolutionCategory(d.Width, d.Height);
			acc[cat] = (acc[cat] ?? 0) + 1;
			return acc;
		}, {})
	);

	onMount(async () => {
		const [p, us, t] = await Promise.all([
			loadISOPaperSizesFromURL(base),
			loadUSPaperSizesFromURL(base),
			loadTabletsFromURL(base),
		]);
		paperSizes = p;
		usPaperSizes = us;
		allTablets = t;
	});
</script>

<Nav />
<h1>Reference</h1>

<div class="tabs">
	<button class:active={activeTab === 'tablet-sizes'} onclick={() => activeTab = 'tablet-sizes'}>
		Tablet Sizes
	</button>
	<button class:active={activeTab === 'iso-paper-a'} onclick={() => activeTab = 'iso-paper-a'}>
		ISO A Paper Sizes
	</button>
	<button class:active={activeTab === 'iso-paper-b'} onclick={() => activeTab = 'iso-paper-b'}>
		ISO B Paper Sizes
	</button>
	<button class:active={activeTab === 'us-paper'} onclick={() => activeTab = 'us-paper'}>
		US Paper Sizes
	</button>
	<button class:active={activeTab === 'display-resolutions'} onclick={() => activeTab = 'display-resolutions'}>
		Display Resolutions
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
{:else if activeTab === 'iso-paper-a'}
	<section>
		<div class="section-header">
			<h2>ISO A Paper Sizes</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#iso-a-paper-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		{#if aSeries.length > 0}
			<table id="iso-a-paper-table" class="ref-table">
				<thead><tr><th>Name</th><th>Width (cm)</th><th>Height (cm)</th><th>Diagonal (cm)</th><th>Width (in)</th><th>Height (in)</th><th>Diagonal (in)</th></tr></thead>
				<tbody>
					{#each aSeries as size}
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

	{#if isoAPenTabletValues.length > 0}
		<section>
			<h2>Pen Tablet Diagonal Distribution with ISO A Sizes</h2>
			<ValueHistogram
				title="Pen tablet active area diagonal with ISO A paper sizes"
				values={isoAPenTabletValues}
				currentValue={null}
				ranges={penTabletHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={isoACompareYearsPenTablet}
				markers={isoAMarkers}
			/>
		</section>
	{/if}

	{#if isoAPenDisplayValues.length > 0}
		<section>
			<h2>Pen Display Diagonal Distribution with ISO A Sizes</h2>
			<ValueHistogram
				title="Pen display active area diagonal with ISO A paper sizes"
				values={isoAPenDisplayValues}
				currentValue={null}
				ranges={penDisplayHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={isoACompareYearsPenDisplay}
				markers={isoAMarkers}
			/>
		</section>
	{/if}
{:else if activeTab === 'iso-paper-b'}
	<section>
		<div class="section-header">
			<h2>ISO B Paper Sizes</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#iso-b-paper-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		{#if bSeries.length > 0}
			<table id="iso-b-paper-table" class="ref-table">
				<thead><tr><th>Name</th><th>Width (cm)</th><th>Height (cm)</th><th>Diagonal (cm)</th><th>Width (in)</th><th>Height (in)</th><th>Diagonal (in)</th></tr></thead>
				<tbody>
					{#each bSeries as size}
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

	{#if isoBPenTabletValues.length > 0}
		<section>
			<h2>Pen Tablet Diagonal Distribution with ISO B Sizes</h2>
			<ValueHistogram
				title="Pen tablet active area diagonal with ISO B paper sizes"
				values={isoBPenTabletValues}
				currentValue={null}
				ranges={penTabletHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={isoBCompareYearsPenTablet}
				markers={isoBMarkers}
			/>
		</section>
	{/if}

	{#if isoBPenDisplayValues.length > 0}
		<section>
			<h2>Pen Display Diagonal Distribution with ISO B Sizes</h2>
			<ValueHistogram
				title="Pen display active area diagonal with ISO B paper sizes"
				values={isoBPenDisplayValues}
				currentValue={null}
				ranges={penDisplayHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={isoBCompareYearsPenDisplay}
				markers={isoBMarkers}
			/>
		</section>
	{/if}
{:else if activeTab === 'us-paper'}
	<section>
		<div class="section-header">
			<h2>US Paper Sizes</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#us-paper-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		{#if usPaperSizes.length > 0}
			<table id="us-paper-table" class="ref-table">
				<thead><tr><th>Name</th><th>Series</th><th>Width (cm)</th><th>Height (cm)</th><th>Diagonal (cm)</th><th>Width (in)</th><th>Height (in)</th><th>Diagonal (in)</th></tr></thead>
				<tbody>
					{#each usPaperSizes as size}
						{@const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10}
						{@const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2)}
						<tr>
							<td>{size.Name}</td>
							<td>{size.Series}</td>
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

	{#if usPenTabletValues.length > 0}
		<section>
			<h2>Pen Tablet Diagonal Distribution with US Paper Sizes</h2>
			<ValueHistogram
				title="Pen tablet active area diagonal with US paper sizes"
				values={usPenTabletValues}
				currentValue={null}
				ranges={penTabletHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={usCompareYearsPenTablet}
				markers={usMarkers}
			/>
		</section>
	{/if}

	{#if usPenDisplayValues.length > 0}
		<section>
			<h2>Pen Display Diagonal Distribution with US Paper Sizes</h2>
			<ValueHistogram
				title="Pen display active area diagonal with US paper sizes"
				values={usPenDisplayValues}
				currentValue={null}
				ranges={penDisplayHistRanges}
				unit={isMetric ? ' cm' : '"'}
				binSize={isMetric ? 1 : 0.5}
				bandwidthMultiplier={0.2}
				bind:compareYears={usCompareYearsPenDisplay}
				markers={usMarkers}
			/>
		</section>
	{/if}
{:else if activeTab === 'display-resolutions'}
	<section>
		<div class="section-header">
			<h2>Display Resolution Categories</h2>
			<button class="copy-btn" onclick={() => {
				const table = document.querySelector('#res-cat-table');
				if (table) navigator.clipboard.writeText(table.outerHTML);
			}}>Copy as HTML</button>
		</div>
		<table id="res-cat-table" class="ref-table">
			<thead>
				<tr>
					<th>Category</th>
					<th>Resolution(s)</th>
					<th>Megapixels</th>
					<th>Aspect Ratio</th>
					<th>Displays in dataset</th>
				</tr>
			</thead>
			<tbody>
				{#each resolutionCategories as cat}
					{#each cat.resolutions as res, i}
						{@const mp = ((res.w * res.h) / 1_000_000).toFixed(2)}
						{@const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)}
						{@const g = gcd(res.w, res.h)}
						{@const ar = `${res.w / g}:${res.h / g}`}
						{@const count = i === 0 ? (resolutionCounts[cat.name] ?? 0) : null}
						<tr>
							{#if i === 0}
								<td rowspan={cat.resolutions.length} class="cat-name">{cat.name}</td>
							{/if}
							<td>{res.w} × {res.h}</td>
							<td>{mp} MP</td>
							<td>{ar}</td>
							{#if i === 0}
								<td rowspan={cat.resolutions.length} class="count-cell">
									{count === 0 ? '—' : count}
								</td>
							{/if}
						</tr>
					{/each}
				{/each}
				<tr class="other-row">
					<td>Other</td>
					<td>—</td>
					<td>—</td>
					<td>—</td>
					<td>{resolutionCounts['Other'] ?? 0}</td>
				</tr>
			</tbody>
		</table>
	</section>
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

	.cat-name {
		font-weight: 600;
		vertical-align: middle;
	}

	.count-cell {
		vertical-align: middle;
		text-align: center;
	}

	.other-row td {
		color: var(--text-muted);
		font-style: italic;
	}
</style>
