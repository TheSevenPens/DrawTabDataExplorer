<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	// Pen analog of /tablet-compare. Two tabs:
	//   Flagged — list of flagged pen models with add/remove affordances
	//   Compare — grouped spec-comparison table (mirrors the tablets one)
	//
	// Reuses the existing flaggedPenModels store, which is also populated by
	// the ⚐ button on pen detail pages. Unlike tablets there is NO cap on
	// flagged pens, because the same store also feeds the /pen-flagged
	// pressure-overlay chart which benefits from many flags.
	import { resolve } from '$app/paths';
	import { type Pen, type PressureResponse, type PressureRange } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import { penIdRedundantInName } from '$data/lib/entities/pen-fields.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue } from '$data/lib/units.js';
	import {
		flaggedPenModels,
		flaggedPenUnits,
		flaggedPenFamilies,
		flaggedPenTotalCount,
		flaggedPenModelCount,
		toggleFlaggedPenModel,
		clearFlaggedPenModels,
	} from '$lib/flagged-store.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import PenPicker from '$lib/components/PenPicker.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import PressureRangeTab from '$lib/components/PressureRangeTab.svelte';
	import BandsChart, { type BandMarker } from '$lib/components/BandsChart.svelte';
	import { PMAX_BANDS } from '$lib/bands.js';
	import { estimatePmax, fmtP } from '$data/lib/pressure/interpolate.js';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import { paletteColor } from '$lib/chart-palette.js';
	import { penFullName, penBrandAndName } from '$lib/pen-helpers.js';
	import { stripUnit, valueSuffix } from '$lib/field-display.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import {
		buildSessionColors,
		buildSessionColorsBy,
		buildChartSessions,
		type ColorBy,
	} from '$lib/pressure/chart-session-state.js';

	let { data } = $props();

	let penTabs = $derived(
		penSubNavTabs({
			flaggedPenCount: $flaggedPenTotalCount,
			flaggedPenModelCount: $flaggedPenModelCount,
		}),
	);

	let activeTab: 'flagged' | 'compare' | 'pressure' | 'iaf' | 'max' = $state('flagged');
	let showPicker = $state(false);
	let allPens: Pen[] = $derived(data.allPens ?? []);
	let allSessions: PressureResponse[] = $derived(data.allSessions ?? []);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);
	let iafMeasurements: PressureRange[] = $derived(data.iafMeasurements ?? []);
	let maxMeasurements: PressureRange[] = $derived(data.maxMeasurements ?? []);

	// flaggedPenModels stores lowercase EntityIds; match the same casing when
	// looking up the full pen record.
	let flaggedItems = $derived(
		$flaggedPenModels
			.map((id) => allPens.find((p) => p.EntityId.toLowerCase() === id))
			.filter((p): p is Pen => !!p),
	);

	// Group all pressure sessions by PenEntityId once so per-pen lookups in
	// the Pmax tab are O(1) and don't re-scan the full session list
	// for each flagged pen.
	let sessionsByPenEntityId = $derived.by(() => {
		const out = new Map<string, PressureResponse[]>();
		for (const s of allSessions) {
			const arr = out.get(s.PenEntityId);
			if (arr) arr.push(s);
			else out.set(s.PenEntityId, [s]);
		}
		return out;
	});

	// Per-pen bundles shared by the Piaf and Pmax tabs. Each pen gets
	// its own color set + chart sessions so colors are stable within a section
	// but independent across sections. `penColor` is shared with the combined
	// view at the top of the Pmax tab so a pen's marker color in the
	// merged BandsChart matches its session curves in the merged PressureChart.
	let perPenSections = $derived(
		flaggedItems.map((p, i) => {
			const sessions = sessionsByPenEntityId.get(p.EntityId) ?? [];
			const colors = buildSessionColors(sessions);
			const chartSessions = buildChartSessions(sessions, { colors, defectsByInventoryId });
			const iaf = iafMeasurements.filter((m) => m.PenEntityId === p.EntityId);
			const max = maxMeasurements.filter((m) => m.PenEntityId === p.EntityId);
			return { pen: p, sessions, chartSessions, penColor: paletteColor(i), iaf, max };
		}),
	);

	// Combined pool across every flagged pen — feeds the "all flagged pens as a
	// group" analysis at the top of the IAF / MAX tabs. PressureRangeTab
	// resolves per unit across all the models, and the per-pen labels let its
	// by-unit / by-sample tables show which pen each unit belongs to.
	let combinedSessions = $derived(perPenSections.flatMap((s) => s.sessions));
	let combinedIaf = $derived(perPenSections.flatMap((s) => s.iaf));
	let flaggedPenNameById = $derived(
		new Map(flaggedItems.map((p) => [p.EntityId, penBrandAndName(p)])),
	);

	// --- Combined Pmax comparison ---
	//
	// Aggregates every flagged pen's non-defective sessions onto one
	// BandsChart (Pmax markers colored per pen) plus one zoomed
	// PressureChart (curves recolored per pen, so a pen's sessions cluster
	// visually even when its individual sessions are still distinct lines).
	let nonDefectiveByPen = $derived(
		perPenSections.map((s) => ({
			...s,
			nonDefectiveSessions: s.sessions.filter(
				(sess) => !defectsByInventoryId.has(sess.InventoryId),
			),
		})),
	);

	// Per-pen Pmax lists — computed once and reused by both the "all" and
	// "summary" combined-view markers as well as the summary table below.
	let pmaxByPen = $derived(
		nonDefectiveByPen.map((s) => ({
			...s,
			pmaxValues: s.nonDefectiveSessions
				.map((sess) => estimatePmax(sess.Records))
				.filter((v): v is number => v !== null && isFinite(v))
				.sort((a, b) => a - b),
		})),
	);

	// "All" view: one marker per session per pen, colored by pen.
	let combinedMaxMarkersAll: BandMarker[] = $derived.by(() => {
		const out: BandMarker[] = [];
		for (const s of pmaxByPen) {
			for (const v of s.pmaxValues) {
				out.push({ value: v, color: s.penColor, dashed: false });
			}
		}
		return out;
	});

	// "Summary" view: three markers per pen (min / median / max) in the
	// pen's color, median thicker — mirrors the per-pen MAX tab's
	// summary style but with pen-color discrimination. Labels are
	// suppressed: with multiple pens, repeating "Median" would clutter the
	// chart, and the colored legend below already conveys pen identity.
	//
	// Note: BandMarker.seriesIndex would let us bound each marker to its
	// pen's horizontal stripe (matching `combinedShadedRanges`). It was
	// tried and rolled back here — full-height markers read better as
	// "Pmax estimates on a shared axis," which is the point of the chart.
	// The slicing capability is left intact in BandsChart for future use.
	let combinedMaxMarkersSummary: BandMarker[] = $derived.by(() => {
		const out: BandMarker[] = [];
		for (const s of pmaxByPen) {
			const xs = s.pmaxValues;
			if (xs.length === 0) continue;
			const min = xs[0];
			const max = xs[xs.length - 1];
			const mid = Math.floor(xs.length / 2);
			const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
			out.push({ value: min, color: s.penColor, dashed: false });
			out.push({ value: max, color: s.penColor, dashed: false });
			out.push({ value: median, color: s.penColor, dashed: false, strokeWidth: 4 });
		}
		return out;
	});

	type CombinedView = 'all' | 'summary';
	let combinedView = $state<CombinedView>('all');

	let combinedMaxMarkers: BandMarker[] = $derived(
		combinedView === 'all' ? combinedMaxMarkersAll : combinedMaxMarkersSummary,
	);

	// In summary view, draw a horizontal stripe per pen spanning that pen's
	// min..max Pmax. Pens with a single session collapse to min === max and
	// are omitted (no band to draw).
	let combinedShadedRanges = $derived(
		combinedView === 'summary'
			? pmaxByPen
					.filter((s) => s.pmaxValues.length > 0)
					.map((s) => ({
						min: s.pmaxValues[0],
						max: s.pmaxValues[s.pmaxValues.length - 1],
						color: s.penColor,
					}))
			: undefined,
	);

	// All flagged-pen sessions on one zoomed chart, recolored by pen so the
	// eye can pick out one pen's family of curves at a glance. Defective
	// sessions inherit the same `defective` flag they already had — the
	// chart's "Show N defective" toggle still applies.
	let combinedChartSessions = $derived(
		perPenSections.flatMap((s) => s.chartSessions.map((cs) => ({ ...cs, color: s.penColor }))),
	);

	// Per-pen Pmax stats for the small summary table under the combined chart.
	let combinedSummary = $derived(
		pmaxByPen.map((s) => {
			const xs = s.pmaxValues;
			if (xs.length === 0) return { ...s, count: 0, min: null, median: null, max: null };
			const mid = Math.floor(xs.length / 2);
			const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
			return { ...s, count: xs.length, min: xs[0], median, max: xs[xs.length - 1] };
		}),
	);

	let combinedSessionCount = $derived(combinedMaxMarkersAll.length);
	let combinedPenWithDataCount = $derived(pmaxByPen.filter((s) => s.pmaxValues.length > 0).length);
	let anyCombinedData = $derived(combinedSessionCount > 0);

	// The combined PressureChart takes a `hiddenIds` set; we don't expose
	// toggle UI here, so it stays empty. Shared reference avoids unnecessary
	// re-renders from new empty-set identities.
	const EMPTY_HIDDEN: ReadonlySet<string> = new Set();

	// --- Pressure Response tab: cross-scope overlay ---
	//
	// Aggregates sessions matching ANY of the three pen flag scopes
	// (unit / model / family). This mirrors the behavior previously hosted
	// on /pen-flagged so users who flag from inventory or family pages
	// still see those sessions overlaid here. (The Compare and Pmax
	// tabs only consider flagged pen models, since spec / per-pen-pmax
	// only make sense at the model level.)
	let matchedSessions = $derived.by(() => {
		const flaggedFamilyPenIds = new Set(
			allPens
				.filter((p) => $flaggedPenFamilies.includes(p.PenFamily.toLowerCase()))
				.map((p) => p.EntityId.toLowerCase()),
		);
		return allSessions.filter((s) => {
			const inv = s.InventoryId.toLowerCase();
			const model = s.PenEntityId.toLowerCase();
			if ($flaggedPenUnits.includes(inv)) return true;
			if ($flaggedPenModels.includes(model)) return true;
			if (flaggedFamilyPenIds.has(model)) return true;
			return false;
		});
	});

	let overlayColorBy = $state<ColorBy>('session');
	let overlayColors = $derived(buildSessionColorsBy(matchedSessions, overlayColorBy));

	let penNameById = $derived(
		new Map(
			allPens.map((p) => [
				p.EntityId,
				penIdRedundantInName(p) ? p.PenName : `${p.PenName} (${p.PenId})`,
			]),
		),
	);

	let overlayChartSessions = $derived(
		matchedSessions.map((s) => {
			const penLabel = penNameById.get(s.PenEntityId) ?? s.PenEntityId;
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				id: s._id,
				label: `${penLabel} · ${s.InventoryId} ${s.Date}`,
				records: s.Records,
				color: overlayColors.get(s._id),
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);

	let overlayHiddenIds = $state(new Set<string>());

	function toggleOverlaySessionVisibility(id: string) {
		const next = new Set(overlayHiddenIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		overlayHiddenIds = next;
	}

	// Brief one-line summary of *what* is currently flagged across all three
	// scopes — gives context to the overlay since flags came from other pages
	// (inventory / family / model pages) and this tab is read-only.
	let flagSummary = $derived.by(() => {
		const parts: string[] = [];
		if ($flaggedPenModels.length > 0)
			parts.push(`${$flaggedPenModels.length} model${$flaggedPenModels.length === 1 ? '' : 's'}`);
		if ($flaggedPenFamilies.length > 0)
			parts.push(
				`${$flaggedPenFamilies.length} famil${$flaggedPenFamilies.length === 1 ? 'y' : 'ies'}`,
			);
		if ($flaggedPenUnits.length > 0)
			parts.push(`${$flaggedPenUnits.length} unit${$flaggedPenUnits.length === 1 ? '' : 's'}`);
		return parts.join(' · ');
	});

	function getDisplayVal(f: (typeof PEN_FIELDS)[0], pen: Pen): string {
		const val = f.getValue(pen);
		if (val === undefined || val === null || val === '' || val === '-') return '';
		const converted = formatValue(val, f.unit, $unitPreference);
		return converted + valueSuffix(f.label, f.unit, $unitPreference);
	}

	// Grouped, dense comparison rows. `key` (the unique FieldDef key) is the
	// stable each-block key — keying on `label` would crash via
	// each_key_duplicate the moment two fields strip to the same label.
	let comparisonGroups = $derived.by(() => {
		if (flaggedItems.length === 0) return [];
		const groups: {
			group: string;
			fields: { key: string; label: string; values: string[]; differs: boolean }[];
		}[] = [];
		for (const groupName of PEN_FIELD_GROUPS) {
			const groupFields = PEN_FIELDS.filter((f) => f.group === groupName);
			const rows: { key: string; label: string; values: string[]; differs: boolean }[] = [];
			for (const f of groupFields) {
				const values = flaggedItems.map((p) => getDisplayVal(f, p));
				if (values.every((v) => v === '')) continue;
				const unique = new Set(values.filter((v) => v !== ''));
				rows.push({
					key: f.key,
					label: stripUnit(f.label, f.unit),
					values,
					differs: unique.size > 1,
				});
			}
			if (rows.length > 0) groups.push({ group: groupName, fields: rows });
		}
		return groups;
	});

	let copyFlaggedStatus = $state('');
	function copyFlaggedList() {
		const text = flaggedItems.map((p) => penFullName(p)).join('\n');
		navigator.clipboard
			.writeText(text)
			.then(() => {
				copyFlaggedStatus = 'Copied!';
				setTimeout(() => (copyFlaggedStatus = ''), 2000);
			})
			.catch(() => {
				copyFlaggedStatus = 'Failed';
				setTimeout(() => (copyFlaggedStatus = ''), 2000);
			});
	}

	// Export rows mirror tablet-compare: group headers are emitted as a
	// single non-blank cell in column 0 so they survive as readable rows when
	// the export is opened in a spreadsheet.
	let showExport = $state(false);
	let compareExportHeaders: string[] = $derived.by(() => {
		const cols = flaggedItems.map((p) => penBrandAndName(p));
		return ['Field', ...cols];
	});
	let compareExportRows: (string | number)[][] = $derived.by(() => {
		const blanks = flaggedItems.map(() => '');
		const out: (string | number)[][] = [];
		for (const group of comparisonGroups) {
			out.push([group.group, ...blanks]);
			for (const f of group.fields) {
				out.push([f.label, ...f.values]);
			}
		}
		return out;
	});
</script>

<Nav />
<SubNav tabs={penTabs} />
<h1>Compare Pens</h1>

<Tabs
	tabs={[
		{ id: 'flagged', label: 'Flagged', badge: $flaggedPenModels.length },
		{ id: 'compare', label: 'Compare' },
		{ id: 'pressure', label: 'Pressure Response', badge: matchedSessions.length },
		{ id: 'iaf', label: 'IAF' },
		{ id: 'max', label: 'MAX' },
	] satisfies Tab[]}
	bind:active={activeTab}
/>

{#if activeTab === 'flagged'}
	<div class="flagged-actions">
		<button class="add-pen-btn" onclick={() => (showPicker = true)}>+ Add pen</button>
		{#if flaggedItems.length > 0}
			<button class="copy-btn" onclick={copyFlaggedList}>{copyFlaggedStatus || 'Copy list'}</button>
			<button class="clear-btn" onclick={clearFlaggedPenModels}>Clear all</button>
		{/if}
	</div>
	{#if flaggedItems.length > 0}
		<ul class="flagged-list">
			{#each flaggedItems as p (p.EntityId)}
				<li>
					<button
						class="unflag-btn"
						onclick={() => toggleFlaggedPenModel(p.EntityId)}
						title="Unflag">&#x2691;</button
					>
					<a href={resolve('/entity/[entityId]', { entityId: p.EntityId })}>{penFullName(p)}</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="no-data">
			No pens added yet. Use the button above, or flag pens from the <a href={resolve('/pens')}
				>pens list</a
			> or individual pen pages.
		</p>
	{/if}
{:else if activeTab === 'compare'}
	{#if flaggedItems.length < 2}
		<p class="no-data">
			Flag at least 2 pens to compare. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		<div class="compare-toolbar">
			<button
				class="copy-btn"
				onclick={() => (showExport = true)}
				disabled={compareExportRows.length === 0}>Export</button
			>
		</div>
		<div class="compare-wrap">
			<table id="compare-table" class="compare-table">
				<thead>
					<tr>
						<th class="spec-col">Spec</th>
						{#each flaggedItems as p (p.EntityId)}
							<th
								><a href={resolve('/entity/[entityId]', { entityId: p.EntityId })}
									>{penBrandAndName(p)}</a
								></th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each comparisonGroups as group (group.group)}
						<tr class="group-row">
							<td class="group-header" colspan={flaggedItems.length + 1}>{group.group}</td>
						</tr>
						{#each group.fields as row (row.key)}
							<tr>
								<td class="spec-label">{row.label}</td>
								{#each row.values as val, i (i)}
									<td class:differs={row.differs && val !== ''}>{val || '-'}</td>
								{/each}
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{:else if activeTab === 'pressure'}
	{#if $flaggedPenTotalCount === 0}
		<p class="no-data">
			Nothing flagged. Flag a pen model from the <a href={resolve('/pens')}>pens list</a>, a pen
			family, or a pen unit to see its sessions overlaid here.
		</p>
	{:else if matchedSessions.length === 0}
		<p class="no-data">
			Flagged: {flagSummary}. No pressure-response sessions match the current flags.
		</p>
	{:else}
		<div class="overlay-toolbar">
			<p class="overlay-summary">
				{matchedSessions.length} session{matchedSessions.length === 1 ? '' : 's'} from {flagSummary}.
			</p>
			<label class="color-by-label">
				Color by
				<select bind:value={overlayColorBy}>
					<option value="session">Session</option>
					<option value="unit">Pen unit</option>
					<option value="model">Pen model</option>
					<option value="tablet">Tablet</option>
				</select>
			</label>
		</div>
		<PressureChart
			sessions={overlayChartSessions}
			title="Flagged pens"
			hiddenIds={overlayHiddenIds}
		/>
		<PressureResponseChartLegendTable
			sessions={matchedSessions}
			colors={overlayColors}
			hiddenIds={overlayHiddenIds}
			onToggle={toggleOverlaySessionVisibility}
			{penNameById}
			{defectsByInventoryId}
			showBrand
			showModel
		/>
		<SessionStats
			sessions={matchedSessions}
			title="Aggregated across flagged sessions"
			{defectsByInventoryId}
		/>
	{/if}
{:else if activeTab === 'iaf'}
	{#if flaggedItems.length === 0}
		<p class="no-data">
			Flag at least one pen to see its Piaf chart. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		<section class="group-section">
			<h2 class="group-heading">All flagged pens — combined</h2>
			<PressureRangeTab
				metric="IAF"
				pressureSessions={combinedSessions}
				{defectsByInventoryId}
				displayName="All flagged pens"
				chartTitlePrefix="Flagged pens"
				entityLabel="any flagged pen"
				measurements={combinedIaf}
				penNameById={flaggedPenNameById}
				tabletNameById={data.tabletNameById ?? new Map()}
			/>
		</section>
		<h3 class="group-divider">By pen</h3>
		{#each perPenSections as section (section.pen.EntityId)}
			<section class="per-pen-section">
				<h2 class="per-pen-heading">
					<a href={resolve('/entity/[entityId]', { entityId: section.pen.EntityId })}
						>{penBrandAndName(section.pen)}</a
					>
				</h2>
				{#if section.sessions.length === 0 && section.iaf.length === 0}
					<EmptyState>No IAF data for this pen model.</EmptyState>
				{:else}
					<PressureRangeTab
						metric="IAF"
						pressureSessions={section.sessions}
						{defectsByInventoryId}
						displayName={penFullName(section.pen)}
						chartTitlePrefix={section.pen.PenName}
						entityLabel="this pen model"
						measurements={section.iaf}
						penNameById={new Map([[section.pen.EntityId, penBrandAndName(section.pen)]])}
						tabletNameById={data.tabletNameById ?? new Map()}
					/>
				{/if}
			</section>
		{/each}
	{/if}
{:else if activeTab === 'max'}
	{#if flaggedItems.length === 0}
		<p class="no-data">
			Flag at least one pen to see its Pmax chart. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		{#if anyCombinedData}
			<section class="per-pen-section combined-section">
				<h2 class="per-pen-heading">Combined comparison</h2>
				<ul class="pen-legend" aria-label="Pen color legend">
					{#each perPenSections as s (s.pen.EntityId)}
						<li>
							<span class="pen-swatch" style:background={s.penColor} aria-hidden="true"></span>
							<a href={resolve('/entity/[entityId]', { entityId: s.pen.EntityId })}
								>{penBrandAndName(s.pen)}</a
							>
						</li>
					{/each}
				</ul>
				<div class="view-toggle" role="group" aria-label="View">
					<button
						type="button"
						class:active={combinedView === 'all'}
						onclick={() => (combinedView = 'all')}
						aria-pressed={combinedView === 'all'}>All sessions ({combinedSessionCount})</button
					>
					<button
						type="button"
						class:active={combinedView === 'summary'}
						onclick={() => (combinedView = 'summary')}
						aria-pressed={combinedView === 'summary'}>Summary (min / median / max)</button
					>
				</div>
				<p class="ref-blurb view-blurb">
					{#if combinedView === 'all'}
						One line per session, colored by pen.
					{:else}
						Three lines per pen — outer two mark <strong>min</strong> and <strong>max</strong>; the
						thick middle line marks the <strong>median</strong>. {combinedPenWithDataCount} pen{combinedPenWithDataCount ===
						1
							? ''
							: 's'} with data.
					{/if}
				</p>
				<BandsChart
					bands={PMAX_BANDS}
					axisMax={1000}
					axisStep={100}
					unit="gf"
					heading="Pmax across flagged pens"
					markers={combinedMaxMarkers}
					shadedRanges={combinedShadedRanges}
				/>
				<table class="pen-summary-table">
					<thead>
						<tr>
							<th>Pen</th>
							<th class="num">Sessions</th>
							<th class="num">Min <span class="unit">(gf)</span></th>
							<th class="num">Median <span class="unit">(gf)</span></th>
							<th class="num">Max <span class="unit">(gf)</span></th>
						</tr>
					</thead>
					<tbody>
						{#each combinedSummary as s (s.pen.EntityId)}
							<tr>
								<td>
									<span class="pen-swatch" style:background={s.penColor} aria-hidden="true"
									></span>{penBrandAndName(s.pen)}
								</td>
								<td class="num mono">{s.count}</td>
								<td class="num mono">{s.min !== null ? fmtP(s.min) : '—'}</td>
								<td class="num mono">{s.median !== null ? fmtP(s.median) : '—'}</td>
								<td class="num mono">{s.max !== null ? fmtP(s.max) : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="ref-blurb">
					Per-session pressure-response curves near saturation, with each pen's sessions sharing one
					color — clusters of like-colored curves let you compare pens against each other on the
					same axis.
				</p>
				<PressureChart
					sessions={combinedChartSessions}
					title="Flagged pens — max pressure"
					hiddenIds={EMPTY_HIDDEN}
					lockedZoom="pmax"
				/>
			</section>
		{/if}

		{#each perPenSections as section (section.pen.EntityId)}
			<section class="per-pen-section">
				<h2 class="per-pen-heading">
					<span class="pen-swatch" style:background={section.penColor} aria-hidden="true"></span>
					<a href={resolve('/entity/[entityId]', { entityId: section.pen.EntityId })}
						>{penBrandAndName(section.pen)}</a
					>
				</h2>
				{#if section.sessions.length === 0 && section.max.length === 0}
					<EmptyState>No MAX data for this pen model.</EmptyState>
				{:else}
					<PressureRangeTab
						metric="MAX"
						pressureSessions={section.sessions}
						{defectsByInventoryId}
						displayName={penFullName(section.pen)}
						chartTitlePrefix={section.pen.PenName}
						entityLabel="this pen model"
						measurements={section.max}
						penNameById={new Map([[section.pen.EntityId, penBrandAndName(section.pen)]])}
						tabletNameById={data.tabletNameById ?? new Map()}
					/>
				{/if}
			</section>
		{/each}
	{/if}
{/if}

{#if showPicker && allPens.length > 0}
	<PenPicker {allPens} flaggedIds={$flaggedPenModels} onclose={() => (showPicker = false)} />
{/if}

{#if showExport}
	<ExportDialog
		entityType="pen-comparison"
		title="Export Pen Comparison"
		filename="pen-comparison"
		headers={compareExportHeaders}
		rows={compareExportRows}
		onclose={() => (showExport = false)}
	/>
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}

	.flagged-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.add-pen-btn {
		padding: 5px 14px;
		font-size: 13px;
		font-weight: 600;
		border: 1px solid #2563eb;
		border-radius: 4px;
		background: #2563eb;
		color: #fff;
		cursor: pointer;
	}

	.add-pen-btn:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	.clear-btn {
		padding: 4px 12px;
		font-size: 13px;
		border: 1px solid #dc2626;
		border-radius: 4px;
		background: var(--bg-card);
		color: #dc2626;
		cursor: pointer;
	}

	.clear-btn:hover:not(:disabled) {
		background: #dc2626;
		color: #fff;
	}

	.flagged-list {
		list-style: none;
		padding: 0;
	}

	.flagged-list li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		font-size: 13px;
	}

	.flagged-list a {
		color: var(--link);
		text-decoration: none;
	}

	.flagged-list a:hover {
		text-decoration: underline;
	}

	.unflag-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #d97706;
		padding: 0;
		line-height: 1;
	}

	.unflag-btn:hover {
		color: #b45309;
	}

	.compare-toolbar {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.copy-btn {
		padding: 4px 12px;
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

	.compare-wrap {
		overflow-x: auto;
	}

	.compare-table {
		border-collapse: collapse;
		font-size: 13px;
		min-width: 100%;
	}

	.compare-table th,
	.compare-table td {
		padding: 4px 10px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.compare-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
		position: sticky;
		top: 0;
	}

	.compare-table th a {
		color: var(--link);
		text-decoration: none;
	}

	.compare-table th a:hover {
		text-decoration: underline;
	}

	.spec-col {
		min-width: 150px;
	}

	.spec-label {
		font-weight: 600;
		color: var(--text-muted);
	}

	.group-header {
		font-weight: 700;
		background: var(--th-bg);
		color: #6b21a8;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.group-row td {
		border-bottom: 2px solid var(--border);
	}

	.differs {
		background: #fef3c7;
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}

	.no-data a {
		color: var(--link);
	}

	.overlay-toolbar {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0 0 12px;
		flex-wrap: wrap;
	}

	.overlay-summary {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}

	.color-by-label {
		font-size: 12px;
		color: var(--text-muted);
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.color-by-label select {
		font-size: 12px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	.group-section {
		margin-bottom: 32px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--border);
	}
	.group-heading {
		font-size: 16px;
		font-weight: 600;
		color: #6b21a8;
		margin: 0 0 12px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}
	.group-divider {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		margin: 0 0 16px;
	}

	.per-pen-section {
		margin-bottom: 32px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--border);
	}

	.per-pen-section:last-child {
		border-bottom: none;
	}

	.per-pen-heading {
		font-size: 16px;
		font-weight: 600;
		color: #6b21a8;
		margin: 0 0 12px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}

	.per-pen-heading a {
		color: inherit;
		text-decoration: none;
	}

	.per-pen-heading a:hover {
		text-decoration: underline;
	}

	.combined-section {
		border-bottom: 2px solid var(--border);
	}

	.pen-legend {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		font-size: 13px;
	}

	.pen-legend li {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pen-legend a {
		color: var(--link);
		text-decoration: none;
	}

	.pen-legend a:hover {
		text-decoration: underline;
	}

	.pen-swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.per-pen-heading .pen-swatch {
		margin-right: 8px;
		vertical-align: middle;
	}

	.pen-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 12px 0 16px;
		width: fit-content;
	}

	.pen-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}

	.pen-summary-table th.num {
		text-align: right;
	}

	.pen-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}

	.pen-summary-table td {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}

	.pen-summary-table td.num {
		text-align: right;
	}

	.pen-summary-table tr:last-child td {
		border-bottom: none;
	}

	.pen-summary-table .pen-swatch {
		margin-right: 8px;
		vertical-align: middle;
	}

	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}

	.num {
		text-align: right;
	}

	.ref-blurb {
		font-size: 13px;
		color: var(--text-muted);
		max-width: 800px;
		margin: 12px 0;
	}

	.view-blurb {
		margin: 4px 0 8px;
	}

	.view-toggle {
		display: inline-flex;
		gap: 0;
		margin: 0 0 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.view-toggle button {
		appearance: none;
		border: none;
		background: var(--bg-card);
		color: var(--text-muted);
		padding: 5px 12px;
		font-size: 12px;
		cursor: pointer;
		border-right: 1px solid var(--border);
	}

	.view-toggle button:last-child {
		border-right: none;
	}

	.view-toggle button:hover {
		color: var(--text);
	}

	.view-toggle button.active {
		background: var(--bg);
		color: #6b21a8;
		font-weight: 600;
	}
</style>
