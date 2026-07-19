<script lang="ts">
	// OpenTabletDriver config reference table. Shows the authoritative OTD model
	// `name` (the model key — not filename/ProductID) plus vendor and USB
	// identifiers, straight from data/otd/otd-tablets.json. Refresh with
	// `node scripts/extract-otd-configs.mjs`.
	import type { OTDConfigFile } from '$data/lib/drawtab-loader.js';

	let { config }: { config: OTDConfigFile | null } = $props();

	const src = $derived(config?.source ?? null);
	const tablets = $derived(config?.tablets ?? []);

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
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Vendor</th>
						<th>USB IDs (VID:PID)</th>
					</tr>
				</thead>
				<tbody>
					{#each tablets as t (t.file)}
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
</style>
