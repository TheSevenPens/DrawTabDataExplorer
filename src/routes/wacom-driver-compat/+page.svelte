<script lang="ts">
	import { base } from '$app/paths';
	import type { WacomUpdateProduct, Tablet } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	let { data } = $props();

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/api-explorer', label: 'API Explorer' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];

	function tabletFor(p: WacomUpdateProduct): Tablet | undefined {
		if (p.sensorid && data.sensorIdToTablet.has(p.sensorid))
			return data.sensorIdToTablet.get(p.sensorid);
		if (p.model) {
			const key = p.model.replace(/-/g, '').toUpperCase();
			if (data.modelToTablet.has(key)) return data.modelToTablet.get(key);
		}
		return undefined;
	}

	let matchCount = $derived(data.products.filter((p) => tabletFor(p)).length);
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
		{data.products.length} entries · {matchCount} matched to a known tablet record
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
		{#each data.products as p (p.name)}
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
