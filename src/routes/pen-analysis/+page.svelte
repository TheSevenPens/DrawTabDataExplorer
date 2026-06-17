<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import {
		PIAF_BANDS,
		PMAX_BANDS,
		PEN_DIAMETER_BANDS,
		PEN_WEIGHT_BANDS,
		PEN_LENGTH_BANDS,
		type Band,
	} from '$lib/bands.js';
	import BandsChart from '$lib/components/BandsChart.svelte';
	import type { Pen, PressureResponse } from '$data/lib/drawtab-loader.js';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
	import { estimatePmax, fmtP } from '$data/lib/pressure/interpolate.js';
	import { resolveRangeByUnit, type ResolvedRangeUnit } from '$data/lib/pressure/range-resolve.js';
	import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
	import { penFullName, penBrandAndName } from '$lib/pen-helpers.js';
	import PressureMetricSection, {
		type MetricRow,
	} from '$lib/pen-analysis/PressureMetricSection.svelte';

	let { data } = $props();
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let inventoryPens: InventoryPen[] = $derived(data.inventoryPens ?? []);
	let pens: Pen[] = $derived(data.pens ?? []);

	let penTabs = $derived(penSubNavTabs({ flaggedPenCount: $flaggedPenTotalCount }));

	let defectsByInventoryId = $derived(buildInventoryDefects(inventoryPens));

	let nonDefectiveSessions = $derived(
		pressureSessions.filter((s) => !defectsByInventoryId.has(s.InventoryId)),
	);

	function buildMetricRows(
		getValue: (records: PressureResponse['Records']) => number | null,
	): MetricRow[] {
		return nonDefectiveSessions
			.map((s) => {
				const value = getValue(s.Records);
				if (value === null || !Number.isFinite(value)) return null;
				return { value, penEntityId: s.PenEntityId, inventoryId: s.InventoryId };
			})
			.filter((r): r is MetricRow => r !== null);
	}

	// Both metrics resolve per pen unit — a direct measurement wins over the
	// estimate derived from that unit's sessions (measured wins per unit).
	let iafMeasurements = $derived(data.iafMeasurements ?? []);
	let maxMeasurements = $derived(data.maxMeasurements ?? []);
	let iafResolved = $derived(resolveRangeByUnit('IAF', nonDefectiveSessions, iafMeasurements));
	let maxResolved = $derived(resolveRangeByUnit('MAX', nonDefectiveSessions, maxMeasurements));
	let iafMeasuredCount = $derived(iafResolved.filter((r) => r.source === 'measured').length);

	// Distribution sections: one resolved value per unit (the median of that
	// unit's measured-or-estimated datapoints).
	let piafRows = $derived(
		iafResolved.map((u) => ({
			value: u.value,
			penEntityId: u.penEntityId,
			inventoryId: u.inventoryId,
		})),
	);
	let maxRows = $derived(buildMetricRows(estimatePmax));

	// Physical dimensions — one row per pen model that records the value.
	// inventoryId is unused here (these are model-level specs, not per-unit),
	// so the section passes its own subtitle instead of the pressure breakdown.
	function dimensionRows(getValue: (p: Pen) => string | undefined): MetricRow[] {
		return pens
			.map((p) => {
				const raw = getValue(p);
				const value = Number(raw);
				if (raw == null || raw === '' || !Number.isFinite(value)) return null;
				return { value, penEntityId: p.EntityId, inventoryId: '' };
			})
			.filter((r): r is MetricRow => r !== null);
	}
	let diameterRows = $derived(dimensionRows((p) => p.Diameter));
	let weightRows = $derived(dimensionRows((p) => p.Weight));
	let lengthRows = $derived(dimensionRows((p) => p.Length));

	// Tag-based pen groups. "UD EMR" lists every pen tagged "UDEMR".
	let udemrPens = $derived(
		pens
			.filter((p) => p.Tags?.includes('UDEMR'))
			.sort((a, b) => penBrandAndName(a).localeCompare(penBrandAndName(b))),
	);

	const penCountLabel = (n: number) => `${n} pen${n === 1 ? '' : 's'}`;
	function dimensionExportRows(rows: MetricRow[]): (string | number)[][] {
		return rows.map((r) => {
			const pen = penById.get(r.penEntityId);
			return [pen ? penFullName(pen) : r.penEntityId, fmtP(r.value)];
		});
	}

	// Per-datapoint samples (measured-wins applied per unit), feeding the
	// ranking tables so each row can report how many direct measurements vs
	// estimates went into its min/median/max.
	type RankSample = {
		value: number;
		penEntityId: string;
		inventoryId: string;
		source: 'measured' | 'estimated';
	};
	function flattenSamples(units: ResolvedRangeUnit[]): RankSample[] {
		return units.flatMap((u) =>
			u.samples.map((s) => ({
				value: s.value,
				penEntityId: u.penEntityId,
				inventoryId: u.inventoryId,
				source: s.source,
			})),
		);
	}
	let iafRankRows = $derived(flattenSamples(iafResolved));
	let maxRankRows = $derived(flattenSamples(maxResolved));

	function median(xs: number[]): number {
		const s = [...xs].sort((a, b) => a - b);
		const mid = Math.floor(s.length / 2);
		return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
	}

	// Aggregate sessions into ranked rows — either per pen model (default) or
	// per physical pen unit (InventoryId). Each section's "View" dropdown
	// picks which. Aggregated across non-defective sessions so a single noisy
	// session doesn't tip the ranking.
	let penById = $derived(new Map(pens.map((p) => [p.EntityId, p])));
	let invPenByInventoryId = $derived(new Map(inventoryPens.map((u) => [u.InventoryId, u])));

	type RankMode = 'models' | 'units';

	type RankRow = {
		key: string; // penEntityId (models) or inventoryId (units)
		label: string; // display name
		href: string; // detail-page link
		min: number;
		median: number;
		max: number;
		/** Datapoints behind min/median/max, split by source. */
		measuredCount: number;
		estimatedCount: number;
	};

	function statsOf(
		samples: RankSample[],
	): Pick<RankRow, 'min' | 'median' | 'max' | 'measuredCount' | 'estimatedCount'> {
		const values = samples.map((s) => s.value);
		return {
			min: Math.min(...values),
			median: median(values),
			max: Math.max(...values),
			measuredCount: samples.filter((s) => s.source === 'measured').length,
			estimatedCount: samples.filter((s) => s.source === 'estimated').length,
		};
	}

	function aggregateByPenModel(rows: RankSample[]): RankRow[] {
		const byPen = new Map<string, RankSample[]>();
		for (const r of rows) {
			const arr = byPen.get(r.penEntityId);
			if (arr) arr.push(r);
			else byPen.set(r.penEntityId, [r]);
		}
		return [...byPen.entries()].map(([penEntityId, samples]) => {
			const pen = penById.get(penEntityId);
			return {
				key: penEntityId,
				label: pen ? penFullName(pen) : penEntityId,
				href: resolve('/entity/[entityId]', { entityId: penEntityId }),
				...statsOf(samples),
			};
		});
	}

	function aggregateByPenUnit(rows: RankSample[]): RankRow[] {
		const byUnit = new Map<string, RankSample[]>();
		for (const r of rows) {
			const g = byUnit.get(r.inventoryId);
			if (g) g.push(r);
			else byUnit.set(r.inventoryId, [r]);
		}
		return [...byUnit.entries()].map(([inventoryId, samples]) => {
			const penEntityId = samples[0].penEntityId;
			const pen = penById.get(penEntityId);
			const unit = invPenByInventoryId.get(inventoryId);
			const name = pen ? penBrandAndName(pen) : penEntityId;
			return {
				key: inventoryId,
				label: `${name} (${inventoryId})`,
				href: unit
					? resolve('/pen-inventory/[id]', { id: unit._id })
					: resolve('/entity/[entityId]', { entityId: penEntityId }),
				...statsOf(samples),
			};
		});
	}

	// Full per-section pipeline: optional brand filter → aggregate by the
	// chosen mode → sort by median → take the top `count`. Brand is filtered
	// before aggregating so the ranking reflects only the selected brand.
	function sectionRows(
		metricRows: RankSample[],
		brand: string,
		mode: RankMode,
		dir: 'asc' | 'desc',
		count: number,
	): RankRow[] {
		const filtered = brand
			? metricRows.filter((r) => penById.get(r.penEntityId)?.Brand === brand)
			: metricRows;
		const agg = mode === 'units' ? aggregateByPenUnit(filtered) : aggregateByPenModel(filtered);
		return agg
			.sort((a, b) => (dir === 'asc' ? a.median - b.median : b.median - a.median))
			.slice(0, count);
	}

	// Props bundle for the rankTable snippet — one object per section keeps the
	// (now several) per-section controls readable instead of a long positional
	// argument list.
	type RankTableProps = {
		rows: RankRow[];
		title: string;
		filename: string;
		count: number;
		onCountChange: (n: number) => void;
		mode: RankMode;
		onModeChange: (m: RankMode) => void;
		brand: string;
		onBrandChange: (b: string) => void;
		brands: string[];
		/** When set, render the standard band-segment chart below the table
		 * with one marker line per row's median value. */
		chart?: { bands: Band[]; axisMax: number; axisStep: number; showUnitInAxis: boolean };
	};

	// Brands present in the measured (non-defective) sessions, sorted by
	// display name. Drives every section's brand-filter dropdown.
	let availableBrands = $derived.by(() => {
		const set = new Set<string>();
		for (const s of nonDefectiveSessions) {
			const b = penById.get(s.PenEntityId)?.Brand;
			if (b) set.add(b);
		}
		return [...set].sort((a, b) => brandName(a).localeCompare(brandName(b)));
	});

	// Per-section display state — each section's dropdowns control only itself.
	const ROW_COUNT_OPTIONS = [10, 20, 30];
	let lowestPiafCount = $state(10);
	let highestPiafCount = $state(10);
	let lowestMaxCount = $state(10);
	let highestMaxCount = $state(10);
	let lowestPiafMode = $state<RankMode>('models');
	let highestPiafMode = $state<RankMode>('models');
	let lowestMaxMode = $state<RankMode>('models');
	let highestMaxMode = $state<RankMode>('models');
	let lowestPiafBrand = $state('');
	let highestPiafBrand = $state('');
	let lowestMaxBrand = $state('');
	let highestMaxBrand = $state('');

	let lowestPiafRows = $derived(
		sectionRows(iafRankRows, lowestPiafBrand, lowestPiafMode, 'asc', lowestPiafCount),
	);
	let highestPiafRows = $derived(
		sectionRows(iafRankRows, highestPiafBrand, highestPiafMode, 'desc', highestPiafCount),
	);
	let lowestMaxRows = $derived(
		sectionRows(maxRankRows, lowestMaxBrand, lowestMaxMode, 'asc', lowestMaxCount),
	);
	let highestMaxRows = $derived(
		sectionRows(maxRankRows, highestMaxBrand, highestMaxMode, 'desc', highestMaxCount),
	);

	const sectionDefs: Section[] = [
		{ id: 'iaf', category: 'Pressure', label: 'IAF' },
		{ id: 'lowest-iaf', category: 'Pressure', label: 'Lowest IAF' },
		{ id: 'highest-iaf', category: 'Pressure', label: 'Highest IAF' },
		{ id: 'max', category: 'Pressure', label: 'MAX' },
		{ id: 'lowest-max', category: 'Pressure', label: 'Lowest MAX' },
		{ id: 'highest-max', category: 'Pressure', label: 'Highest MAX' },
		{ id: 'diameter', category: 'Dimensions', label: 'Diameter' },
		{ id: 'weight', category: 'Dimensions', label: 'Weight' },
		{ id: 'length', category: 'Dimensions', label: 'Length' },
		{ id: 'ud-emr', category: 'Tags', label: 'UD EMR' },
	];

	let exportDialog: {
		title: string;
		filename: string;
		headers: string[];
		rows: (string | number)[][];
	} | null = $state(null);

	function openExport(
		title: string,
		filename: string,
		headers: string[],
		rows: (string | number)[][],
	): void {
		exportDialog = { title, filename, headers, rows };
	}
</script>

<Nav />
<SubNav tabs={penTabs} />
<h1>Pen Analysis</h1>

<SectionedPage sections={sectionDefs} defaultSection="iaf">
	{#snippet content(activeSection: string)}
		{#if activeSection === 'iaf'}
			<section class="section">
				<PressureMetricSection
					title="IAF Distribution"
					description={`Initial Activation Force per pen unit — direct measurement where available, otherwise estimated from pressure sessions. Lower is better — a lighter touch means more natural shading and less hand fatigue. ${iafMeasuredCount} of ${iafResolved.length} units measured directly.`}
					bands={PIAF_BANDS}
					axisMax={22}
					binSize={0.5}
					tickStep={1}
					rows={piafRows}
					onExport={() =>
						openExport(
							'IAF per session',
							'pen-analysis-iaf',
							['Inventory ID', 'Pen', 'IAF (gf)'],
							piafRows.map((r) => [r.inventoryId, r.penEntityId, fmtP(r.value)]),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'lowest-iaf'}
			<section class="section">
				<h2>Lowest IAF</h2>
				{@render rankTable({
					rows: lowestPiafRows,
					title: 'Lowest IAF',
					filename: 'pen-analysis-lowest-iaf',
					count: lowestPiafCount,
					onCountChange: (n) => (lowestPiafCount = n),
					mode: lowestPiafMode,
					onModeChange: (m) => (lowestPiafMode = m),
					brand: lowestPiafBrand,
					onBrandChange: (b) => (lowestPiafBrand = b),
					brands: availableBrands,
					chart: { bands: PIAF_BANDS, axisMax: 22, axisStep: 1, showUnitInAxis: false },
				})}
			</section>
		{/if}

		{#if activeSection === 'highest-iaf'}
			<section class="section">
				<h2>Highest IAF</h2>
				{@render rankTable({
					rows: highestPiafRows,
					title: 'Highest IAF',
					filename: 'pen-analysis-highest-iaf',
					count: highestPiafCount,
					onCountChange: (n) => (highestPiafCount = n),
					mode: highestPiafMode,
					onModeChange: (m) => (highestPiafMode = m),
					brand: highestPiafBrand,
					onBrandChange: (b) => (highestPiafBrand = b),
					brands: availableBrands,
					chart: { bands: PIAF_BANDS, axisMax: 22, axisStep: 1, showUnitInAxis: false },
				})}
			</section>
		{/if}

		{#if activeSection === 'max'}
			<section class="section">
				<PressureMetricSection
					title="MAX Distribution"
					description="Force needed to reach 100% logical pressure across all non-defective measurement sessions. Too low forces the user to push uncomfortably hard; too high reduces dynamic range."
					bands={PMAX_BANDS}
					axisMax={1000}
					binSize={25}
					tickStep={100}
					rows={maxRows}
					onExport={() =>
						openExport(
							'MAX per session',
							'pen-analysis-max',
							['Inventory ID', 'Pen', 'MAX (gf)'],
							maxRows.map((r) => [r.inventoryId, r.penEntityId, fmtP(r.value)]),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'lowest-max'}
			<section class="section">
				<h2>Lowest MAX</h2>
				{@render rankTable({
					rows: lowestMaxRows,
					title: 'Lowest MAX',
					filename: 'pen-analysis-lowest-max',
					count: lowestMaxCount,
					onCountChange: (n) => (lowestMaxCount = n),
					mode: lowestMaxMode,
					onModeChange: (m) => (lowestMaxMode = m),
					brand: lowestMaxBrand,
					onBrandChange: (b) => (lowestMaxBrand = b),
					brands: availableBrands,
					chart: { bands: PMAX_BANDS, axisMax: 1000, axisStep: 100, showUnitInAxis: true },
				})}
			</section>
		{/if}

		{#if activeSection === 'highest-max'}
			<section class="section">
				<h2>Highest MAX</h2>
				{@render rankTable({
					rows: highestMaxRows,
					title: 'Highest MAX',
					filename: 'pen-analysis-highest-max',
					count: highestMaxCount,
					onCountChange: (n) => (highestMaxCount = n),
					mode: highestMaxMode,
					onModeChange: (m) => (highestMaxMode = m),
					brand: highestMaxBrand,
					onBrandChange: (b) => (highestMaxBrand = b),
					brands: availableBrands,
					chart: { bands: PMAX_BANDS, axisMax: 1000, axisStep: 100, showUnitInAxis: true },
				})}
			</section>
		{/if}

		{#if activeSection === 'diameter'}
			<section class="section">
				<PressureMetricSection
					title="Diameter Distribution"
					description="Barrel diameter across every pen model with a recorded value. Thicker barrels suit a relaxed grip; thinner ones a precise, pencil-like hold."
					bands={PEN_DIAMETER_BANDS}
					axisMax={34}
					binSize={1}
					tickStep={5}
					unit="mm"
					rows={diameterRows}
					subtitleOverride={penCountLabel(diameterRows.length)}
					onExport={() =>
						openExport(
							'Diameter',
							'pen-analysis-diameter',
							['Pen', 'Diameter (mm)'],
							dimensionExportRows(diameterRows),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'weight'}
			<section class="section">
				<PressureMetricSection
					title="Weight Distribution"
					description="Pen weight across every pen model with a recorded value. Heavier pens feel substantial but can fatigue over long sessions; lighter ones reduce strain."
					bands={PEN_WEIGHT_BANDS}
					axisMax={32}
					binSize={1}
					tickStep={5}
					unit="g"
					rows={weightRows}
					subtitleOverride={penCountLabel(weightRows.length)}
					onExport={() =>
						openExport(
							'Weight',
							'pen-analysis-weight',
							['Pen', 'Weight (g)'],
							dimensionExportRows(weightRows),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'length'}
			<section class="section">
				<PressureMetricSection
					title="Length Distribution"
					description="Overall length across every pen model with a recorded value. Longer pens balance differently in the hand than shorter, stubbier ones."
					bands={PEN_LENGTH_BANDS}
					axisMax={180}
					binSize={2}
					tickStep={10}
					unit="mm"
					rows={lengthRows}
					subtitleOverride={penCountLabel(lengthRows.length)}
					onExport={() =>
						openExport(
							'Length',
							'pen-analysis-length',
							['Pen', 'Length (mm)'],
							dimensionExportRows(lengthRows),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'ud-emr'}
			<section class="section">
				<h2>UD EMR</h2>
				<p class="description">
					Pens tagged <code>UDEMR</code> — universal-display EMR styli usable across compatible EMR tablets.
				</p>
				{#if udemrPens.length === 0}
					<p class="no-data">No pens tagged UDEMR.</p>
				{:else}
					<div class="rank-controls">
						<span class="ud-count">{penCountLabel(udemrPens.length)}</span>
						<ExportTableButton
							entityType="pen-analysis"
							title="UD EMR pens"
							filename="pen-analysis-ud-emr"
							headers={['Pen', 'Diameter (mm)', 'Weight (g)', 'Length (mm)']}
							rows={udemrPens.map((p) => [
								penFullName(p),
								p.Diameter ?? '',
								p.Weight ?? '',
								p.Length ?? '',
							])}
						/>
					</div>
					<table class="rank-table">
						<thead>
							<tr>
								<th>Pen</th>
								<th class="num">Diameter <span class="unit">(mm)</span></th>
								<th class="num">Weight <span class="unit">(g)</span></th>
								<th class="num">Length <span class="unit">(mm)</span></th>
							</tr>
						</thead>
						<tbody>
							{#each udemrPens as p (p.EntityId)}
								<tr>
									<td>
										<a href={resolve('/entity/[entityId]', { entityId: p.EntityId })}>
											{penFullName(p)}
										</a>
									</td>
									<td class="num mono">{p.Diameter || '—'}</td>
									<td class="num mono">{p.Weight || '—'}</td>
									<td class="num mono">{p.Length || '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>
		{/if}
	{/snippet}
</SectionedPage>

{#snippet rankTable(p: RankTableProps)}
	{#if p.rows.length === 0}
		<p class="no-data">No measurements available.</p>
	{:else}
		<div class="rank-controls">
			<div class="controls-left">
				<label class="show-count">
					Brand
					<select onchange={(e) => p.onBrandChange(e.currentTarget.value)}>
						<option value="" selected={p.brand === ''}>All brands</option>
						{#each p.brands as b (b)}
							<option value={b} selected={p.brand === b}>{brandName(b)}</option>
						{/each}
					</select>
				</label>
				<label class="show-count">
					View
					<select onchange={(e) => p.onModeChange(e.currentTarget.value as RankMode)}>
						<option value="models" selected={p.mode === 'models'}>Pen models</option>
						<option value="units" selected={p.mode === 'units'}>Pen units</option>
					</select>
				</label>
				<label class="show-count">
					Show
					<select onchange={(e) => p.onCountChange(Number(e.currentTarget.value))}>
						{#each ROW_COUNT_OPTIONS as n (n)}
							<option value={n} selected={p.count === n}>{n}</option>
						{/each}
					</select>
				</label>
			</div>
			<ExportTableButton
				entityType="pen-analysis"
				title={p.title}
				filename={p.filename}
				headers={[
					'Rank',
					p.mode === 'units' ? 'Pen unit' : 'Pen',
					'Min (gf)',
					'Median (gf)',
					'Max (gf)',
					'Measured',
					'Estimated',
				]}
				rows={p.rows.map((r, i) => [
					i + 1,
					r.label,
					fmtP(r.min),
					fmtP(r.median),
					fmtP(r.max),
					r.measuredCount,
					r.estimatedCount,
				])}
			/>
		</div>
		<table class="rank-table">
			<thead>
				<tr>
					<th class="num">#</th>
					<th>{p.mode === 'units' ? 'Pen unit' : 'Pen'}</th>
					<th class="num">Min <span class="unit">(gf)</span></th>
					<th class="num">Median <span class="unit">(gf)</span></th>
					<th class="num">Max <span class="unit">(gf)</span></th>
					<th class="num" title="Direct measurements behind these numbers">Measured</th>
					<th class="num" title="Estimates behind these numbers">Estimated</th>
				</tr>
			</thead>
			<tbody>
				{#each p.rows as r, i (r.key)}
					<tr>
						<td class="num mono">{i + 1}</td>
						<td><a href={r.href}>{r.label}</a></td>
						<td class="num mono">{fmtP(r.min)}</td>
						<td class="num mono">{fmtP(r.median)}</td>
						<td class="num mono">{fmtP(r.max)}</td>
						<td class="num mono">{r.measuredCount}</td>
						<td class="num mono">{r.estimatedCount}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if p.chart}
			{@const chart = p.chart}
			<div class="rank-chart">
				<BandsChart
					bands={chart.bands}
					axisMax={chart.axisMax}
					axisStep={chart.axisStep}
					unit="gf"
					showUnitInAxis={chart.showUnitInAxis}
					showBandRanges={false}
					title={p.filename}
					heading={p.title}
					markers={p.rows.map((r) => ({ value: Math.min(r.median, chart.axisMax), dashed: false }))}
				/>
			</div>
		{/if}
	{/if}
{/snippet}

{#if exportDialog}
	<ExportDialog
		entityType="pen-analysis"
		title={exportDialog.title}
		filename={exportDialog.filename}
		headers={exportDialog.headers}
		rows={exportDialog.rows}
		onclose={() => (exportDialog = null)}
	/>
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}
	.section {
		margin-bottom: 32px;
	}
	:global(.section h2) {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}
	:global(.section .description) {
		font-size: 13px;
		color: var(--text-dim);
		margin-bottom: 8px;
	}
	.no-data {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}
	.rank-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.ud-count {
		font-size: 12px;
		color: var(--text-muted);
	}
	.rank-controls :global(.table-export) {
		margin-bottom: 0;
	}
	.controls-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.rank-chart {
		margin-top: 20px;
	}
	.show-count {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.show-count select {
		font-size: 12px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}
	.rank-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 8px 0 16px;
		width: fit-content;
	}
	.rank-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.rank-table th.num {
		text-align: right;
	}
	.rank-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.rank-table td {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.rank-table td.num {
		text-align: right;
	}
	.rank-table tr:last-child td {
		border-bottom: none;
	}
	.rank-table tr:hover td {
		background: var(--hover-bg);
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
