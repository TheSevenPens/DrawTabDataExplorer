<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import { IAF_BANDS, MAX_PRESSURE_BANDS } from '$lib/bands.js';
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
	import { estimateP00, estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';
	import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
	import PressureMetricSection, {
		type MetricRow,
	} from '$lib/pen-analysis/PressureMetricSection.svelte';

	let { data } = $props();
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let inventoryPens: InventoryPen[] = $derived(data.inventoryPens ?? []);

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

	const sectionDefs: Section[] = [
		{ id: 'iaf', category: 'Pressure', label: 'IAF (P00)' },
		{ id: 'max-pressure', category: 'Pressure', label: 'Max Pressure (P100)' },
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
					description={'Initial Activation Force across all non-defective measurement sessions. Lower is better — a lighter touch means more natural shading and less hand fatigue.'}
					bands={IAF_BANDS}
					axisMax={10}
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

		{#if activeSection === 'max-pressure'}
			<section class="section">
				<PressureMetricSection
					title="Max Pressure (P100) Distribution"
					description={'Force needed to reach 100% logical pressure across all non-defective measurement sessions. Too low forces the user to push uncomfortably hard; too high reduces dynamic range.'}
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
	{/snippet}
</SectionedPage>

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
</style>
