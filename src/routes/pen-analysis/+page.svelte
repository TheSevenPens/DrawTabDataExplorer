<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import { IAF_BANDS, MAX_PRESSURE_BANDS } from '$lib/bands.js';
	import type { Pen, PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
	import { estimateP00, estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';
	import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
	import { penFullName } from '$lib/pen-helpers.js';
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

	let iafRows = $derived(buildMetricRows(estimateP00));
	let maxRows = $derived(buildMetricRows(estimateP100));

	function median(xs: number[]): number {
		const s = [...xs].sort((a, b) => a - b);
		const mid = Math.floor(s.length / 2);
		return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
	}

	// Per-pen-model aggregates — used to rank both the highest and lowest
	// pen models on each metric. Aggregated across non-defective sessions
	// so a single noisy unit doesn't tip the ranking.
	let penNameById = $derived(new Map(pens.map((p) => [p.EntityId, penFullName(p)])));

	type PenModelStats = {
		penEntityId: string;
		min: number;
		median: number;
		max: number;
		sessionCount: number;
	};

	function aggregateByPenModel(rows: MetricRow[]): PenModelStats[] {
		const byPen = new Map<string, number[]>();
		for (const r of rows) {
			const arr = byPen.get(r.penEntityId);
			if (arr) arr.push(r.value);
			else byPen.set(r.penEntityId, [r.value]);
		}
		return [...byPen.entries()].map(([penEntityId, values]) => ({
			penEntityId,
			min: Math.min(...values),
			median: median(values),
			max: Math.max(...values),
			sessionCount: values.length,
		}));
	}

	let iafByPenModel = $derived(aggregateByPenModel(iafRows));
	let highestIafRows = $derived(
		[...iafByPenModel].sort((a, b) => b.median - a.median).slice(0, 10),
	);
	let lowestIafRows = $derived([...iafByPenModel].sort((a, b) => a.median - b.median).slice(0, 10));

	let maxByPenModel = $derived(aggregateByPenModel(maxRows));
	let highestMaxRows = $derived(
		[...maxByPenModel].sort((a, b) => b.median - a.median).slice(0, 10),
	);
	let lowestMaxRows = $derived([...maxByPenModel].sort((a, b) => a.median - b.median).slice(0, 10));

	const sectionDefs: Section[] = [
		{ id: 'iaf', category: 'Pressure', label: 'IAF (P00)' },
		{ id: 'lowest-iaf', category: 'Pressure', label: 'Lowest IAF' },
		{ id: 'highest-iaf', category: 'Pressure', label: 'Highest IAF' },
		{ id: 'max-pressure', category: 'Pressure', label: 'Max Pressure (P100)' },
		{ id: 'lowest-max', category: 'Pressure', label: 'Lowest MAX' },
		{ id: 'highest-max', category: 'Pressure', label: 'Highest MAX' },
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
					title="IAF (P00) Distribution"
					description="Initial Activation Force across all non-defective measurement sessions. Lower is better — a lighter touch means more natural shading and less hand fatigue."
					bands={IAF_BANDS}
					axisMax={22}
					binSize={0.5}
					tickStep={1}
					rows={iafRows}
					onExport={() =>
						openExport(
							'IAF (P00) per session',
							'pen-analysis-iaf-p00',
							['Inventory ID', 'Pen', 'P00 (gf)'],
							iafRows.map((r) => [r.inventoryId, r.penEntityId, fmtP(r.value)]),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'lowest-iaf'}
			<section class="section">
				<h2>Lowest IAF</h2>
				<p class="description">
					Top 10 pen models ranked by lowest median IAF (P00) across non-defective measurement
					sessions — the lightest pens to activate. Lower values mean less force is needed before
					the pen starts registering pressure.
				</p>
				{@render rankTable(lowestIafRows)}
			</section>
		{/if}

		{#if activeSection === 'highest-iaf'}
			<section class="section">
				<h2>Highest IAF</h2>
				<p class="description">
					Top 10 pen models ranked by median IAF (P00) across non-defective measurement sessions —
					the stiffest pens to activate. Higher values mean a heavier touch is needed before the pen
					registers any pressure.
				</p>
				{@render rankTable(highestIafRows)}
			</section>
		{/if}

		{#if activeSection === 'max-pressure'}
			<section class="section">
				<PressureMetricSection
					title="Max Pressure (P100) Distribution"
					description="Force needed to reach 100% logical pressure across all non-defective measurement sessions. Too low forces the user to push uncomfortably hard; too high reduces dynamic range."
					bands={MAX_PRESSURE_BANDS}
					axisMax={1000}
					binSize={25}
					tickStep={100}
					rows={maxRows}
					onExport={() =>
						openExport(
							'Max Pressure (P100) per session',
							'pen-analysis-max-pressure-p100',
							['Inventory ID', 'Pen', 'P100 (gf)'],
							maxRows.map((r) => [r.inventoryId, r.penEntityId, fmtP(r.value)]),
						)}
				/>
			</section>
		{/if}

		{#if activeSection === 'lowest-max'}
			<section class="section">
				<h2>Lowest MAX</h2>
				<p class="description">
					Top 10 pen models ranked by lowest median Max Pressure (P100) across non-defective
					measurement sessions — the pens that saturate at the lightest force. Lower values mean
					less dynamic range before the pen reads 100%.
				</p>
				{@render rankTable(lowestMaxRows)}
			</section>
		{/if}

		{#if activeSection === 'highest-max'}
			<section class="section">
				<h2>Highest MAX</h2>
				<p class="description">
					Top 10 pen models ranked by highest median Max Pressure (P100) across non-defective
					measurement sessions — the pens that take the most force to saturate. Higher values mean
					more dynamic range but a heavier press to reach full pressure.
				</p>
				{@render rankTable(highestMaxRows)}
			</section>
		{/if}
	{/snippet}
</SectionedPage>

{#snippet rankTable(rows: PenModelStats[])}
	{#if rows.length === 0}
		<p class="no-data">No measurements available.</p>
	{:else}
		<table class="rank-table">
			<thead>
				<tr>
					<th class="num">#</th>
					<th>Pen</th>
					<th class="num">Min <span class="unit">(gf)</span></th>
					<th class="num">Median <span class="unit">(gf)</span></th>
					<th class="num">Max <span class="unit">(gf)</span></th>
					<th class="num">Sessions</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r, i (r.penEntityId)}
					<tr>
						<td class="num mono">{i + 1}</td>
						<td
							><a href={resolve('/entity/[entityId]', { entityId: r.penEntityId })}
								>{penNameById.get(r.penEntityId) ?? r.penEntityId}</a
							></td
						>
						<td class="num mono">{fmtP(r.min)}</td>
						<td class="num mono">{fmtP(r.median)}</td>
						<td class="num mono">{fmtP(r.max)}</td>
						<td class="num mono">{r.sessionCount}</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
