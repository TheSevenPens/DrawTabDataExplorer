<script lang="ts">
	import { base } from '$app/paths';
	import { brandName, type Tablet, type PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import JsonDialog from '$lib/components/JsonDialog.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import BandsChart, { type Band, type BandMarker } from '$lib/components/BandsChart.svelte';
	import { estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import { paletteColor } from '$lib/chart-palette.js';
	import { flaggedPenModels, toggleFlaggedPenModel } from '$lib/flagged-store.js';

	// Keep in sync with src/routes/reference/+page.svelte (Max Physical Pressure section).
	const maxPressureBands: Band[] = [
		{ min: 100, max: 200, label: 'LIMITED' },
		{ min: 200, max: 350, label: 'OK' },
		{ min: 350, max: 500, label: 'GOOD' },
		{ min: 500, max: 900, label: 'EXCELLENT' },
		{ min: 900, max: null, label: 'EXCESSIVE' },
	];

	let { data } = $props();
	let pen: Pen = $derived(data.pen);
	let compatibleTablets: Tablet[] = $derived(data.compatibleTablets);
	let includedWithTablets: Tablet[] = $derived(data.includedWithTablets);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let pressureSessionCount = $derived(pressureSessions.length);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	let sessionColors = $derived(new Map(pressureSessions.map((s, i) => [s._id, paletteColor(i)])));

	let chartSessions = $derived(
		pressureSessions.map((s) => {
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				id: s._id,
				label: `${s.InventoryId} ${s.Date}`,
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

	let showJson = $state(false);
	let activeTab = $state<'specs' | 'tablets' | 'included' | 'pressure' | 'maxpressure'>('specs');

	// Per-session P100 estimates (max-force) for the Max Pressure tab.
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
</script>

<Nav />

<div class="title-row">
	<h1>{brandName(pen.Brand)} {pen.PenName}</h1>
	<FlagButton
		flagged={$flaggedPenModels.includes(pen.EntityId.toLowerCase())}
		onclick={() => toggleFlaggedPenModel(pen.EntityId)}
		label="Flag this pen model"
	/>
	<button class="json-btn" onclick={() => (showJson = true)}>JSON</button>
</div>

{#if showJson}
	<JsonDialog entity={pen} onclose={() => (showJson = false)} />
{/if}

<section class="basics">
	<dl class="basics-grid">
		<div class="basics-item">
			<dt>Brand</dt>
			<dd><a href="{base}/entity/{pen.Brand.toLowerCase()}">{brandName(pen.Brand)}</a></dd>
		</div>
		<div class="basics-item">
			<dt>Pen ID</dt>
			<dd>{pen.PenId}</dd>
		</div>
		{#if pen.PenYear}
			<div class="basics-item">
				<dt>Year</dt>
				<dd>{pen.PenYear}</dd>
			</div>
		{/if}
		{#if pen.PenFamily}
			<div class="basics-item">
				<dt>Family</dt>
				<dd>{pen.PenFamily}</dd>
			</div>
		{/if}
	</dl>
</section>

<div class="detail-tabs">
	<button class:active={activeTab === 'specs'} onclick={() => (activeTab = 'specs')}>Specs</button>
	<button class:active={activeTab === 'tablets'} onclick={() => (activeTab = 'tablets')}
		>Compatible Tablets</button
	>
	<button class:active={activeTab === 'included'} onclick={() => (activeTab = 'included')}
		>Included With</button
	>
	<button class:active={activeTab === 'pressure'} onclick={() => (activeTab = 'pressure')}
		>Pressure Response</button
	>
	<button class:active={activeTab === 'maxpressure'} onclick={() => (activeTab = 'maxpressure')}
		>Max Pressure</button
	>
</div>

{#if activeTab === 'specs'}
	<div class="tab-content">
		<DetailView item={pen} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} />
	</div>
{/if}

{#if activeTab === 'tablets'}
	<div class="tab-content">
		{#if compatibleTablets.length > 0}
			<table class="compat-table">
				<thead>
					<tr>
						<th>Tablet</th>
						<th>Year</th>
					</tr>
				</thead>
				<tbody>
					{#each compatibleTablets as tablet}
						<tr>
							<td
								><a href="{base}/entity/{encodeURIComponent(tablet.Meta.EntityId)}"
									>{tabletFullName(tablet)}</a
								></td
							>
							<td>{tablet.Model.LaunchYear ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">No tablet compatibility data available for this pen.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'included'}
	<div class="tab-content">
		{#if includedWithTablets.length > 0}
			<ul class="entity-list">
				{#each includedWithTablets as tablet}
					<li>
						<a href="{base}/entity/{encodeURIComponent(tablet.Meta.EntityId)}"
							>{tabletFullName(tablet)}</a
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="no-data">No tablets list this pen as included.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'maxpressure'}
	<div class="tab-content">
		<p class="ref-blurb">
			Maximum physical pressure is the force at which the digitizer saturates (reports its maximum
			pressure value). The red lines show the estimated <strong>P100</strong> (max-force) for each measurement
			session of this pen.
		</p>
		<BandsChart
			bands={maxPressureBands}
			axisMax={1000}
			axisStep={100}
			unit="gf"
			title={`${pen.PenName} max pressure`}
			heading={`${brandName(pen.Brand)} ${pen.PenName} — All max pressures`}
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
				title={`${pen.PenName} max pressure summary`}
				heading={`${brandName(pen.Brand)} ${pen.PenName} — Max pressure range`}
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
				title={`${pen.PenName} pressure response (max)`}
				hiddenIds={hiddenSessionIds}
				lockedZoom="max"
			/>
		{/if}
		{#if p100Values.length === 0}
			<p class="no-data">No pressure response measurements available for this pen model.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'pressure'}
	<div class="tab-content">
		{#if pressureSessionCount > 0}
			<p class="pr-summary">
				{pressureSessionCount} measurement session{pressureSessionCount === 1 ? '' : 's'} for this pen.
			</p>
			<PressureChart
				sessions={chartSessions}
				title={`${pen.PenName} pressure response`}
				hiddenIds={hiddenSessionIds}
			/>
			<PressureResponseChartLegendTable
				sessions={pressureSessions}
				colors={sessionColors}
				hiddenIds={hiddenSessionIds}
				onToggle={toggleSessionVisibility}
				{defectsByInventoryId}
			/>
			<SessionStats
				sessions={pressureSessions}
				title="Aggregated across sessions"
				{defectsByInventoryId}
			/>
		{:else}
			<p class="no-data">No pressure response data available for this pen model.</p>
		{/if}
	</div>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.title-row h1 {
		margin: 0;
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

	.entity-list {
		list-style: none;
		padding: 0;
	}
	.entity-list li {
		padding: 4px 0;
		font-size: 13px;
	}
	.entity-list a {
		color: var(--link);
		text-decoration: none;
	}
	.entity-list a:hover {
		text-decoration: underline;
	}

	.pr-summary {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 12px;
	}

	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.num {
		text-align: right;
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
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
</style>
