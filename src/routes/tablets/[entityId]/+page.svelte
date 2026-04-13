<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTabletsFromURL, loadPenCompatFromURL, loadPensFromURL, brandName, getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';
	import { findSimilarTablets } from '$data/lib/compat-helpers.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
	import { unitPreference, toggleUnits } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';
	import { getFieldDef } from '$data/lib/pipeline/index.js';
	import ValueHistogram, { type HistogramRange } from '$lib/components/ValueHistogram.svelte';

	let tablet = $state<Tablet | null>(null);
	let allTablets: Tablet[] = $state([]);
	let compatiblePens: Pen[] = $state([]);
	let notFound = $state(false);

	let filterSimilarSize = $state(true);
	let filterSamePen = $state(false);
	let filterSameBrand = $state(false);
	let filterSameYearOrLater = $state(false);

	let hasDisplay = $derived(tablet?.ModelType === 'PENDISPLAY' || tablet?.ModelType === 'STANDALONE');

	const MM_TO_IN = 0.03937;
	const currentYear = new Date().getFullYear();

	let compareYears = $state<number | null>(15);

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

	let isMetric = $derived($unitPreference === 'metric');

	let histogramRanges = $derived.by((): HistogramRange[] => {
		if (!tablet) return [];
		if (tablet.ModelType === 'PENTABLET') {
			return isMetric ? penTabletRangesCm : penTabletRangesIn;
		}
		return isMetric ? displayRangesCm : displayRangesIn;
	});

	const MM_TO_CM = 0.1;

	let histogramValues = $derived(
		allTablets
			.filter(t => {
				if (t.ModelType !== tablet?.ModelType) return false;
				if (compareYears !== null) {
					const year = parseInt(t.ModelLaunchYear, 10);
					if (!isNaN(year) && year < currentYear - compareYears) return false;
				}
				return true;
			})
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let allDiagonalsForType = $derived(
		allTablets
			.filter(t => t.ModelType === tablet?.ModelType)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	function median(nums: number[]): number | null {
		if (nums.length === 0) return null;
		const sorted = [...nums].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
	}

	let allDiagonalsForTypeCm = $derived(
		allTablets
			.filter(t => t.ModelType === tablet?.ModelType)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? d * MM_TO_CM : null; })
			.filter((d): d is number => d !== null)
	);
	let allDiagonalsForTypeIn = $derived(
		allTablets
			.filter(t => t.ModelType === tablet?.ModelType)
			.map(t => { const d = getDiagonal(t.DigitizerDimensions); return d ? d * MM_TO_IN : null; })
			.filter((d): d is number => d !== null)
	);

	let rangeMedians = $derived(
		histogramRanges.map(range => {
			const inRange = allDiagonalsForType.filter(d => d >= range.min && d < range.max);
			return { label: range.label, count: inRange.length, median: median(inRange) };
		})
	);

	let dualRanges = $derived.by(() => {
		if (!tablet) return [];
		const isPenTablet = tablet.ModelType === 'PENTABLET';
		const cmRanges = isPenTablet ? penTabletRangesCm : displayRangesCm;
		const inRanges = isPenTablet ? penTabletRangesIn : displayRangesIn;
		return cmRanges.map((cmRange, i) => {
			const inRange = inRanges[i];
			const inCm = allDiagonalsForTypeCm.filter(d => d >= cmRange.min && d < cmRange.max);
			const inIn = allDiagonalsForTypeIn.filter(d => d >= inRange.min && d < inRange.max);
			return {
				label: cmRange.label,
				cmMin: cmRange.min, cmMax: cmRange.max,
				inMin: inRange.min, inMax: inRange.max,
				medianCm: median(inCm), countCm: inCm.length,
				medianIn: median(inIn), countIn: inIn.length,
			};
		});
	});

	let histogramCurrentValue = $derived.by(() => {
		if (!tablet) return null;
		const d = getDiagonal(tablet.DigitizerDimensions);
		return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
	});

	const col1Groups = ['Model', 'Physical'];
	const col2Groups = ['Digitizer'];
	const col3Groups = ['Display'];

	function getGroupFields(groups: string[]) {
		return TABLET_FIELDS.filter(f => groups.includes(f.group));
	}

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId!);
		const [allT, allCompat, allPens] = await Promise.all([
			loadTabletsFromURL(base),
			loadPenCompatFromURL(base) as Promise<PenCompat[]>,
			loadPensFromURL(base) as Promise<Pen[]>,
		]);

		const found = allT.find((t) => t.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		tablet = found;

		const compatPenIds = new Set(
			allCompat
				.filter((c) => c.TabletId === found.ModelId)
				.map((c) => c.PenId)
		);
		compatiblePens = allPens.filter((p) => compatPenIds.has(p.PenId));
		allTablets = allT;
	});

	let similarTablets = $derived.by(() => {
		if (!tablet) return [];
		return findSimilarTablets(tablet, allTablets, {
			similarSize: filterSimilarSize,
			samePen: filterSamePen,
			sameBrand: filterSameBrand,
			sameYearOrLater: filterSameYearOrLater,
		});
	});
</script>

{#if notFound}
	<h1>Tablet not found</h1>
	<p><a href="{base}/">Back to tablets</a></p>
{:else}
	<p class="back"><a href="{base}/">&larr; Tablets</a></p>
	<div class="title-row">
		<h1>{tablet ? `${brandName(tablet.Brand)} ${tablet.ModelName}` : 'Loading...'}</h1>
		<button class="unit-toggle" onclick={toggleUnits}>
			{$unitPreference === 'metric' ? 'Metric' : 'Imperial'}
		</button>
	</div>

	{#if tablet}
		<div class="detail-columns">
			{#each [col1Groups, col2Groups, col3Groups] as groups}
				<div class="detail-col">
					{#each groups as group}
						{@const groupFields = getGroupFields([group])}
						{@const hasValues = groupFields.some(f => { const v = f.getValue(tablet!); return v && v !== '-'; })}
						{#if hasValues}
							<section class="field-group">
								<h2>{group}</h2>
								<dl>
									{#each groupFields as f}
										{@const val = f.getValue(tablet!)}
										{@const displayVal = formatValue(val, f.unit, $unitPreference)}
										{#if val && val !== '-'}
											<div class="field-row">
												<dt>{getFieldLabel(f.label, f.unit, $unitPreference)}</dt>
												<dd>
													{#if isUrl(val)}
														<a href={val} target="_blank" rel="noopener">{val}</a>
													{:else}
														{displayVal}
													{/if}
													{#if f.computed}
														<span class="computed-badge">computed</span>
													{/if}
												</dd>
											</div>
										{/if}
									{/each}
								</dl>
							</section>
						{/if}
					{/each}
				</div>
			{/each}
		</div>

		<section class="compat-section">
			<h2>Size Comparison</h2>
			<div class="size-comparison">
				<ValueHistogram
								title={`${brandName(tablet.Brand)} ${tablet.ModelName} (${tablet.ModelId}) active area diagonal compared to other ${tablet.ModelType === 'PENTABLET' ? 'pen tablets' : tablet.ModelType === 'PENDISPLAY' ? 'pen displays' : 'standalone tablets'}`}
								values={histogramValues}
								currentValue={histogramCurrentValue}
								currentLabel={`${brandName(tablet.Brand)} ${tablet.ModelName} (${tablet.ModelId})`}
								ranges={histogramRanges}
								unit={isMetric ? ' cm' : '"'}
								binSize={isMetric ? 1 : 0.5}
								bandwidthMultiplier={0.2}
								bind:compareYears
							/>
				<div class="range-legend">
					<div class="range-legend-header">
						<h3>Size Ranges ({tablet.ModelType === 'PENTABLET' ? 'Pen Tablet' : 'Pen Display'})</h3>
						<button class="copy-btn" onclick={() => {
							const table = document.querySelector('.range-table');
							if (table) navigator.clipboard.writeText(table.outerHTML);
						}}>Copy as HTML</button>
					</div>
					<table class="range-table">
						<thead><tr><th>Category</th><th>Range (cm)</th><th>Range (in)</th><th>Median (cm)</th><th>Median (in)</th></tr></thead>
						<tbody>
							{#each dualRanges as r}
								<tr>
									<td>{r.label}</td>
									<td>{r.cmMin} cm – {r.cmMax} cm</td>
									<td>{r.inMin}″ – {r.inMax}″</td>
									<td>{r.medianCm !== null ? `${r.medianCm.toFixed(1)} cm` : '—'}</td>
									<td>{r.medianIn !== null ? `${r.medianIn.toFixed(1)}″` : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<section class="compat-section">
			<h2>Compatible Pens</h2>
			{#if compatiblePens.length > 0}
				<ul class="entity-list">
					{#each compatiblePens as pen}
						<li><a href="{base}/pens/{encodeURIComponent(pen.EntityId)}">{brandName(pen.Brand)} {pen.PenName === pen.PenId ? pen.PenId : `${pen.PenName} (${pen.PenId})`}</a></li>
					{/each}
				</ul>
			{:else}
				<p class="no-data">No pen compatibility data available for this tablet.</p>
			{/if}
		</section>

		<section class="compat-section">
			<h2>Similar Tablets</h2>
			<div class="similar-filters">
				<label><input type="checkbox" bind:checked={filterSimilarSize} /> Similar size</label>
				<label><input type="checkbox" bind:checked={filterSamePen} /> Same included pen</label>
				<label><input type="checkbox" bind:checked={filterSameBrand} /> Same brand</label>
				<label><input type="checkbox" bind:checked={filterSameYearOrLater} /> Same year or later</label>
			</div>
			{#if similarTablets.length > 0}
				<table class="similar-table">
					<thead>
						<tr>
							<th>Tablet</th>
							<th>Year</th>
							<th>Dimensions</th>
							<th>Diagonal</th>
							{#if hasDisplay}
								<th>Pixels</th>
								<th>Category</th>
								<th>Density</th>
							{/if}
							<th>Included Pen</th>
						</tr>
					</thead>
					<tbody>
						{#each similarTablets as t}
							{@const d = t.DigitizerDimensions}
							{@const diag = getDiagonal(t.DigitizerDimensions)}
							{@const px = t.DisplayPixelDimensions}
							{@const pxDensity = (px && d && px.Width && d.Width) ? (px.Width / d.Width).toFixed(2) : ''}
							{@const pxCat = (() => { if (!px || !px.Width || !px.Height) return ''; const w = px.Width, h = px.Height; if (w === 1920 && h === 1080) return 'Full HD'; if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K'; if (w === 2880 && h === 1800) return '3K'; if (w === 3840 && h === 2160) return '4K'; return 'Other'; })()}
							<tr>
								<td><a href="{base}/tablets/{encodeURIComponent(t.EntityId)}">{brandName(t.Brand)} {t.ModelName} ({t.ModelId})</a></td>
								<td>{t.ModelLaunchYear || ''}</td>
								<td>{d ? `${d.Width} x ${d.Height} mm` : ''}</td>
								<td>{diag ? `${diag.toFixed(1)} mm` : ''}</td>
								{#if hasDisplay}
									<td>{px ? `${px.Width} x ${px.Height}` : ''}</td>
									<td>{pxCat}</td>
									<td>{pxDensity ? `${pxDensity} px/mm` : ''}</td>
								{/if}
								<td>{(t.ModelIncludedPen ?? []).join(', ')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No matching tablets found. Try adjusting the filters.</p>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.back {
		margin-bottom: 8px;
		font-size: 14px;
	}

	.back a {
		color: var(--link);
		text-decoration: none;
	}

	.back a:hover { text-decoration: underline; }

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 16px;
	}

	h1 { margin: 0; }

	.unit-toggle {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #16a34a;
		border-radius: 4px;
		background: var(--bg-card);
		color: #16a34a;
		cursor: pointer;
		font-weight: 600;
	}

	.unit-toggle:hover {
		background: #16a34a;
		color: #fff;
	}

	.detail-columns {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 20px;
		margin-bottom: 24px;
	}

	.detail-col {
		min-width: 0;
	}

	.field-group {
		margin-bottom: 16px;
	}

	h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	dl {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
	}

	.field-row {
		display: flex;
		gap: 8px;
		padding: 3px 0;
		border-bottom: 1px solid var(--border);
		font-size: 13px;
	}

	dt {
		min-width: 100px;
		font-weight: 600;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	dd {
		color: var(--text);
		word-break: break-all;
	}

	dd a {
		color: var(--link);
		text-decoration: none;
	}

	dd a:hover { text-decoration: underline; }

	.computed-badge {
		display: inline-block;
		margin-left: 4px;
		padding: 1px 4px;
		font-size: 10px;
		color: var(--text-dim);
		border: 1px solid var(--border-light);
		border-radius: 3px;
		vertical-align: middle;
	}

	.compat-section {
		margin-top: 24px;
	}

	.compat-section h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	.entity-list {
		list-style: none;
		padding: 0;
	}

	.entity-list li {
		padding: 3px 0;
		font-size: 13px;
	}

	.entity-list a {
		color: var(--link);
		text-decoration: none;
	}

	.entity-list a:hover { text-decoration: underline; }

	.similar-filters {
		display: flex;
		gap: 14px;
		margin-bottom: 10px;
	}

	.similar-filters label {
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		color: var(--text);
	}

	.similar-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		background: var(--bg-card);
	}

	.similar-table th, .similar-table td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	.similar-table th {
		background: var(--th-bg);
		color: var(--th-text);
		font-weight: 600;
	}

	.similar-table tr:hover td { background: var(--hover-bg); }

	.similar-table a {
		color: var(--link);
		text-decoration: none;
	}

	.similar-table a:hover { text-decoration: underline; }

	.chart-options {
		margin-bottom: 8px;
	}

	.chart-options label {
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		color: var(--text);
	}

	.size-comparison {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.range-legend-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.range-legend h3 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
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

	.range-table {
		border-collapse: collapse;
		font-size: 13px;
	}

	.range-table th, .range-table td {
		padding: 3px 10px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	.range-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
	}

	.current-size {
		margin-top: 8px;
		font-size: 13px;
		color: #e11d48;
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
