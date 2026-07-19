<script lang="ts">
	// OpenTabletDriver config reference table. Shows the authoritative OTD model
	// `name` (the model key — not filename/ProductID) plus vendor and USB
	// identifiers, straight from data/otd/otd-tablets.json. Refresh with
	// `node scripts/extract-otd-configs.mjs`.
	import type { OTDConfigFile } from '$data/lib/drawtab-loader.js';

	let { config }: { config: OTDConfigFile | null } = $props();

	const src = $derived(config?.source ?? null);
	const tablets = $derived(config?.tablets ?? []);

	// --- Filters (client-side) ---
	let search = $state('');
	let vendor = $state('');
	const vendors = $derived([...new Set(tablets.map((t) => t.vendor))].sort());
	const filtered = $derived(
		tablets.filter(
			(t) =>
				(vendor === '' || t.vendor === vendor) &&
				(search === '' || (t.name ?? t.file).toLowerCase().includes(search.toLowerCase())),
		),
	);

	// Base for linking each row to its config file on GitHub, pinned to the
	// exact commit the dataset was harvested from.
	const blobBase = $derived(
		src
			? `https://github.com/${src.repo}/blob/${src.commit}/${src.configGlob.replace('*/*.json', '')}`
			: '',
	);

	const hex = (n: number | null) =>
		n == null ? '—' : n.toString(16).toUpperCase().padStart(4, '0');
	function usbIds(ids: { vendorID: number | null; productID: number | null }[]): string {
		return ids.length ? ids.map((i) => `${hex(i.vendorID)}:${hex(i.productID)}`).join(', ') : '—';
	}
	const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
	function activeArea(s: { widthMM: number | null; heightMM: number | null }): string {
		const w = round1(s.widthMM);
		const h = round1(s.heightMM);
		return w != null && h != null ? `${w} × ${h}` : '—';
	}
	const numOrDash = (n: number | null) => (n == null ? '—' : String(n));
	const shortCommit = $derived(src?.commit.slice(0, 7) ?? '');
</script>

<section>
	<div class="section-header">
		<h2>OTD Tablets</h2>
	</div>
	<p class="meta">
		Per-model tablet configurations from
		<a href="https://github.com/{src?.repo}" target="_blank" rel="noopener">OpenTabletDriver</a>.
		The
		<code>Name</code> is the authoritative model key (many models share a USB VendorID:ProductID pair).
	</p>
	{#if src}
		<p class="meta">
			{tablets.length} tablets · pinned to
			{#if blobBase}
				<a href="https://github.com/{src.repo}/tree/{src.commit}" target="_blank" rel="noopener"
					><code>{shortCommit}</code></a
				>
			{:else}
				<code>{shortCommit}</code>
			{/if}
			{#if src.commitDate}({src.commitDate.slice(0, 10)}){/if} · refresh with
			<code>node scripts/extract-otd-configs.mjs</code>
		</p>
	{/if}

	{#if tablets.length}
		<div class="ref-filters">
			<input type="search" placeholder="Search name…" bind:value={search} />
			<select bind:value={vendor} aria-label="Filter by vendor">
				<option value="">All vendors</option>
				{#each vendors as v (v)}
					<option value={v}>{v}</option>
				{/each}
			</select>
			<span class="filter-count">{filtered.length} of {tablets.length}</span>
		</div>
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Vendor</th>
						<th>Active Area (mm)</th>
						<th class="num">Max Pressure</th>
						<th class="num">Pen Btns</th>
						<th class="num">Aux Btns</th>
						<th>USB IDs (VID:PID)</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as t (t.file)}
						<tr>
							<td>
								{#if blobBase}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href="{blobBase}{t.file}" target="_blank" rel="noopener">{t.name ?? t.file}</a>
								{:else}
									{t.name ?? t.file}
								{/if}
							</td>
							<td>{t.vendor}</td>
							<td class="mono">{activeArea(t.specs)}</td>
							<td class="num mono">{numOrDash(t.specs.penMaxPressure)}</td>
							<td class="num mono">{numOrDash(t.specs.penButtons)}</td>
							<td class="num mono">{numOrDash(t.specs.auxButtons)}</td>
							<td class="mono">{usbIds(t.identifiers)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="meta">No OTD reference data available.</p>
	{/if}
</section>

<style>
	.section-header {
		margin-bottom: 8px;
	}
	h2 {
		font-size: var(--type-heading);
		font-weight: 600;
		color: var(--text);
	}
	.meta {
		margin: 0 0 6px;
		color: var(--text-muted);
		font-size: var(--type-caption);
	}
	.meta code {
		background: var(--bg-card);
		padding: 1px 5px;
		border-radius: var(--radius);
	}
	.table-wrap {
		overflow-x: auto;
		margin-top: 8px;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
		color: var(--text-muted);
	}
	.num {
		text-align: right;
	}
</style>
