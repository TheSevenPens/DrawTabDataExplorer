<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTabletsFromURL, loadPenCompatFromURL, loadPensFromURL, loadISOPaperSizesFromURL, brandName, getDiagonal, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import { findSimilarTablets } from '$data/lib/compat-helpers.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
	import { unitPreference, toggleUnits, showAltUnits, toggleAltUnits } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';
	import ValueHistogram, { type HistogramRange } from '$lib/components/ValueHistogram.svelte';
	import { flaggedTablets, toggleFlag } from '$lib/flagged-store.js';
	import { penTabletRangesCm, penTabletRangesIn, displayRangesCm, displayRangesIn, MM_TO_IN, MM_TO_CM } from '$lib/tablet-size-ranges.js';
	import { stripUnit, formatValueWithAlt } from '$lib/field-display.js';
	import { buildPenNameMap, formatPenIds } from '$lib/pen-helpers.js';
	import JsonDialog from '$lib/components/JsonDialog.svelte';

	let showJson = $state(false);

	let tablet = $state<Tablet | null>(null);
	let allTablets: Tablet[] = $state([]);
	let allPens: Pen[] = $state([]);
	let compatiblePens: Pen[] = $state([]);
	let notFound = $state(false);

	let penNameMap = $derived(buildPenNameMap(allPens));

	function includedPenNames(tablet: Tablet): string {
		return formatPenIds(tablet.Model.IncludedPen ?? [], penNameMap);
	}

	let filterSimilarSize = $state(true);
	let filterSamePen = $state(false);
	let filterBrand = $state('all');
	let filterSameYearOrLater = $state(false);
	let similarSort = $state<'year' | 'diagonal'>('year');

	let hasDisplay = $derived(tablet?.Model.Type === 'PENDISPLAY' || tablet?.Model.Type === 'STANDALONE');
	let isoSizes: ISOPaperSize[] = $state([]);

	let closestISO = $derived.by(() => {
		if (!tablet) return null;
		const diagMm = getDiagonal(tablet.Digitizer?.Dimensions);
		if (!diagMm) return null;
		const aSeries = isoSizes.filter(p => p.Series === 'A');
		if (aSeries.length === 0) return null;
		let best = aSeries[0];
		let bestDist = Infinity;
		for (const p of aSeries) {
			const pDiag = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			const dist = Math.abs(pDiag - diagMm);
			if (dist < bestDist) { bestDist = dist; best = p; }
		}
		const bestDiag = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
		const pct = Math.round(Math.abs(diagMm - bestDiag) / bestDiag * 100);
		let qualifier = '';
		if (pct >= 1) {
			qualifier = diagMm > bestDiag ? `${pct}% larger than ` : `${pct}% smaller than `;
		} else {
			qualifier = '~ ';
		}
		return `${qualifier}${best.Name}`;
	});

	const currentYear = new Date().getFullYear();

	let compareYears = $state<number | null>(15);

	let isMetric = $derived($unitPreference === 'metric');

	let histogramRanges = $derived.by((): HistogramRange[] => {
		if (!tablet) return [];
		if (tablet.Model.Type === 'PENTABLET') {
			return isMetric ? penTabletRangesCm : penTabletRangesIn;
		}
		return isMetric ? displayRangesCm : displayRangesIn;
	});

	let histogramValues = $derived(
		allTablets
			.filter(t => {
				if (t.Model.Type !== tablet?.Model.Type) return false;
				if (compareYears !== null) {
					const year = parseInt(t.Model.LaunchYear, 10);
					if (!isNaN(year) && year < currentYear - compareYears) return false;
				}
				return true;
			})
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let histogramCurrentValue = $derived.by(() => {
		if (!tablet) return null;
		const d = getDiagonal(tablet.Digitizer?.Dimensions);
		return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
	});

	let col1Groups = $derived(
		tablet?.Model.Type === 'STANDALONE' ? ['Model', 'Physical', 'Standalone'] : ['Model']
	);
	const col2Groups = ['Digitizer'];
	const col3Groups = ['Display'];

	function getGroupFields(groups: string[]) {
		const expanded = groups.includes('Model') && tablet?.Model.Type !== 'STANDALONE'
			? [...groups, 'Physical']
			: groups;
		return TABLET_FIELDS.filter(f => expanded.includes(f.group));
	}

	function copyGroup(groupId: string, format: 'table' | 'list') {
		const rows = document.querySelectorAll(`#group-${groupId} .field-row`);
		const pairs = [...rows].map(r => ({
			label: r.querySelector('dt')?.textContent?.trim() ?? '',
			value: r.querySelector('dd')?.textContent?.trim().replace(/\s*computed$/, '') ?? '',
		}));
		if (format === 'table') {
			const trs = pairs.map(p => `<tr><td>${p.label}</td><td>${p.value}</td></tr>`).join('');
			navigator.clipboard.writeText(`<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${trs}</tbody></table>`);
		} else {
			const lis = pairs.map(p => `<li><b>${p.label}:</b> ${p.value}</li>`).join('');
			navigator.clipboard.writeText(`<ul>${lis}</ul>`);
		}
	}

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}


	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId!);
		const [allT, allCompat, loadedPens, iso] = await Promise.all([
			loadTabletsFromURL(base),
			loadPenCompatFromURL(base) as Promise<PenCompat[]>,
			loadPensFromURL(base) as Promise<Pen[]>,
			loadISOPaperSizesFromURL(base),
		]);
		isoSizes = iso;
		allPens = loadedPens;

		const found = allT.find((t) => t.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		tablet = found;

		const compatPenIds = new Set(
			allCompat
				.filter((c) => c.TabletId === found.Model.Id)
				.map((c) => c.PenId)
		);
		compatiblePens = loadedPens.filter((p) => compatPenIds.has(p.PenId));
		allTablets = allT;
	});

	let availableBrands = $derived(
		[...new Set(allTablets.filter(t => t.Model.Type === tablet?.Model.Type).map(t => t.Model.Brand))].sort()
	);

	let similarTablets = $derived.by(() => {
		if (!tablet) return [];
		let results = findSimilarTablets(tablet, allTablets, {
			similarSize: filterSimilarSize,
			samePen: filterSamePen,
			sameYearOrLater: filterSameYearOrLater,
		});
		if (filterBrand !== 'all') {
			results = results.filter(t => t.Model.Brand === filterBrand);
		}
		results.sort((a, b) => {
			if (similarSort === 'year') {
				return (a.Model.LaunchYear || '').localeCompare(b.Model.LaunchYear || '');
			}
			const da = getDiagonal(a.Digitizer?.Dimensions) ?? 0;
			const db = getDiagonal(b.Digitizer?.Dimensions) ?? 0;
			return da - db;
		});
		return results;
	});
</script>

{#if notFound}
	<h1>Tablet not found</h1>
	<p><a href="{base}/">Back to tablets</a></p>
{:else}
	<p class="back"><a href="{base}/">&larr; Tablets</a></p>
	<div class="title-row">
		<h1>{tablet ? `${brandName(tablet.Model.Brand)} ${tablet.Model.Name}` : 'Loading...'}</h1>
		{#if tablet}
			<button class="flag-toggle" class:flagged={$flaggedTablets.includes(tablet.Meta.EntityId)} onclick={() => toggleFlag(tablet!.Meta.EntityId)}>
				{$flaggedTablets.includes(tablet.Meta.EntityId) ? 'Unflag' : 'Flag'}
			</button>
		{/if}
		<button class="unit-toggle" onclick={toggleUnits}>
			{$unitPreference === 'metric' ? 'Metric' : 'Imperial'}
		</button>
		<button class="alt-units-toggle" onclick={toggleAltUnits} title="Show/hide alternate unit conversions">
			{$showAltUnits ? '± Alt Units' : 'Primary Only'}
		</button>
		{#if tablet}
			<button class="json-btn" onclick={() => showJson = true}>JSON</button>
		{/if}
	</div>

	{#if showJson && tablet}
		<JsonDialog entity={tablet} onclose={() => showJson = false} />
	{/if}

	{#if tablet}
		<div class="detail-columns">
			{#each [col1Groups, col2Groups, col3Groups] as groups}
				<div class="detail-col">
					{#each groups as group}
						{@const groupFields = getGroupFields([group])}
						{@const hasValues = groupFields.some(f => { const v = f.getValue(tablet!); return v && v !== '-'; })}
						{#if hasValues}
							<section class="field-group" id="group-{group.toLowerCase()}">
								<div class="group-header">
									<h2>{group}</h2>
									<select class="copy-select" onchange={(e) => {
										const sel = e.currentTarget as HTMLSelectElement;
										if (sel.value) { copyGroup(group.toLowerCase(), sel.value); sel.value = ''; }
									}}>
										<option value="">Copy as…</option>
										<option value="table">Table</option>
										<option value="list">Bulleted list</option>
									</select>
								</div>
								<dl>
									{#each groupFields as f}
										{@const val = f.getValue(tablet!)}
										{@const displayVal = formatValue(val, f.unit, $unitPreference)}
										{#if val && val !== '-'}
											<div class="field-row">
												<dt>{stripUnit(f.label, f.unit)}</dt>
												<dd>
													{#if f.key === 'ModelIncludedPen'}
														{includedPenNames(tablet!)}
													{:else if isUrl(val)}
														<a href={val} target="_blank" rel="noopener">{val}</a>
													{:else}
														{formatValueWithAlt(val, f.label, f.unit, $unitPreference, $showAltUnits)}
													{/if}
													{#if f.computed}
														<span class="computed-badge">computed</span>
													{/if}
												</dd>
											</div>
										{/if}
									{/each}
								</dl>
								{#if group === 'Digitizer' && closestISO}
									<div class="field-row">
										<dt>Similar ISO Paper</dt>
										<dd>{closestISO} <span class="computed-badge">computed</span></dd>
									</div>
								{/if}
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
								title={`${brandName(tablet.Model.Brand)} ${tablet.Model.Name} (${tablet.Model.Id}) active area diagonal compared to other ${tablet.Model.Type === 'PENTABLET' ? 'pen tablets' : tablet.Model.Type === 'PENDISPLAY' ? 'pen displays' : 'standalone tablets'}`}
								values={histogramValues}
								currentValue={histogramCurrentValue}
								currentLabel={`${brandName(tablet.Model.Brand)} ${tablet.Model.Name} (${tablet.Model.Id})`}
								ranges={histogramRanges}
								unit={isMetric ? ' cm' : '"'}
								binSize={isMetric ? 1 : 0.5}
								bandwidthMultiplier={0.2}
								bind:compareYears
							/>
			</div>
		</section>

		<section class="compat-section">
			<div class="similar-header">
				<h2>Compatible Pens</h2>
				<button class="copy-btn" onclick={() => {
					const list = document.querySelector('.entity-list');
					if (list) navigator.clipboard.writeText(list.outerHTML);
				}}>Copy as HTML</button>
			</div>
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
			<div class="similar-header">
				<h2>Similar Tablets</h2>
				<button class="copy-btn" onclick={() => {
					const table = document.querySelector('.similar-table');
					if (table) navigator.clipboard.writeText(table.outerHTML);
				}}>Copy as HTML</button>
			</div>
			<div class="similar-filters">
				<label><input type="checkbox" bind:checked={filterSimilarSize} /> Similar size</label>
				<label><input type="checkbox" bind:checked={filterSamePen} /> Same included pen</label>
				<label><input type="checkbox" bind:checked={filterSameYearOrLater} /> Same year or later</label>
				<label>
					Brand:
					<select class="filter-select" bind:value={filterBrand}>
						<option value="all">All</option>
						{#each availableBrands as b}
							<option value={b}>{brandName(b)}</option>
						{/each}
					</select>
				</label>
				<label>
					Sort:
					<select class="filter-select" bind:value={similarSort}>
						<option value="year">Year</option>
						<option value="diagonal">Diagonal</option>
					</select>
				</label>
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
							{@const d = t.Digitizer?.Dimensions}
							{@const diag = getDiagonal(t.Digitizer?.Dimensions)}
							{@const px = t.Display?.PixelDimensions}
							{@const pxDensity = (px && d && px.Width && d.Width) ? (px.Width / d.Width).toFixed(2) : ''}
							{@const pxCat = (() => { if (!px || !px.Width || !px.Height) return ''; const w = px.Width, h = px.Height; if (w === 1920 && h === 1080) return 'Full HD'; if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K'; if (w === 2880 && h === 1800) return '3K'; if (w === 3840 && h === 2160) return '4K'; return 'Other'; })()}
							<tr>
								<td><a href="{base}/tablets/{encodeURIComponent(t.Meta.EntityId)}">{brandName(t.Model.Brand)} {t.Model.Name} ({t.Model.Id})</a></td>
								<td>{t.Model.LaunchYear || ''}</td>
								<td>{d ? `${d.Width} x ${d.Height} mm` : ''}</td>
								<td>{diag ? `${diag.toFixed(1)} mm` : ''}</td>
								{#if hasDisplay}
									<td>{px ? `${px.Width} x ${px.Height}` : ''}</td>
									<td>{pxCat}</td>
									<td>{pxDensity ? `${pxDensity} px/mm` : ''}</td>
								{/if}
								<td>{(t.Model.IncludedPen ?? []).join(', ')}</td>
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

	.flag-toggle {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #d97706;
		border-radius: 4px;
		background: var(--bg-card);
		color: #d97706;
		cursor: pointer;
		font-weight: 600;
	}

	.flag-toggle:hover {
		background: #d97706;
		color: #fff;
	}

	.flag-toggle.flagged {
		background: #d97706;
		color: #fff;
	}

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

	.alt-units-toggle {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #2563eb;
		border-radius: 4px;
		background: var(--bg-card);
		color: #2563eb;
		cursor: pointer;
		font-weight: 600;
	}

	.alt-units-toggle:hover {
		background: #2563eb;
		color: #fff;
	}

	.json-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #6b7280;
		border-radius: 4px;
		background: var(--bg-card);
		color: #6b7280;
		cursor: pointer;
		font-weight: 600;
	}

	.json-btn:hover {
		background: #6b7280;
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

	.group-header {
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

	.similar-header {
		display: flex;
		align-items: center;
		gap: 8px;
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

	.copy-select {
		padding: 2px 6px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.similar-filters {
		display: flex;
		gap: 14px;
		margin-bottom: 10px;
		flex-wrap: wrap;
	}

	.filter-select {
		font-size: 13px;
		padding: 2px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
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


	.size-comparison {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}


	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
