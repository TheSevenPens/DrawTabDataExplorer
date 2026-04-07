<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPressureResponseFromURL, type PressureResponse } from '$data/lib/drawtab-loader.js';

	let penEntityId = $state('');
	let sessions: PressureResponse[] = $state([]);

	interface InventorySummary {
		inventoryId: string;
		sessions: PressureResponse[];
	}

	let inventorySummaries: InventorySummary[] = $state([]);

	onMount(async () => {
		penEntityId = decodeURIComponent(page.params.penEntityId!);
		const all = await loadPressureResponseFromURL(base);
		sessions = all.filter(s => s.PenEntityId === penEntityId);

		const invMap = new Map<string, PressureResponse[]>();
		for (const s of sessions) {
			const list = invMap.get(s.InventoryId);
			if (list) { list.push(s); } else { invMap.set(s.InventoryId, [s]); }
		}

		inventorySummaries = [...invMap.entries()]
			.map(([inventoryId, sess]) => ({ inventoryId, sessions: sess.sort((a, b) => a.Date.localeCompare(b.Date)) }))
			.sort((a, b) => a.inventoryId.localeCompare(b.inventoryId));
	});
</script>

<p class="back"><a href="{base}/pressure-response">&larr; Pressure Response</a></p>

<h1>Pressure Response: {penEntityId}</h1>

<p class="summary">
	{sessions.length} sessions across {inventorySummaries.length} pens
</p>

{#each inventorySummaries as inv}
	<section class="inventory-section">
		<h2>{inv.inventoryId}</h2>
		<table>
			<thead>
				<tr>
					<th>Date</th>
					<th>Tablet</th>
					<th>Driver</th>
					<th>OS</th>
					<th>Data Points</th>
					<th>Max Force (gf)</th>
				</tr>
			</thead>
			<tbody>
				{#each inv.sessions as session}
					<tr>
						<td>{session.Date}</td>
						<td>{session.TabletEntityId}</td>
						<td>{session.Driver}</td>
						<td>{session.OS}</td>
						<td>{session.Records.length}</td>
						<td>{session.Records.length > 0 ? Math.max(...session.Records.map(r => r[0])).toFixed(1) : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#each inv.sessions as session}
			<details class="session-details">
				<summary>{session.Date} — {session.Records.length} points, max {session.Records.length > 0 ? Math.max(...session.Records.map(r => r[0])).toFixed(1) : '?'} gf</summary>
				<table class="data-table">
					<thead>
						<tr><th>Force (gf)</th><th>Output (%)</th></tr>
					</thead>
					<tbody>
						{#each session.Records as [gf, pct]}
							<tr><td>{gf}</td><td>{pct}</td></tr>
						{/each}
					</tbody>
				</table>
			</details>
		{/each}
	</section>
{/each}

<style>
	.back {
		margin-bottom: 16px;
		font-size: 14px;
	}

	.back a {
		color: #2563eb;
		text-decoration: none;
	}

	.back a:hover { text-decoration: underline; }

	h1 { margin-bottom: 8px; }

	.summary {
		font-size: 14px;
		color: #666;
		margin-bottom: 20px;
	}

	.inventory-section {
		margin-bottom: 32px;
	}

	.inventory-section h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #e0e0e0;
	}

	table {
		width: auto;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
		margin-bottom: 8px;
	}

	th, td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #333;
		color: #fff;
	}

	tr:hover td { background: #f0f7ff; }

	.session-details {
		margin-bottom: 8px;
		font-size: 13px;
	}

	.session-details summary {
		cursor: pointer;
		color: #2563eb;
		padding: 4px 0;
	}

	.session-details summary:hover { text-decoration: underline; }

	.data-table {
		margin-top: 4px;
		margin-left: 16px;
	}

	.data-table td {
		font-family: monospace;
		text-align: right;
	}
</style>
