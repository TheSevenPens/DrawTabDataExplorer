<script lang="ts">
	import { base } from '$app/paths';
	import { brandName, getDiagonal, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import { unitPreference, showAltUnits } from '$lib/unit-store.js';
	import Nav from '$lib/components/Nav.svelte';
	import { findSimilarTablets } from '$data/lib/compat-helpers.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { formatValue } from '$data/lib/units.js';
	import TabletSizeComparison from '$lib/components/TabletSizeComparison.svelte';
	import { flaggedTablets, toggleFlag } from '$lib/flagged-store.js';
	import { stripUnit, formatValueWithAlt } from '$lib/field-display.js';
	import { buildPenNameMap, formatPenIds } from '$lib/pen-helpers.js';
	import JsonDialog from '$lib/components/JsonDialog.svelte';

	let { data } = $props();
	let tablet: Tablet = $derived(data.tablet);
	let allTablets: Tablet[] = $derived(data.allTablets);
	let allPens: Pen[] = $derived(data.allPens);
	let compatiblePens: Pen[] = $derived(data.compatiblePens);
	let isoSizes: ISOPaperSize[] = $derived(data.isoSizes);

	let showJson = $state(false);
	let activeTab = $state<'specs' | 'size' | 'pens' | 'similar'>('specs');

	let penNameMap = $derived(buildPenNameMap(allPens));

	function includedPenNames(t: Tablet): string {
		return formatPenIds(t.Model.IncludedPen ?? [], penNameMap);
	}

	let filterSimilarSize = $state(true);
	let filterSamePen = $state(false);
	let filterBrand = $state('all');
	let filterSameYearOrLater = $state(false);
	let similarSort = $state<'year' | 'diagonal'>('year');

	let hasDisplay = $derived(tablet.Model.Type === 'PENDISPLAY' || tablet.Model.Type === 'STANDALONE');

	let closestISO = $derived.by(() => {
		const diagMm = getDiagonal(tablet.Digitizer?.Dimensions);
		if (!diagMm || isoSizes.length === 0) return null;
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
		const qualifier = pct >= 1
			? (diagMm > bestDiag ? `${pct}% larger than ` : `${pct}% smaller than `)
			: '~ ';
		return `${qualifier}${best.Name}`;
	});

	let col1Groups = $derived(
		tablet.Model.Type === 'STANDALONE' ? ['Model', 'Physical', 'Standalone'] : ['Model']
	);
	const col2Groups = ['Digitizer'];
	const col3Groups = ['Display'];

	function getGroupFields(groups: string[]) {
		const expanded = groups.includes('Model') && tablet.Model.Type !== 'STANDALONE'
			? [...groups, 'Physical']
			: groups;
		return TABLET_FIELDS.filter(f => expanded.includes(f.group));
	}

	function copyAllSpecs(format: 'table' | 'list') {
		const groups = document.querySelectorAll('.specs-section .field-group');
		const sections: Array<{ title: string; pairs: Array<{ label: string; value: string }> }> = [];
		for (const group of groups) {
			const title = group.querySelector('h2')?.textContent?.trim() ?? '';
			const rows = group.querySelectorAll('.field-row');
			const pairs = [...rows].map(r => ({
				label: r.querySelector('dt')?.textContent?.trim() ?? '',
				value: r.querySelector('dd')?.textContent?.trim().replace(/\s*computed$/, '') ?? '',
			}));
			if (pairs.length > 0) sections.push({ title, pairs });
		}
		if (format === 'table') {
			const rows = sections.flatMap(s => [
				`<tr><th colspan="2">${s.title}</th></tr>`,
				...s.pairs.map(p => `<tr><td>${p.label}</td><td>${p.value}</td></tr>`),
			]).join('');
			navigator.clipboard.writeText(`<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`);
		} else {
			const items = sections.map(s =>
				`<li><b>${s.title}</b><ul>${s.pairs.map(p => `<li><b>${p.label}:</b> ${p.value}</li>`).join('')}</ul></li>`
			).join('');
			navigator.clipboard.writeText(`<ul>${items}</ul>`);
		}
	}

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}

	let availableBrands = $derived(
		[...new Set(allTablets.filter(t => t.Model.Type === tablet.Model.Type).map(t => t.Model.Brand))].sort()
	);

	let similarTablets = $derived.by(() => {
		let results = findSimilarTablets(tablet, allTablets, {
			similarSize: filterSimilarSize,
			samePen: filterSamePen,
			sameYearOrLater: filterSameYearOrLater,
		});
		if (filterBrand !== 'all') results = results.filter(t => t.Model.Brand === filterBrand);
		results.sort((a, b) => {
			if (similarSort === 'year') return (a.Model.LaunchYear || '').localeCompare(b.Model.LaunchYear || '');
			const da = getDiagonal(a.Digitizer?.Dimensions) ?? 0;
			const db = getDiagonal(b.Digitizer?.Dimensions) ?? 0;
			return da - db;
		});
		return results;
	});
</script>

<Nav />

<div class="title-row">
	<h1>{brandName(tablet.Model.Brand)} {tablet.Model.Name}</h1>
	<button class="flag-toggle" class:flagged={$flaggedTablets.includes(tablet.Meta.EntityId)} onclick={() => toggleFlag(tablet.Meta.EntityId)}>
		{$flaggedTablets.includes(tablet.Meta.EntityId) ? 'Unflag' : 'Flag'}
	</button>
	<button class="json-btn" onclick={() => showJson = true}>JSON</button>
</div>

{#if showJson}
	<JsonDialog entity={tablet} onclose={() => showJson = false} />
{/if}

<section class="basics">
			<dl class="basics-grid">
				<div class="basics-item">
					<dt>Brand</dt>
					<dd><a href="{base}/entity/{tablet.Model.Brand.toLowerCase()}">{brandName(tablet.Model.Brand)}</a></dd>
				</div>
				<div class="basics-item">
					<dt>Model ID</dt>
					<dd>{tablet.Model.Id}</dd>
				</div>
				<div class="basics-item">
					<dt>Type</dt>
					<dd>{tablet.Model.Type}</dd>
				</div>
				{#if tablet.Model.LaunchYear}
					<div class="basics-item">
						<dt>Year</dt>
						<dd>{tablet.Model.LaunchYear}</dd>
					</div>
				{/if}
				{#if tablet.Model.Status}
					<div class="basics-item">
						<dt>Status</dt>
						<dd>{tablet.Model.Status}</dd>
					</div>
				{/if}
				{#if tablet.Model.Audience}
					<div class="basics-item">
						<dt>Audience</dt>
						<dd>{tablet.Model.Audience}</dd>
					</div>
				{/if}
				{#if (tablet.Model.IncludedPen ?? []).length > 0}
					<div class="basics-item">
						<dt>Included Pen</dt>
						<dd>{includedPenNames(tablet)}</dd>
					</div>
				{/if}
			</dl>
		</section>

		<div class="detail-tabs">
			<button class:active={activeTab === 'specs'}   onclick={() => activeTab = 'specs'}>Specs</button>
			<button class:active={activeTab === 'size'}    onclick={() => activeTab = 'size'}>Size Comparison</button>
			<button class:active={activeTab === 'pens'}    onclick={() => activeTab = 'pens'}>Compatible Pens</button>
			<button class:active={activeTab === 'similar'} onclick={() => activeTab = 'similar'}>Similar Tablets</button>
		</div>

		{#if activeTab === 'specs'}
			<section class="tab-content specs-section">
				<div class="specs-header">
					<select class="copy-select" onchange={(e) => {
						const sel = e.currentTarget as HTMLSelectElement;
						if (sel.value) { copyAllSpecs(sel.value as 'table' | 'list'); sel.value = ''; }
					}}>
						<option value="">Copy as…</option>
						<option value="table">Table</option>
						<option value="list">Bulleted list</option>
					</select>
				</div>
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
																<a href={val} target="_blank" rel="noopener">
																	{f.key === 'ModelUserManual' ? 'View Manual ↗' : f.key === 'ModelProductLink' ? 'View Product Page ↗' : val}
																</a>
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
			</section>
		{/if}

		{#if activeTab === 'size'}
		<section class="tab-content">
			<TabletSizeComparison {tablet} {allTablets} {isoSizes} />
		</section>
	{/if}

		{#if activeTab === 'pens'}
			<section class="tab-content">
				<div class="section-header">
					<button class="copy-btn" onclick={() => {
						const list = document.querySelector('.entity-list');
						if (list) navigator.clipboard.writeText(list.outerHTML);
					}}>Copy as HTML</button>
				</div>
				{#if compatiblePens.length > 0}
					<ul class="entity-list">
						{#each compatiblePens as pen}
							<li><a href="{base}/entity/{encodeURIComponent(pen.EntityId)}">{brandName(pen.Brand)} {pen.PenName === pen.PenId ? pen.PenId : `${pen.PenName} (${pen.PenId})`}</a></li>
						{/each}
					</ul>
				{:else}
					<p class="no-data">No pen compatibility data available for this tablet.</p>
				{/if}
			</section>
		{/if}

		{#if activeTab === 'similar'}
			<section class="tab-content">
				<div class="section-header">
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
					<button class="copy-btn" onclick={() => {
						const table = document.querySelector('.similar-table');
						if (table) navigator.clipboard.writeText(table.outerHTML);
					}}>Copy as HTML</button>
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
									<td><a href="{base}/entity/{encodeURIComponent(t.Meta.EntityId)}">{brandName(t.Model.Brand)} {t.Model.Name} ({t.Model.Id})</a></td>
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

<style>
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

	/* ── Basics ── */
	.basics {
		margin-bottom: 20px;
		padding: 12px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.basics-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		margin: 0;
		padding: 0;
	}

	.basics-item {
		display: flex;
		flex-direction: column;
		padding: 4px 20px 4px 0;
		min-width: 100px;
	}

	.basics-item dt {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-dim);
		margin-bottom: 2px;
	}

	.basics-item dd {
		font-size: 13px;
		color: var(--text);
	}

	.basics-item dd a {
		color: var(--link);
		text-decoration: none;
	}

	.basics-item dd a:hover { text-decoration: underline; }

	/* ── Detail tabs ── */
	.detail-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 16px;
	}

	.detail-tabs button {
		padding: 6px 16px;
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

	.detail-tabs button:hover {
		color: #2563eb;
		background: var(--bg-card);
		border-color: var(--border);
	}

	.detail-tabs button.active {
		background: var(--bg);
		color: #2563eb;
		border-color: var(--border);
		font-weight: 600;
	}

	.tab-content {
		margin-bottom: 24px;
	}

	/* ── Specs tab ── */
	.specs-header {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin-bottom: 12px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
	}

	.detail-columns {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 20px;
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




	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
