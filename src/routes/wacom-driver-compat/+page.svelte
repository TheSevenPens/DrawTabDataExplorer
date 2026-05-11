<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		loadWacomUpdateProductsFromURL,
		loadTabletsFromURL,
		type WacomUpdateProduct,
		type Tablet,
	} from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];

	let products: WacomUpdateProduct[] = $state([]);
	let modelToTablet = $state<Map<string, Tablet>>(new Map());
	let sensorIdToTablet = $state<Map<string, Tablet>>(new Map());

	onMount(async () => {
		const [p, tablets] = await Promise.all([
			loadWacomUpdateProductsFromURL(base),
			loadTabletsFromURL(base),
		]);
		// Manifest model strings are dashless and uppercase (e.g. "DTH1152");
		// our Model.Id values use dashes (e.g. "DTH-1152"). Normalize to a
		// dashless uppercase key so the join lights up.
		const norm = (s: string) => s.replace(/-/g, '').toUpperCase();
		const byModel = new Map<string, Tablet>();
		const bySensor = new Map<string, Tablet>();
		for (const t of tablets) {
			if (t.Model.Brand !== 'WACOM') continue;
			if (t.Model.Id) byModel.set(norm(t.Model.Id), t);
			if (t.Model.SensorId) bySensor.set(t.Model.SensorId, t);
		}
		modelToTablet = byModel;
		sensorIdToTablet = bySensor;
		products = p;
	});

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

<Nav />
<SubNav tabs={dataTabs} />

<div class="header">
	<h1>Wacom Driver Compatibility</h1>
	<p class="meta">
		Driver-version range supported by each tablet, derived from Wacom's
		<code>update.xml</code> manifest. Sourced from
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
						<a href="{base}/entity/{encodeURIComponent(t.Meta.EntityId)}">{p.name}</a>
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

<style>
	.header {
		margin-bottom: 16px;
	}
	h1 {
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
