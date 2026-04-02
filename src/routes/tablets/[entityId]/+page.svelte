<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTabletsFromURL, loadPenCompatFromURL, loadPensFromURL, brandName, getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
	import { unitPreference, toggleUnits } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';
	import { getFieldDef } from '$data/lib/pipeline/index.js';

	let tablet: Tablet | null = $state(null);
	let allTablets: Tablet[] = $state([]);
	let compatiblePens: Pen[] = $state([]);
	let notFound = $state(false);

	let filterSimilarSize = $state(true);
	let filterSamePen = $state(false);
	let filterSameBrand = $state(false);

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
		const entityId = decodeURIComponent(page.params.entityId);
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
		let results = allTablets.filter(t => t.EntityId !== tablet!.EntityId && t.ModelType === tablet!.ModelType);

		if (filterSimilarSize) {
			const thisDiag = getDiagonal(tablet.DigitizerDimensions);
			if (thisDiag) {
				const tolerance = thisDiag * 0.1;
				results = results.filter(t => {
					const d = getDiagonal(t.DigitizerDimensions);
					return d !== null && Math.abs(d - thisDiag) <= tolerance;
				});
			}
		}

		if (filterSamePen && tablet.ModelIncludedPen) {
			const pens = new Set(tablet.ModelIncludedPen.split(',').map(p => p.trim()));
			results = results.filter(t => {
				if (!t.ModelIncludedPen) return false;
				return t.ModelIncludedPen.split(',').some(p => pens.has(p.trim()));
			});
		}

		if (filterSameBrand) {
			results = results.filter(t => t.Brand === tablet!.Brand);
		}

		return results;
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
						{@const hasValues = groupFields.some(f => { const v = f.getValue(tablet); return v && v !== '-'; })}
						{#if hasValues}
							<section class="field-group">
								<h2>{group}</h2>
								<dl>
									{#each groupFields as f}
										{@const val = f.getValue(tablet)}
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
			</div>
			{#if similarTablets.length > 0}
				<ul class="entity-list">
					{#each similarTablets as t}
						<li><a href="{base}/tablets/{encodeURIComponent(t.EntityId)}">{brandName(t.Brand)} {t.ModelName} ({t.ModelId})</a></li>
					{/each}
				</ul>
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

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
