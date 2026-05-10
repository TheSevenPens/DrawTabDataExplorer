<script lang="ts">
	import { base } from '$app/paths';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import type { Pen, PressureResponse } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import {
		type PenFamily,
		PEN_FAMILY_FIELDS,
		PEN_FAMILY_FIELD_GROUPS,
	} from '$data/lib/entities/pen-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import BandsChart, { type Band, type BandMarker } from '$lib/components/BandsChart.svelte';
	import { estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';
	import { flaggedPenFamilies, toggleFlaggedPenFamily } from '$lib/flagged-store.js';
	import { paletteColor } from '$lib/chart-palette.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';

	// Keep in sync with src/routes/reference/+page.svelte (Max Physical Pressure section).
	const maxPressureBands: Band[] = [
		{ min: 100, max: 200, label: 'LIMITED' },
		{ min: 200, max: 350, label: 'OK' },
		{ min: 350, max: 500, label: 'GOOD' },
		{ min: 500, max: 900, label: 'EXCELLENT' },
		{ min: 900, max: null, label: 'EXCESSIVE' },
	];

	let { data } = $props();
	let family: PenFamily = $derived(data.family);
	let memberPens: Pen[] = $derived(data.memberPens);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	// Build a per-pen label so the chart legend distinguishes models
	// within the same family.
	let penLabelById = $derived(
		new Map(
			memberPens.map((p) => [
				p.EntityId,
				p.PenName === p.PenId ? p.PenId : `${p.PenName} (${p.PenId})`,
			]),
		),
	);

	let sessionColors = $derived(new Map(pressureSessions.map((s, i) => [s._id, paletteColor(i)])));

	let chartSessions = $derived(
		pressureSessions.map((s) => {
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				id: s._id,
				label: `${penLabelById.get(s.PenEntityId) ?? s.PenEntityId} · ${s.InventoryId} ${s.Date}`,
				records: s.Records,
				color: sessionColors.get(s._id),
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);

	let hiddenSessionIds = $state(new Set<string>());

	function toggleSessionVisibility(id: string) {
		const next = new Set(hiddenSessionIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		hiddenSessionIds = next;
	}

	// Per-session P100 estimates (max-force) across the family.
	// Defective sessions are excluded — they reflect a broken digitizer,
	// not the pen's true saturation force.
	let p100Values = $derived(
		pressureSessions
			.filter((s) => !defectsByInventoryId.has(s.InventoryId))
			.map((s) => estimateP100(s.Records))
			.filter((v): v is number => v !== null && isFinite(v)),
	);

	let p100Markers: BandMarker[] = $derived(p100Values.map((v) => ({ value: v, dashed: false })));

	let p100Stats = $derived.by(() => {
		const xs = [...p100Values].sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});

	let p100SummaryMarkers: BandMarker[] = $derived(
		p100Stats
			? [
					{ value: p100Stats.min, dashed: false },
					{ value: p100Stats.max, dashed: false },
					{ value: p100Stats.median, label: 'Median', dashed: false, strokeWidth: 4 },
				]
			: [],
	);

	let activeTab = $state<'specs' | 'members' | 'pressure' | 'maxpressure'>('specs');
</script>

<Nav />

<div class="title-row">
	<h1>{family.FamilyName}</h1>
	<FlagButton
		flagged={$flaggedPenFamilies.includes(family.EntityId.toLowerCase())}
		onclick={() => toggleFlaggedPenFamily(family.EntityId)}
		label="Flag this pen family"
	/>
</div>

<div class="detail-tabs">
	<button class:active={activeTab === 'specs'} onclick={() => (activeTab = 'specs')}>Specs</button>
	<button class:active={activeTab === 'members'} onclick={() => (activeTab = 'members')}
		>Pens ({memberPens.length})</button
	>
	<button class:active={activeTab === 'pressure'} onclick={() => (activeTab = 'pressure')}
		>Pressure Response ({pressureSessions.length})</button
	>
	<button class:active={activeTab === 'maxpressure'} onclick={() => (activeTab = 'maxpressure')}
		>Max Pressure</button
	>
</div>

{#if activeTab === 'specs'}
	<div class="tab-content">
		<DetailView item={family} fields={PEN_FAMILY_FIELDS} fieldGroups={PEN_FAMILY_FIELD_GROUPS} />
	</div>
{/if}

{#if activeTab === 'members'}
	<div class="tab-content">
		{#if memberPens.length > 0}
			<table class="pen-table">
				<thead>
					<tr><th>Name</th><th>Year</th></tr>
				</thead>
				<tbody>
					{#each memberPens as p}
						<tr>
							<td>
								<a href="{base}/entity/{encodeURIComponent(p.EntityId)}">
									{brandName(p.Brand)}
									{p.PenName}
									{#if p.PenName !== p.PenId}<span class="dim">({p.PenId})</span>{/if}
								</a>
							</td>
							<td class="year">{p.PenYear || ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="dim">No pens are linked to this family.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'pressure'}
	<div class="tab-content">
		{#if pressureSessions.length > 0}
			<PressureChart
				sessions={chartSessions}
				title={`${family.FamilyName} pressure response`}
				hiddenIds={hiddenSessionIds}
			/>
			<PressureResponseChartLegendTable
				sessions={pressureSessions}
				colors={sessionColors}
				hiddenIds={hiddenSessionIds}
				onToggle={toggleSessionVisibility}
				penNameById={penLabelById}
				{defectsByInventoryId}
				showModel
			/>
			<SessionStats
				sessions={pressureSessions}
				title="Aggregated across sessions in this family"
				{defectsByInventoryId}
			/>
		{:else}
			<p class="dim">No pressure response data available for any pen in this family.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'maxpressure'}
	<div class="tab-content">
		<p class="ref-blurb">
			Maximum physical pressure is the force at which the digitizer saturates (reports its maximum
			pressure value). The red lines show the estimated <strong>P100</strong> (max-force) for each measurement
			session of pens in this family.
		</p>
		<BandsChart
			bands={maxPressureBands}
			axisMax={1000}
			axisStep={100}
			unit="gf"
			title={`${family.FamilyName} max pressure`}
			heading={`${family.FamilyName} — All max pressures`}
			markers={p100Markers}
		/>
		{#if p100Stats}
			<p class="ref-blurb summary-blurb">
				Summary across sessions — outer lines mark <strong>min</strong> and
				<strong>max</strong>, the thick line marks the <strong>median</strong>.
			</p>
			<BandsChart
				bands={maxPressureBands}
				axisMax={1000}
				axisStep={100}
				unit="gf"
				title={`${family.FamilyName} max pressure summary`}
				heading={`${family.FamilyName} — Max pressure range`}
				markers={p100SummaryMarkers}
				shadedRange={{ min: p100Stats.min, max: p100Stats.max }}
			/>
			<table class="p100-summary-table">
				<thead>
					<tr>
						<th>Min<br /><span class="unit">(gf)</span></th>
						<th>Median<br /><span class="unit">(gf)</span></th>
						<th>Max<br /><span class="unit">(gf)</span></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="mono">{fmtP(p100Stats.min)}</td>
						<td class="mono">{fmtP(p100Stats.median)}</td>
						<td class="mono">{fmtP(p100Stats.max)}</td>
					</tr>
				</tbody>
			</table>
			<p class="ref-blurb summary-blurb">
				Pressure response near saturation — the same chart from the Pressure Response tab, zoomed to
				the 95–100% region so you can compare each session's approach to P100.
			</p>
			<PressureChart
				sessions={chartSessions}
				title={`${family.FamilyName} pressure response (max)`}
				hiddenIds={hiddenSessionIds}
				lockedZoom="max"
			/>
		{:else}
			<p class="dim">No pressure response measurements available for this family.</p>
		{/if}
	</div>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.title-row h1 {
		margin: 0;
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
	.ref-blurb {
		font-size: 13px;
		color: var(--text-muted);
		max-width: 800px;
		margin: 0 0 12px;
		line-height: 1.5;
	}
	.summary-blurb {
		margin-top: 20px;
	}
	.p100-summary-table {
		margin-top: 12px;
		border-collapse: collapse;
		font-size: 13px;
	}
	.p100-summary-table th,
	.p100-summary-table td {
		padding: 4px 18px;
		text-align: right;
		border-bottom: 1px solid var(--border);
	}
	.p100-summary-table th {
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.unit {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-muted);
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.pen-table {
		border-collapse: collapse;
		font-size: 13px;
		width: 100%;
	}
	.pen-table th {
		text-align: left;
		padding: 5px 10px;
		background: var(--th-bg);
		color: var(--th-text);
		border-bottom: 1px solid var(--border);
	}
	.pen-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.pen-table tr:hover td {
		background: var(--hover-bg);
	}
	.pen-table a {
		color: var(--link);
		text-decoration: none;
	}
	.pen-table a:hover {
		text-decoration: underline;
	}
	.year {
		color: var(--text-muted);
		width: 60px;
	}
</style>
