<script lang="ts">
	import { getDiagonal, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import { TABLET_FIELDS, OTHER_INPUTS_GROUP } from '$data/lib/entities/tablet-fields.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { unitPreference, showAltUnits } from '$lib/unit-store.js';
	import { stripUnit, formatValueWithAlt } from '$lib/field-display.js';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import { powerSpecBlocks } from '$lib/power.js';

	let { tablet, isoSizes }: { tablet: Tablet; isoSizes: ISOPaperSize[] } = $props();

	const specsCol1Groups = ['Digitizer'];
	const specsCol2Groups = ['Display'];
	// Other Inputs and Connectivity apply to every tablet type; Power only when the
	// manufacturer published it; Standalone only to STANDALONE.
	let specsCol3Groups = $derived([
		OTHER_INPUTS_GROUP,
		'Connectivity',
		...(tablet.Power ? ['Power'] : []),
		...(tablet.Model.Type === 'STANDALONE' ? ['Standalone'] : []),
	]);

	function getGroupFields(groups: string[]) {
		return TABLET_FIELDS.filter((f) => groups.includes(f.group));
	}

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}

	// Power renders as sub-blocks (Input rating / Alternative input /
	// Consumption / Adapter & output) rather than one flat list, so what the
	// input accepts never reads as what the tablet draws. See $lib/power.ts.
	let powerBlocks = $derived(powerSpecBlocks(tablet));

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

	let specsExport = $derived.by(() => {
		const groups = ['Digitizer', 'Display', ...specsCol3Groups];
		const rows: (string | number)[][] = [];
		for (const group of groups) {
			if (group === 'Power') {
				for (const b of powerBlocks) {
					for (const r of b.rows) {
						rows.push([group, `${b.heading}: ${r.label}${r.unit ? ` (${r.unit})` : ''}`, r.value]);
					}
				}
				continue;
			}
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
	});
</script>

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
	{#each [specsCol1Groups, specsCol2Groups, specsCol3Groups] as groups, i (i)}
		<div class="detail-col">
			{#each groups as group (group)}
				{@const groupFields = getGroupFields([group])}
				{@const hasValues = groupFields.some((f) => {
					const v = f.getValue(tablet);
					return v && v !== '-';
				})}
				{#if group === 'Power'}
					{#if powerBlocks.length > 0}
						<section class="field-group" id="group-power">
							<div class="group-header"><h2>Power</h2></div>
							{#each powerBlocks as block (block.heading)}
								<h3 class="sub-header">{block.heading}</h3>
								<dl>
									{#each block.rows as r (r.key)}
										<div class="field-row">
											<dt>{r.label}</dt>
											<dd>
												{r.unit ? `${r.value} ${r.unit}` : r.value}
												{#if r.computed}
													<span class="computed-badge" title="Input voltage × input current"
														>computed</span
													>
												{/if}
											</dd>
										</div>
									{/each}
								</dl>
							{/each}
						</section>
					{/if}
				{:else if hasValues}
					<section class="field-group" id="group-{group.toLowerCase().replace(/\s+/g, '-')}">
						<div class="group-header"><h2>{group}</h2></div>
						<dl>
							{#each groupFields as f (f.key)}
								{@const val = f.getValue(tablet)}
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

<style>
	.specs-header {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin-bottom: 12px;
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
		color: var(--text);
		margin-bottom: 0;
	}

	.sub-header {
		font-size: var(--type-caption);
		font-weight: 600;
		color: var(--text-dim);
		margin: 8px 0 2px;
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
</style>
