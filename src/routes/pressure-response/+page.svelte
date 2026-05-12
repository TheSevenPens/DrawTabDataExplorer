<script lang="ts">
	import { base } from '$app/paths';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';

	const PEN_PRESSURE_DATA_URL = 'https://thesevenpens.github.io/PenPressureData/';

	let { data } = $props();

	let penTabs = $derived([
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pen-flagged', label: 'Flagged', badge: $flaggedPenTotalCount },
		{ href: '/pressure-response', label: 'Pressure Response' },
	]);

	let sessions = $derived(data.sessions);
	let pens = $derived(data.pens);
	let inventoryPens = $derived(data.inventoryPens);
	let brandFilter = $state('');
	let penFilter = $state('');
	let selectedIds = $state(new Set<string>());

	let defectsByInventoryId = $derived(buildInventoryDefects(inventoryPens));

	let penNameById = $derived(
		new Map(
			pens.map((p) => [p.EntityId, p.PenName === p.PenId ? p.PenId : `${p.PenName} (${p.PenId})`]),
		),
	);

	let allBrands = $derived([...new Set(sessions.map((s) => s.Brand))].sort());
	let allPens = $derived(
		[...new Set(sessions.map((s) => s.PenEntityId))]
			.map((id) => ({ id, label: penNameById.get(id) ?? id }))
			.sort((a, b) => a.label.localeCompare(b.label)),
	);

	let filtered = $derived(
		sessions.filter((s) => {
			if (brandFilter && s.Brand !== brandFilter) return false;
			if (penFilter && s.PenEntityId !== penFilter) return false;
			return true;
		}),
	);

	let selectedSessions = $derived(filtered.filter((s) => selectedIds.has(s._id)));

	let chartSessions = $derived(
		selectedSessions.map((s) => {
			const info = defectsByInventoryId.get(s.InventoryId);
			const penLabel = penNameById.get(s.PenEntityId) ?? s.PenEntityId;
			return {
				label: `${penLabel} · ${s.InventoryId} ${s.Date}`,
				records: s.Records,
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);

	function toggleSelected(id: string, on: boolean) {
		const next = new Set(selectedIds);
		if (on) next.add(id);
		else next.delete(id);
		selectedIds = next;
	}

	function selectAllVisible() {
		const next = new Set(selectedIds);
		for (const s of filtered) next.add(s._id);
		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = new Set();
	}
</script>

<Nav />
<SubNav tabs={penTabs} />

<div class="header">
	<h1>Pressure Response</h1>
	<p class="meta">
		{sessions.length} measurement sessions across {allBrands.length} brands and {allPens.length} pens.
		A more featureful viewer lives at
		<a href={PEN_PRESSURE_DATA_URL} target="_blank" rel="noopener">PenPressureData</a> while that project's
		UX is being folded back into the Explorer.
	</p>
</div>

<div class="filters">
	<label>
		Brand:
		<select bind:value={brandFilter}>
			<option value="">All</option>
			{#each allBrands as b}
				<option value={b}>{brandName(b)}</option>
			{/each}
		</select>
	</label>
	<label>
		Pen:
		<select bind:value={penFilter}>
			<option value="">All</option>
			{#each allPens as p (p.id)}
				<option value={p.id}>{p.label}</option>
			{/each}
		</select>
	</label>
	<span class="count">{filtered.length} of {sessions.length}</span>
	<span class="sel-controls">
		<button type="button" onclick={selectAllVisible} disabled={filtered.length === 0}>
			Select all visible
		</button>
		<button type="button" onclick={clearSelection} disabled={selectedIds.size === 0}>
			Clear ({selectedIds.size})
		</button>
	</span>
</div>

{#if selectedSessions.length > 0}
	<section class="overlay">
		<h2>Overlay ({selectedSessions.length} sessions)</h2>
		<PressureChart sessions={chartSessions} title="Selected sessions" />
		<SessionStats
			sessions={selectedSessions}
			title="Aggregated across selected sessions"
			{defectsByInventoryId}
		/>
	</section>
{/if}

<table>
	<thead>
		<tr>
			<th class="check-col"></th>
			<th>Brand</th>
			<th>Pen</th>
			<th>Inventory ID</th>
			<th>Date</th>
			<th>Tablet</th>
			<th>Driver</th>
			<th>OS</th>
			<th>Records</th>
		</tr>
	</thead>
	<tbody>
		{#each filtered as s (s._id)}
			{@const id = sessionEntityId(s)}
			{@const defect = defectsByInventoryId.get(s.InventoryId)}
			<tr class:defective={!!defect}>
				<td class="check-col">
					<input
						type="checkbox"
						checked={selectedIds.has(s._id)}
						onchange={(e) => toggleSelected(s._id, (e.currentTarget as HTMLInputElement).checked)}
						aria-label="Overlay this session on the chart"
					/>
				</td>
				<td>{brandName(s.Brand)}</td>
				<td>
					<a href="{base}/entity/{encodeURIComponent(id)}">
						{penNameById.get(s.PenEntityId) ?? s.PenEntityId}
					</a>
				</td>
				<td class="mono">
					{s.InventoryId}
					{#if defect}
						<span class="defect-badge" title={defect.detailsLabel}>⚠</span>
					{/if}
				</td>
				<td class="mono">{s.Date}</td>
				<td class="mono">{s.TabletEntityId}</td>
				<td class="mono">{s.Driver}</td>
				<td>{s.OS}</td>
				<td class="num">{s.Records.length}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.header {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0 0 8px;
	}
	.meta {
		margin: 0;
		color: var(--text-muted);
		font-size: 13px;
	}
	.filters {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 12px;
		font-size: 13px;
	}
	.filters select {
		margin-left: 6px;
	}
	.count {
		margin-left: auto;
		color: var(--text-muted);
	}
	.sel-controls {
		display: inline-flex;
		gap: 6px;
	}
	.sel-controls button {
		padding: 3px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text);
		border-radius: 4px;
		cursor: pointer;
	}
	.sel-controls button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.sel-controls button:hover:not(:disabled) {
		border-color: #2563eb;
		color: #2563eb;
	}
	.overlay {
		margin-bottom: 24px;
	}
	.overlay h2 {
		font-size: 16px;
		margin: 0 0 8px;
	}
	.check-col {
		width: 28px;
	}
	tbody tr.defective {
		color: var(--text-muted);
	}
	.defect-badge {
		display: inline-block;
		margin-left: 4px;
		color: #d97706;
		font-weight: 700;
		cursor: help;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	thead th {
		text-align: left;
		padding: 6px 10px;
		border-bottom: 2px solid var(--border);
		background: var(--bg-card);
		position: sticky;
		top: 0;
	}
	tbody td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	tbody tr:hover {
		background: var(--bg-card);
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.num {
		text-align: right;
	}
</style>
