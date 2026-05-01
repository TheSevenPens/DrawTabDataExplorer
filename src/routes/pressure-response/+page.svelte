<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		loadPressureResponseFromURL,
		loadPensFromURL,
		brandName,
		type PressureResponse,
		type Pen,
	} from '$data/lib/drawtab-loader.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	const PEN_PRESSURE_DATA_URL = 'https://thesevenpens.github.io/PenPressureData/';

	const penTabs = [
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pressure-response', label: 'Pressure Response' },
	];

	let sessions: PressureResponse[] = $state([]);
	let pens: Pen[] = $state([]);
	let brandFilter = $state('');
	let penFilter = $state('');

	onMount(async () => {
		const [s, p] = await Promise.all([loadPressureResponseFromURL(base), loadPensFromURL(base)]);
		sessions = s;
		pens = p;
	});

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
</div>

<table>
	<thead>
		<tr>
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
			<tr>
				<td>{brandName(s.Brand)}</td>
				<td>
					<a href="{base}/entity/{encodeURIComponent(id)}">
						{penNameById.get(s.PenEntityId) ?? s.PenEntityId}
					</a>
				</td>
				<td class="mono">{s.InventoryId}</td>
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
