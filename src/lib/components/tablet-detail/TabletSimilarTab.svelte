<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { resolve } from '$app/paths';
	import { brandName, getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';
	import { findSimilarTablets } from '$data/lib/compat-helpers.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { tabletFullName, tabletBrandAndName } from '$lib/tablet-helpers.js';

	let { tablet, allTablets }: { tablet: Tablet; allTablets: Tablet[] } = $props();

	let filterSimilarSize = $state(true);
	let filterSamePen = $state(false);
	let filterBrand = $state('all');
	let filterSameYearOrLater = $state(false);
	let similarSort = $state<'year' | 'diagonal'>('year');

	let hasDisplay = $derived(
		tablet.Model.Type === 'PENDISPLAY' || tablet.Model.Type === 'STANDALONE',
	);

	let availableBrands = $derived(
		[
			...new Set(
				allTablets.filter((t) => t.Model.Type === tablet.Model.Type).map((t) => t.Model.Brand),
			),
		].sort(),
	);

	function pixelCategory(px: { Width?: number; Height?: number } | undefined): string {
		if (!px || !px.Width || !px.Height) return '';
		const w = px.Width;
		const h = px.Height;
		if (w === 1920 && h === 1080) return 'Full HD';
		if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K';
		if (w === 2880 && h === 1800) return '3K';
		if (w === 3840 && h === 2160) return '4K';
		return 'Other';
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

	let similarExport = $derived.by(() => {
		const headers = ['Tablet', 'Entity ID', 'Year', 'Dimensions (mm)', 'Diagonal (mm)'];
		if (hasDisplay) headers.push('Pixels', 'Pixel Category', 'Density (px/mm)');
		headers.push('Included Pen');
		const rows = similarTablets.map((t) => {
			const d = t.Digitizer?.Dimensions;
			const diag = getDiagonal(d);
			const px = t.Display?.PixelDimensions;
			const pxDensity = px && d && px.Width && d.Width ? (px.Width / d.Width).toFixed(2) : '';
			const row: (string | number)[] = [
				tabletFullName(t),
				t.Meta.EntityId,
				t.Model.LaunchYear ?? '',
				d ? `${d.Width} x ${d.Height}` : '',
				diag ? diag.toFixed(1) : '',
			];
			if (hasDisplay) {
				row.push(
					px ? `${px.Width} x ${px.Height}` : '',
					pixelCategory(px),
					pxDensity ? `${pxDensity}` : '',
				);
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
	});
</script>

<div class="section-header">
	<div class="similar-filters">
		<label><input type="checkbox" bind:checked={filterSimilarSize} /> Similar size</label>
		<label><input type="checkbox" bind:checked={filterSamePen} /> Same included pen</label>
		<label><input type="checkbox" bind:checked={filterSameYearOrLater} /> Same year or later</label>
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
				{@const pxDensity = px && d && px.Width && d.Width ? (px.Width / d.Width).toFixed(2) : ''}
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
						<td>{pixelCategory(px)}</td>
						<td>{pxDensity ? `${pxDensity} px/mm` : ''}</td>
					{/if}
					<td>{(t.Model.IncludedPen ?? []).join(', ')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<EmptyState>No matching tablets found. Try adjusting the filters.</EmptyState>
{/if}

<style>
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
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
</style>
