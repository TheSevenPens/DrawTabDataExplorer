<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		brandName,
		getDiagonal,
		type Tablet,
		type ISOPaperSize,
	} from '$data/lib/drawtab-loader.js';
	import { unitPreference, showAltUnits } from '$lib/unit-store.js';
	import Nav from '$lib/components/Nav.svelte';
	import { findSimilarTablets } from '$data/lib/compat-helpers.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { type TabletFamily } from '$data/lib/entities/tablet-family-fields.js';
	import type { InventoryTablet } from '$data/lib/entities/inventory-tablet-fields.js';
	import TabletSizeComparison from '$lib/components/TabletSizeComparison.svelte';
	import ForceProportionsView from '$lib/components/ForceProportionsView.svelte';
	import { flaggedTablets, toggleFlag } from '$lib/flagged-store.js';
	import { tabletFullName, tabletBrandAndName } from '$lib/tablet-helpers.js';
	import { penFullName, comparePenByYearDesc } from '$lib/pen-helpers.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { stripUnit, formatValueWithAlt } from '$lib/field-display.js';
	import { buildPenNameMap } from '$lib/pen-helpers.js';
	import JsonDialog from '$lib/components/JsonDialog.svelte';

	let { data } = $props();
	let tablet: Tablet = $derived(data.tablet);
	let allTablets: Tablet[] = $derived(data.allTablets);
	let allPens: Pen[] = $derived(data.allPens);
	let compatiblePens: Pen[] = $derived(data.compatiblePens);
	let isoSizes: ISOPaperSize[] = $derived(data.isoSizes);
	let family: TabletFamily | null = $derived(data.family);

	let showJson = $state(false);
	let activeTab = $state<'model' | 'specs' | 'size' | 'force' | 'pens' | 'inventory' | 'similar'>(
		'model',
	);

	let inventoryUnits: InventoryTablet[] = $derived(data.inventoryUnits ?? []);

	let sortedCompatiblePens: Pen[] = $derived(
		[...(data.compatiblePens ?? [])].sort(comparePenByYearDesc),
	);

	let isPenTablet = $derived(tablet.Model.Type === 'PENTABLET');
	let activeAreaW = $derived(tablet.Digitizer?.Dimensions?.Width ?? 0);
	let activeAreaH = $derived(tablet.Digitizer?.Dimensions?.Height ?? 0);
	let canShowForce = $derived(isPenTablet && activeAreaW > 0 && activeAreaH > 0);

	let penNameMap = $derived(buildPenNameMap(allPens));

	let includedPenItems = $derived(
		(tablet.Model.IncludedPen ?? []).map((id) => ({
			entityId: id,
			name: penNameMap.get(id) ?? id,
		})),
	);

	let filterSimilarSize = $state(true);
	let filterSamePen = $state(false);
	let filterBrand = $state('all');
	let filterSameYearOrLater = $state(false);
	let similarSort = $state<'year' | 'diagonal'>('year');

	let hasDisplay = $derived(
		tablet.Model.Type === 'PENDISPLAY' || tablet.Model.Type === 'STANDALONE',
	);

	let closestISO = $derived.by(() => {
		const diagMm = getDiagonal(tablet.Digitizer?.Dimensions);
		if (!diagMm || isoSizes.length === 0) return null;
		const aSeries = isoSizes.filter((p) => p.Series === 'A');
		if (aSeries.length === 0) return null;
		let best = aSeries[0];
		let bestDist = Infinity;
		for (const p of aSeries) {
			const pDiag = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			const dist = Math.abs(pDiag - diagMm);
			if (dist < bestDist) {
				bestDist = dist;
				best = p;
			}
		}
		const bestDiag = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
		const pct = Math.round((Math.abs(diagMm - bestDiag) / bestDiag) * 100);
		const qualifier =
			pct >= 1 ? (diagMm > bestDiag ? `${pct}% larger than ` : `${pct}% smaller than `) : '~ ';
		return `${qualifier}${best.Name}`;
	});

	// Model tab: Model + Physical groups always
	const modelTabGroups = ['Model', 'Physical'];

	// Specs tab: Digitizer, Display, Standalone (no Model/Physical)
	const specsCol1Groups = ['Digitizer'];
	const specsCol2Groups = ['Display'];
	let specsCol3Groups = $derived(tablet.Model.Type === 'STANDALONE' ? ['Standalone'] : []);

	function getGroupFields(groups: string[]) {
		return TABLET_FIELDS.filter((f) => groups.includes(f.group));
	}

	function buildSpecsExport() {
		const groups = ['Digitizer', 'Display', ...specsCol3Groups];
		const rows: (string | number)[][] = [];
		for (const group of groups) {
			for (const f of getGroupFields([group])) {
				const v = f.getValue(tablet);
				rows.push([group, f.label, v == null ? '' : String(v)]);
			}
		}
		return {
			title: `Specs — ${tabletBrandAndName(tablet)}`,
			filename: `${tablet.Meta.EntityId}-specs`,
			headers: ['Group', 'Field', 'Value'],
			rows,
		};
	}

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}

	let availableBrands = $derived(
		[
			...new Set(
				allTablets.filter((t) => t.Model.Type === tablet.Model.Type).map((t) => t.Model.Brand),
			),
		].sort(),
	);

	function buildSimilarExport() {
		const headers = ['Tablet', 'Entity ID', 'Year', 'Dimensions (mm)', 'Diagonal (mm)'];
		if (hasDisplay) headers.push('Pixels', 'Pixel Category', 'Density (px/mm)');
		headers.push('Included Pen');
		const rows = similarTablets.map((t) => {
			const d = t.Digitizer?.Dimensions;
			const diag = getDiagonal(d);
			const px = t.Display?.PixelDimensions;
			const pxDensity = px && d && px.Width && d.Width ? (px.Width / d.Width).toFixed(2) : '';
			const pxCat = (() => {
				if (!px || !px.Width || !px.Height) return '';
				const w = px.Width,
					h = px.Height;
				if (w === 1920 && h === 1080) return 'Full HD';
				if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K';
				if (w === 2880 && h === 1800) return '3K';
				if (w === 3840 && h === 2160) return '4K';
				return 'Other';
			})();
			const row: (string | number)[] = [
				tabletFullName(t),
				t.Meta.EntityId,
				t.Model.LaunchYear ?? '',
				d ? `${d.Width} x ${d.Height}` : '',
				diag ? diag.toFixed(1) : '',
			];
			if (hasDisplay) {
				row.push(px ? `${px.Width} x ${px.Height}` : '', pxCat, pxDensity ? `${pxDensity}` : '');
			}
			row.push((t.Model.IncludedPen ?? []).join(', '));
			return row;
		});
		return {
			title: `Similar Tablets — ${tabletBrandAndName(tablet)}`,
			filename: `${tablet.Meta.EntityId}-similar-tablets`,
			headers,
			rows,
		};
	}

	let similarTablets = $derived.by(() => {
		let results = findSimilarTablets(tablet, allTablets, {
			similarSize: filterSimilarSize,
			samePen: filterSamePen,
			sameYearOrLater: filterSameYearOrLater,
		});
		if (filterBrand !== 'all') results = results.filter((t) => t.Model.Brand === filterBrand);
		results.sort((a, b) => {
			if (similarSort === 'year')
				return (a.Model.LaunchYear || '').localeCompare(b.Model.LaunchYear || '');
			const da = getDiagonal(a.Digitizer?.Dimensions) ?? 0;
			const db = getDiagonal(b.Digitizer?.Dimensions) ?? 0;
			return da - db;
		});
		return results;
	});
</script>

<Nav />

<div class="title-row">
	<h1>{tabletBrandAndName(tablet)}</h1>
	<button
		class="flag-toggle"
		class:flagged={$flaggedTablets.includes(tablet.Meta.EntityId)}
		onclick={() => toggleFlag(tablet.Meta.EntityId)}
	>
		{$flaggedTablets.includes(tablet.Meta.EntityId) ? 'Unflag' : 'Flag'}
	</button>
	<button class="json-btn" onclick={() => (showJson = true)}>JSON</button>
</div>

{#if showJson}
	<JsonDialog entity={tablet} onclose={() => (showJson = false)} />
{/if}

<section class="basics">
	<dl class="basics-grid">
		<div class="basics-item">
			<dt>Brand</dt>
			<dd>
				<a href={resolve('/entity/[entityId]', { entityId: tablet.Model.Brand.toLowerCase() })}
					>{brandName(tablet.Model.Brand)}</a
				>
			</dd>
		</div>
		{#if family}
			<div class="basics-item">
				<dt>Family</dt>
				<dd>
					<a href={resolve('/entity/[entityId]', { entityId: family.EntityId })}
						>{family.FamilyName}</a
					>
				</dd>
			</div>
		{/if}
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
		{#if includedPenItems.length > 0}
			<div class="basics-item">
				<dt>Included Pen</dt>
				<dd>
					{#each includedPenItems as pen, i (pen.entityId)}
						{#if i > 0},
						{/if}
						<a href={resolve('/entity/[entityId]', { entityId: pen.entityId })}>{pen.name}</a>
					{/each}
				</dd>
			</div>
		{/if}
	</dl>
</section>

<div class="detail-tabs">
	<button class:active={activeTab === 'model'} onclick={() => (activeTab = 'model')}>Model</button>
	<button class:active={activeTab === 'specs'} onclick={() => (activeTab = 'specs')}>Specs</button>
	<button class:active={activeTab === 'size'} onclick={() => (activeTab = 'size')}
		>Size Comparison</button
	>
	{#if canShowForce}
		<button class:active={activeTab === 'force'} onclick={() => (activeTab = 'force')}
			>Force Proportions</button
		>
	{/if}
	<button class:active={activeTab === 'pens'} onclick={() => (activeTab = 'pens')}
		>Compatible Pens</button
	>
	<button class:active={activeTab === 'inventory'} onclick={() => (activeTab = 'inventory')}
		>Inventory ({inventoryUnits.length})</button
	>
	<button class:active={activeTab === 'similar'} onclick={() => (activeTab = 'similar')}
		>Similar Tablets</button
	>
</div>

{#if activeTab === 'model'}
	<section class="tab-content specs-section">
		<div class="detail-columns">
			{#each modelTabGroups as group (group)}
				{@const groupFields = getGroupFields([group])}
				{@const hasValues = groupFields.some((f) => {
					const v = f.getValue(tablet!);
					return v && v !== '-';
				})}
				{#if hasValues}
					<div class="detail-col">
						<section class="field-group" id="group-{group.toLowerCase()}">
							<div class="group-header"><h2>{group}</h2></div>
							<dl>
								{#each groupFields as f (f.key)}
									{@const val = f.getValue(tablet!)}
									{#if val && val !== '-'}
										<div class="field-row">
											<dt>{stripUnit(f.label, f.unit)}</dt>
											<dd>
												{#if f.key === 'ModelIncludedPen'}
													{#each includedPenItems as pen, i (pen.entityId)}
														{#if i > 0},
														{/if}
														<a href={resolve('/entity/[entityId]', { entityId: pen.entityId })}
															>{pen.name}</a
														>
													{/each}
												{:else if f.key === 'ModelFamily' && family}
													<a href={resolve('/entity/[entityId]', { entityId: family.EntityId })}
														>{family.FamilyName}</a
													>
												{:else if isUrl(val)}
													<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
													<a href={val} target="_blank" rel="noopener">
														{f.key === 'ModelUserManual'
															? 'View Manual ↗'
															: f.key === 'ModelProductLink'
																? 'View Product Page ↗'
																: val}
													</a>
												{:else}
													{f.getDisplayValue
														? f.getDisplayValue(tablet!)
														: formatValueWithAlt(
																val,
																f.label,
																f.unit,
																$unitPreference,
																$showAltUnits,
															)}
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
					</div>
				{/if}
			{/each}
		</div>
	</section>
{/if}

{#if activeTab === 'specs'}
	{@const specsExport = buildSpecsExport()}
	<section class="tab-content specs-section">
		<div class="specs-header">
			<ExportTableButton
				entityType="tablet-specs"
				title={specsExport.title}
				filename={specsExport.filename}
				headers={specsExport.headers}
				rows={specsExport.rows}
			/>
		</div>
		<div class="detail-columns">
			{#each [specsCol1Groups, specsCol2Groups, ...specsCol3Groups.map( (g) => [g], )] as groups, i (i)}
				<div class="detail-col">
					{#each groups as group (group)}
						{@const groupFields = getGroupFields([group])}
						{@const hasValues = groupFields.some((f) => {
							const v = f.getValue(tablet!);
							return v && v !== '-';
						})}
						{#if hasValues}
							<section class="field-group" id="group-{group.toLowerCase()}">
								<div class="group-header"><h2>{group}</h2></div>
								<dl>
									{#each groupFields as f (f.key)}
										{@const val = f.getValue(tablet!)}
										{#if val && val !== '-'}
											<div class="field-row">
												<dt>{stripUnit(f.label, f.unit)}</dt>
												<dd>
													{#if isUrl(val)}
														<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
														<a href={val} target="_blank" rel="noopener">
															{f.key === 'ModelUserManual'
																? 'View Manual ↗'
																: f.key === 'ModelProductLink'
																	? 'View Product Page ↗'
																	: val}
														</a>
													{:else}
														{formatValueWithAlt(
															val,
															f.label,
															f.unit,
															$unitPreference,
															$showAltUnits,
														)}
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

{#if activeTab === 'force' && canShowForce}
	<section class="tab-content">
		<ForceProportionsView width={activeAreaW} height={activeAreaH} />
	</section>
{/if}

{#if activeTab === 'pens'}
	<section class="tab-content">
		{#if sortedCompatiblePens.length > 0}
			<div class="table-header">
				<ExportTableButton
					entityType="tablet-pens"
					title={`Compatible Pens — ${tabletBrandAndName(tablet)}`}
					filename={`${tablet.Meta.EntityId}-compatible-pens`}
					headers={['Pen', 'Entity ID', 'Brand', 'Year']}
					rows={sortedCompatiblePens.map((p) => [
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
					{#each sortedCompatiblePens as pen (pen.EntityId)}
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
	</section>
{/if}

{#if activeTab === 'inventory'}
	<section class="tab-content">
		{#if inventoryUnits.length > 0}
			<table class="compat-table">
				<thead>
					<tr>
						<th>Inventory ID</th>
						<th>Vendor</th>
						<th>Order Date</th>
						<th>Defective</th>
					</tr>
				</thead>
				<tbody>
					{#each inventoryUnits as u (u._id)}
						<tr>
							<td><a href={resolve('/tablet-inventory/[id]', { id: u._id })}>{u.InventoryId}</a></td
							>
							<td>{u.Vendor || ''}</td>
							<td>{u.OrderDate || ''}</td>
							<td>{(u.Defects?.length ?? 0) > 0 ? 'YES' : ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">You don't own a unit of this tablet model.</p>
		{/if}
	</section>
{/if}

{#if activeTab === 'similar'}
	{@const similarExport = buildSimilarExport()}
	<section class="tab-content">
		<div class="section-header">
			<div class="similar-filters">
				<label><input type="checkbox" bind:checked={filterSimilarSize} /> Similar size</label>
				<label><input type="checkbox" bind:checked={filterSamePen} /> Same included pen</label>
				<label
					><input type="checkbox" bind:checked={filterSameYearOrLater} /> Same year or later</label
				>
				<label>
					Brand:
					<select class="filter-select" bind:value={filterBrand}>
						<option value="all">All</option>
						{#each availableBrands as b (b)}
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
			<ExportTableButton
				entityType="tablet-similar"
				disabled={similarTablets.length === 0}
				title={similarExport.title}
				filename={similarExport.filename}
				headers={similarExport.headers}
				rows={similarExport.rows}
			/>
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
					{#each similarTablets as t (t.Meta.EntityId)}
						{@const d = t.Digitizer?.Dimensions}
						{@const diag = getDiagonal(t.Digitizer?.Dimensions)}
						{@const px = t.Display?.PixelDimensions}
						{@const pxDensity =
							px && d && px.Width && d.Width ? (px.Width / d.Width).toFixed(2) : ''}
						{@const pxCat = (() => {
							if (!px || !px.Width || !px.Height) return '';
							const w = px.Width,
								h = px.Height;
							if (w === 1920 && h === 1080) return 'Full HD';
							if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K';
							if (w === 2880 && h === 1800) return '3K';
							if (w === 3840 && h === 2160) return '4K';
							return 'Other';
						})()}
						<tr>
							<td
								><a href={resolve('/entity/[entityId]', { entityId: t.Meta.EntityId })}
									>{tabletFullName(t)}</a
								></td
							>
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

	h1 {
		margin: 0;
	}

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

	.basics-item dd a:hover {
		text-decoration: underline;
	}

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

	dd a:hover {
		text-decoration: underline;
	}

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

	.similar-table th,
	.similar-table td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	.similar-table th {
		background: var(--th-bg);
		color: var(--th-text);
		font-weight: 600;
	}

	.similar-table tr:hover td {
		background: var(--hover-bg);
	}

	.similar-table a {
		color: var(--link);
		text-decoration: none;
	}

	.similar-table a:hover {
		text-decoration: underline;
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
