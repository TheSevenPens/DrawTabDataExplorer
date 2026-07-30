<script lang="ts">
	// Curation page for links extracted from DrawingTabletDocs. Edit type / title
	// / author / date, drop the ones that don't belong, then Export the kept set
	// as JSON to hand back — I apply it to entity data (Model.Links / Links).
	// Edits persist in localStorage. Re-extract with scripts/extract-doc-links.mjs.
	import Button from '$lib/components/Button.svelte';
	import EntityLink from '$lib/components/EntityLink.svelte';

	let { data } = $props();
	const rows = $derived(data.links);

	const TYPES = ['REVIEW', 'PRODUCTINFO', 'USERMANUAL', 'STORE'];

	type Edit = { type?: string; title?: string; author?: string; publishDate?: string };
	const keyOf = (l: (typeof rows)[number]) => `${l.entityId}|${l.url}`;
	const DROP_KEY = 'links-review-drops';
	const EDIT_KEY = 'links-review-edits';

	function load<T>(k: string, fallback: T): T {
		try {
			return { ...fallback, ...JSON.parse(localStorage.getItem(k) || '{}') };
		} catch {
			return fallback;
		}
	}
	let dropped = $state<Record<string, boolean>>(load(DROP_KEY, {}));
	let edits = $state<Record<string, Edit>>(load(EDIT_KEY, {}));
	const persist = () => {
		try {
			localStorage.setItem(DROP_KEY, JSON.stringify(dropped));
			localStorage.setItem(EDIT_KEY, JSON.stringify(edits));
		} catch {
			/* ignore */
		}
	};

	const kept = (l: (typeof rows)[number]) => !dropped[keyOf(l)];
	const cur = (l: (typeof rows)[number], f: keyof Edit) => edits[keyOf(l)]?.[f] ?? l[f];
	function setField(l: (typeof rows)[number], f: keyof Edit, v: string) {
		const k = keyOf(l);
		edits = { ...edits, [k]: { ...edits[k], [f]: v } };
		persist();
	}
	function toggleDrop(l: (typeof rows)[number], keep: boolean) {
		const k = keyOf(l);
		if (keep) {
			const { [k]: _d, ...rest } = dropped;
			dropped = rest;
		} else {
			dropped = { ...dropped, [k]: true };
		}
		persist();
	}

	// --- filters ---
	let search = $state('');
	let entityType = $state('');
	let brand = $state('');
	let typeF = $state('');
	let keptOnly = $state(false);
	const brands = $derived([...new Set(rows.map((l) => l.brand))].sort());
	const filtered = $derived(
		rows.filter(
			(l) =>
				(entityType === '' || l.entityType === entityType) &&
				(brand === '' || l.brand === brand) &&
				(typeF === '' || cur(l, 'type') === typeF) &&
				(!keptOnly || kept(l)) &&
				(search === '' ||
					`${l.entityId} ${l.entityName} ${cur(l, 'title')} ${cur(l, 'author')}`
						.toLowerCase()
						.includes(search.toLowerCase())),
		),
	);

	const keptCount = $derived(rows.filter(kept).length);

	function bulkKeep(keep: boolean) {
		const next = { ...dropped };
		for (const l of filtered) {
			const k = keyOf(l);
			if (keep) delete next[k];
			else next[k] = true;
		}
		dropped = next;
		persist();
	}

	const exportJson = $derived(
		JSON.stringify(
			{
				links: rows.filter(kept).map((l) => ({
					entityId: l.entityId,
					entityType: l.entityType,
					type: cur(l, 'type'),
					url: l.url,
					title: cur(l, 'title'),
					author: cur(l, 'author'),
					publishDate: cur(l, 'publishDate'),
				})),
			},
			null,
			2,
		) + '\n',
	);
	let copied = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(exportJson);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard blocked */
		}
	}
	function download() {
		const blob = new Blob([exportJson], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'entity-links.json';
		a.click();
		URL.revokeObjectURL(url);
	}
	function resetEdits() {
		dropped = {};
		edits = {};
		persist();
	}
</script>

<svelte:head><title>Links Review</title></svelte:head>

<div class="page">
	<div class="head">
		<h1>Entity Links — Review</h1>
		<a href="/reference">← back to reference</a>
	</div>
	<p class="meta">
		Links extracted from <strong>DrawingTabletDocs</strong> and mapped to entities. Fix the
		<em>type / title / author / date</em>, untick ones that don't belong, then
		<em>Copy</em>/<em>Download</em> the kept set — I apply it to entity data. Edits are saved in this
		browser.
	</p>
	<p class="meta">
		{keptCount} kept of {rows.length} extracted · {new Set(rows.filter(kept).map((l) => l.entityId))
			.size} entities
	</p>

	<div class="ref-filters">
		<input type="search" placeholder="Search entity / title / author…" bind:value={search} />
		<select bind:value={entityType} aria-label="Filter by entity type">
			<option value="">tablets + pens</option>
			<option value="tablet">tablets</option>
			<option value="pen">pens</option>
		</select>
		<select bind:value={brand} aria-label="Filter by brand">
			<option value="">All brands</option>
			{#each brands as b (b)}<option value={b}>{b}</option>{/each}
		</select>
		<select bind:value={typeF} aria-label="Filter by type">
			<option value="">All types</option>
			{#each TYPES as t (t)}<option value={t}>{t}</option>{/each}
		</select>
		<label class="chk"><input type="checkbox" bind:checked={keptOnly} /> kept only</label>
		<span class="filter-count">{filtered.length} shown</span>
	</div>

	<div class="bulk">
		<span class="bulk-label">All {filtered.length} shown:</span>
		<Button size="sm" onclick={() => bulkKeep(true)}>keep</Button>
		<Button size="sm" variant="subtle" onclick={() => bulkKeep(false)}>drop</Button>
	</div>

	<div class="table-wrap">
		<table class="ref-table">
			<thead>
				<tr>
					<th>Keep</th>
					<th>Entity</th>
					<th>Type</th>
					<th>Title</th>
					<th>Author</th>
					<th>Date</th>
					<th>URL</th>
					<th>Source</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as l (keyOf(l))}
					<tr class:dropped={!kept(l)}>
						<td class="c"
							><input
								type="checkbox"
								checked={kept(l)}
								onchange={(e) => toggleDrop(l, e.currentTarget.checked)}
							/></td
						>
						<td class="wrap-cell"><EntityLink entityId={l.entityId}>{l.entityName}</EntityLink></td>
						<td>
							<select
								class="ed"
								value={cur(l, 'type')}
								onchange={(e) => setField(l, 'type', e.currentTarget.value)}
							>
								{#each TYPES as t (t)}<option value={t}>{t}</option>{/each}
							</select>
						</td>
						<td class="wrap-cell"
							><input
								class="ed"
								value={cur(l, 'title')}
								oninput={(e) => setField(l, 'title', e.currentTarget.value)}
							/></td
						>
						<td
							><input
								class="ed"
								value={cur(l, 'author')}
								oninput={(e) => setField(l, 'author', e.currentTarget.value)}
							/></td
						>
						<td
							><input
								class="ed date"
								value={cur(l, 'publishDate')}
								placeholder="YYYY-MM-DD"
								oninput={(e) => setField(l, 'publishDate', e.currentTarget.value)}
							/></td
						>
						<td class="wrap-cell">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={l.url} target="_blank" rel="noopener"
								>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</a
							>
						</td>
						<td class="dim src">{l.sourceFile}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<section class="export">
		<div class="export-head">
			<h2>Export ({keptCount} links)</h2>
			<div class="export-actions">
				<Button variant="primary" size="sm" onclick={copy}
					>{copied ? 'Copied!' : 'Copy JSON'}</Button
				>
				<Button size="sm" onclick={download}>Download</Button>
				<Button variant="subtle" size="sm" onclick={resetEdits}>Reset all edits</Button>
			</div>
		</div>
		<textarea class="export-json" readonly rows="8" value={exportJson}></textarea>
	</section>
</div>

<style>
	.page {
		max-width: 1400px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 8px;
	}
	h1 {
		font-size: var(--type-title);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-tight);
		color: var(--text);
	}
	.head a {
		color: var(--link);
		font-size: var(--type-caption);
	}
	.meta {
		margin: 0 0 6px;
		color: var(--text-muted);
		font-size: var(--type-caption);
	}
	.meta strong {
		color: var(--text);
		font-weight: 600;
	}
	.bulk {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0 8px;
	}
	.bulk-label {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}
	.chk {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--type-caption);
		color: var(--text-muted);
	}
	.table-wrap {
		overflow-x: auto;
	}
	.c {
		text-align: center;
	}
	.wrap-cell {
		white-space: normal;
		min-width: 130px;
	}
	tr.dropped {
		opacity: 0.4;
	}
	.src {
		font-size: var(--type-micro);
		max-width: 160px;
		white-space: normal;
		word-break: break-all;
	}
	.ed {
		width: 100%;
		min-width: 90px;
		padding: 2px 5px;
		font-size: var(--type-caption);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text);
	}
	.ed.date {
		min-width: 96px;
	}
	.export {
		margin-top: 20px;
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}
	.export-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 6px;
	}
	.export h2 {
		font-size: var(--type-subhead);
		font-weight: 600;
		color: var(--text);
	}
	.export-actions {
		display: flex;
		gap: 6px;
	}
	.export-json {
		width: 100%;
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
		font-size: var(--type-caption);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text);
		padding: 8px;
		resize: vertical;
	}
</style>
