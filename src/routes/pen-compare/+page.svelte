<script lang="ts">
	// Pen analog of /tablet-compare. Two tabs:
	//   Flagged — list of flagged pen models with add/remove affordances
	//   Compare — grouped spec-comparison table (mirrors the tablets one)
	//
	// Reuses the existing flaggedPenModels store, which is also populated by
	// the ⚐ button on pen detail pages. Unlike tablets there is NO cap on
	// flagged pens, because the same store also feeds the /pen-flagged
	// pressure-overlay chart which benefits from many flags.
	import { resolve } from '$app/paths';
	import { type Pen, type PressureResponse } from '$data/lib/drawtab-loader.js';
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
	import PenPicker from '$lib/components/PenPicker.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import MaxPressureTab from '$lib/components/MaxPressureTab.svelte';
	import IafTab from '$lib/components/IafTab.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import { paletteColor } from '$lib/chart-palette.js';
	import { penFullName, penBrandAndName } from '$lib/pen-helpers.js';
	import { stripUnit, valueSuffix } from '$lib/field-display.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import { buildSessionColors, buildChartSessions } from '$lib/pressure/chart-session-state.js';

	let { data } = $props();

	let penTabs = $derived(
		penSubNavTabs({
			flaggedPenCount: $flaggedPenTotalCount,
			flaggedPenModelCount: $flaggedPenModelCount,
		}),
	);

	let activeTab: 'flagged' | 'compare' | 'pressure' | 'iaf' | 'maxpressure' = $state('flagged');
	let showPicker = $state(false);
	let allPens: Pen[] = $derived(data.allPens ?? []);
	let allSessions: PressureResponse[] = $derived(data.allSessions ?? []);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	// flaggedPenModels stores lowercase EntityIds; match the same casing when
	// looking up the full pen record.
	let flaggedItems = $derived(
		$flaggedPenModels
			.map((id) => allPens.find((p) => p.EntityId.toLowerCase() === id))
			.filter((p): p is Pen => !!p),
	);

	// Group all pressure sessions by PenEntityId once so per-pen lookups in
	// the Max Pressure tab are O(1) and don't re-scan the full session list
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

	// Per-pen bundles shared by the IAF and Max Pressure tabs. Each pen gets
	// its own color set + chart sessions so colors are stable within a section
	// but independent across sections.
	let perPenSections = $derived(
		flaggedItems.map((p) => {
			const sessions = sessionsByPenEntityId.get(p.EntityId) ?? [];
			const colors = buildSessionColors(sessions);
			const chartSessions = buildChartSessions(sessions, { colors, defectsByInventoryId });
			return { pen: p, sessions, chartSessions };
		}),
	);

	// The embedded MaxPressureTab takes a `hiddenIds` set; we don't expose
	// toggle UI here, so it stays empty. Shared reference avoids unnecessary
	// re-renders from new empty-set identities.
	const EMPTY_HIDDEN: ReadonlySet<string> = new Set();

	// --- Pressure Response tab: cross-scope overlay ---
	//
	// Aggregates sessions matching ANY of the three pen flag scopes
	// (unit / model / family). This mirrors the behavior previously hosted
	// on /pen-flagged so users who flag from inventory or family pages
	// still see those sessions overlaid here. (The Compare and Max Pressure
	// tabs only consider flagged pen models, since spec / per-pen-max-pressure
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

	let overlayColors = $derived(
		new Map(matchedSessions.map((s, i) => [s._id, paletteColor(i)])),
	);

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

<div class="tabs">
	<button class:active={activeTab === 'flagged'} onclick={() => (activeTab = 'flagged')}>
		Flagged ({$flaggedPenModels.length})
	</button>
	<button class:active={activeTab === 'compare'} onclick={() => (activeTab = 'compare')}>
		Compare
	</button>
	<button class:active={activeTab === 'pressure'} onclick={() => (activeTab = 'pressure')}>
		Pressure Response ({matchedSessions.length})
	</button>
	<button class:active={activeTab === 'iaf'} onclick={() => (activeTab = 'iaf')}> IAF </button>
	<button
		class:active={activeTab === 'maxpressure'}
		onclick={() => (activeTab = 'maxpressure')}
	>
		Max Pressure
	</button>
</div>

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
		<p class="overlay-summary">
			{matchedSessions.length} session{matchedSessions.length === 1 ? '' : 's'} from {flagSummary}.
		</p>
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
			Flag at least one pen to see its IAF chart. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		{#each perPenSections as section (section.pen.EntityId)}
			<section class="per-pen-section">
				<h2 class="per-pen-heading">
					<a href={resolve('/entity/[entityId]', { entityId: section.pen.EntityId })}
						>{penBrandAndName(section.pen)}</a
					>
				</h2>
				{#if section.sessions.length === 0}
					<p class="no-data">No pressure response measurements for this pen model.</p>
				{:else}
					<IafTab
						pressureSessions={section.sessions}
						{defectsByInventoryId}
						chartSessions={section.chartSessions}
						hiddenIds={EMPTY_HIDDEN}
						displayName={penBrandAndName(section.pen)}
						chartTitlePrefix={section.pen.PenName}
						entityLabel="this pen model"
					/>
				{/if}
			</section>
		{/each}
	{/if}
{:else if activeTab === 'maxpressure'}
	{#if flaggedItems.length === 0}
		<p class="no-data">
			Flag at least one pen to see its Max Pressure chart. Currently {flaggedItems.length} flagged.
		</p>
	{:else}
		{#each perPenSections as section (section.pen.EntityId)}
			<section class="per-pen-section">
				<h2 class="per-pen-heading">
					<a href={resolve('/entity/[entityId]', { entityId: section.pen.EntityId })}
						>{penBrandAndName(section.pen)}</a
					>
				</h2>
				{#if section.sessions.length === 0}
					<p class="no-data">No pressure response measurements for this pen model.</p>
				{:else}
					<MaxPressureTab
						pressureSessions={section.sessions}
						{defectsByInventoryId}
						chartSessions={section.chartSessions}
						hiddenIds={EMPTY_HIDDEN}
						displayName={penBrandAndName(section.pen)}
						chartTitlePrefix={section.pen.PenName}
						entityLabel="this pen model"
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

	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 18px;
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

	.tabs button:hover {
		color: #2563eb;
		background: var(--hover-bg);
	}

	.tabs button.active {
		background: var(--bg-card);
		color: var(--text);
		font-weight: 600;
		border-color: var(--border);
		border-bottom-color: var(--bg-card);
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

	.overlay-summary {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 12px;
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
</style>
