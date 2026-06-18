<script lang="ts">
	// Wacom driver-compatibility table, shown as a Reference section (moved out
	// of the former /wacom-driver-compat route). Joins the cached Wacom
	// update.xml products to known tablet records (by sensor id, else by
	// dashless-uppercase model id).
	import type { WacomUpdateProduct, Tablet } from '$data/lib/drawtab-loader.js';
	import EntityLink from '$lib/components/EntityLink.svelte';

	let {
		products,
		modelToTablet,
		sensorIdToTablet,
	}: {
		products: WacomUpdateProduct[];
		modelToTablet: ReadonlyMap<string, Tablet>;
		sensorIdToTablet: ReadonlyMap<string, Tablet>;
	} = $props();

	function tabletFor(p: WacomUpdateProduct): Tablet | undefined {
		if (p.sensorid && sensorIdToTablet.has(p.sensorid)) return sensorIdToTablet.get(p.sensorid);
		if (p.model) {
			const key = p.model.replace(/-/g, '').toUpperCase();
			if (modelToTablet.has(key)) return modelToTablet.get(key);
		}
		return undefined;
	}

	let matchCount = $derived(products.filter((p) => tabletFor(p)).length);
</script>

<section>
	<div class="header">
		<h2>Wacom Driver Compatibility</h2>
		<p class="meta">
			Sourced from
			<a href="https://link.wacom.com/wdc/update.xml" target="_blank" rel="noopener">
				link.wacom.com/wdc/update.xml
			</a>; cached at <code>data-repo/data/wacom-update/source.xml</code> and re-extracted via
			<code>node scripts/extract-wacom-products.mjs</code>.
		</p>
		<p class="meta">
			{products.length} entries · {matchCount} matched to a known tablet record
		</p>
	</div>

	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Model</th>
				<th>Driver Min</th>
				<th>Driver Max</th>
				<th>Platforms</th>
			</tr>
		</thead>
		<tbody>
			{#each products as p (p.name)}
				{@const t = tabletFor(p)}
				<tr>
					<td>
						{#if t}
							<EntityLink entityId={t.Meta.EntityId}>{p.name}</EntityLink>
						{:else}
							{p.name}
						{/if}
					</td>
					<td>{p.model ?? ''}</td>
					<td class="mono">{p.drivermin ?? ''}</td>
					<td class="mono">{p.drivermax ?? '(current)'}</td>
					<td>{p.platforms.join(', ')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.header {
		margin-bottom: 16px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin: 0 0 8px;
	}
	.meta {
		margin: 0 0 4px;
		color: var(--text-muted);
		font-size: 13px;
	}
	.meta code {
		background: var(--bg-card);
		padding: 1px 5px;
		border-radius: 3px;
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
</style>
