<script lang="ts">
	import { resolve } from '$app/paths';
	import { type Brand, BRAND_FIELDS, BRAND_FIELD_GROUPS } from '$data/lib/entities/brand-fields.js';
	import { type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import { tabletNameAndId } from '$lib/tablet-helpers.js';

	let { data } = $props();

	let brand: Brand = $derived(data.brand);
	let tablets: Tablet[] = $derived(data.tablets);
	let pens: Pen[] = $derived(data.pens);

	let activeTab = $state<'tablets' | 'pens' | 'timeline'>('tablets');

	let sortedTablets = $derived(
		[...tablets].sort((a, b) => (b.Model.LaunchYear ?? '').localeCompare(a.Model.LaunchYear ?? '')),
	);
	let sortedPens = $derived(
		[...pens].sort((a, b) => (b.PenYear ?? '').localeCompare(a.PenYear ?? '')),
	);

	let timeline = $derived.by(() => {
		const yearMap = new Map<string, { tablets: Tablet[]; pens: Pen[] }>();
		for (const t of tablets) {
			if (!t.Model.LaunchYear) continue;
			if (!yearMap.has(t.Model.LaunchYear))
				yearMap.set(t.Model.LaunchYear, { tablets: [], pens: [] });
			yearMap.get(t.Model.LaunchYear)!.tablets.push(t);
		}
		for (const p of pens) {
			if (!p.PenYear) continue;
			if (!yearMap.has(p.PenYear)) yearMap.set(p.PenYear, { tablets: [], pens: [] });
			yearMap.get(p.PenYear)!.pens.push(p);
		}
		return [...yearMap.entries()]
			.map(([year, d]) => ({ year, tablets: d.tablets, pens: d.pens }))
			.sort((a, b) => b.year.localeCompare(a.year));
	});
</script>

<Nav />

<div class="title-row">
	<h1>{brand.BrandName}</h1>
</div>

<DetailView item={brand} fields={BRAND_FIELDS} fieldGroups={BRAND_FIELD_GROUPS} />

<div class="tabs-section">
	<div class="tab-bar">
		<button
			class="tab-btn"
			class:active={activeTab === 'tablets'}
			onclick={() => (activeTab = 'tablets')}
		>
			Tablets ({tablets.length})
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'pens'}
			onclick={() => (activeTab = 'pens')}
		>
			Pens ({pens.length})
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'timeline'}
			onclick={() => (activeTab = 'timeline')}
		>
			Timeline
		</button>
	</div>

	<div class="tab-panel">
		{#if activeTab === 'tablets'}
			{#if sortedTablets.length > 0}
				<div class="table-header">
					<ExportTableButton
						entityType="brand"
						title={`${brand.BrandName} — Tablets`}
						filename={`${brand.EntityId}-tablets`}
						headers={['Name', 'Entity ID', 'Alternate Names', 'Type', 'Year']}
						rows={sortedTablets.map((t) => [
							tabletNameAndId(t),
							t.Meta.EntityId,
							(t.Model.AlternateNames ?? []).join(', '),
							t.Model.Type,
							t.Model.LaunchYear ?? '',
						])}
					/>
				</div>
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Alternate Names</th>
							<th>Type</th>
							<th>Year</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedTablets as t (t.Meta.EntityId)}
							<tr>
								<td
									><a
										class="entity-link"
										href={resolve('/entity/[entityId]', { entityId: t.Meta.EntityId })}
										>{tabletNameAndId(t)}</a
									></td
								>
								<td>{(t.Model.AlternateNames ?? []).join(', ')}</td>
								<td>{t.Model.Type}</td>
								<td>{t.Model.LaunchYear ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No tablets found for this brand.</p>
			{/if}
		{:else if activeTab === 'pens'}
			{#if sortedPens.length > 0}
				<div class="table-header">
					<ExportTableButton
						entityType="brand"
						title={`${brand.BrandName} — Pens`}
						filename={`${brand.EntityId}-pens`}
						headers={['Name', 'Pen ID', 'Entity ID', 'Year']}
						rows={sortedPens.map((p) => [p.PenName, p.PenId, p.EntityId, p.PenYear ?? ''])}
					/>
				</div>
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Pen ID</th>
							<th>Year</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedPens as p (p.EntityId)}
							<tr>
								<td
									><a
										class="entity-link"
										href={resolve('/entity/[entityId]', { entityId: p.EntityId })}>{p.PenName}</a
									></td
								>
								<td>{p.PenId}</td>
								<td>{p.PenYear ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No pens found for this brand.</p>
			{/if}
		{:else if activeTab === 'timeline'}
			{#if timeline.length === 0}
				<p class="no-data">No timeline data available.</p>
			{:else}
				<div class="brand-timeline">
					{#each timeline as entry (entry.year)}
						<div class="tl-year-block">
							<div class="tl-year-label">{entry.year}</div>
							<div class="tl-year-content">
								{#if entry.tablets.length > 0}
									<div class="tl-category">
										<h3>Tablets ({entry.tablets.length})</h3>
										<div class="tl-items">
											{#each entry.tablets as t (t.Meta.EntityId)}
												<a
													class="tl-item tl-tablet"
													href={resolve('/entity/[entityId]', { entityId: t.Meta.EntityId })}
												>
													<span class="tl-name">{t.Model.Name}</span>
													<span class="tl-id">{t.Model.Id}</span>
													<span class="tl-type">{t.Model.Type}</span>
												</a>
											{/each}
										</div>
									</div>
								{/if}
								{#if entry.pens.length > 0}
									<div class="tl-category">
										<h3>Pens ({entry.pens.length})</h3>
										<div class="tl-items">
											{#each entry.pens as p (p.EntityId)}
												<a
													class="tl-item tl-pen"
													href={resolve('/entity/[entityId]', { entityId: p.EntityId })}
												>
													<span class="tl-name">{p.PenName}</span>
													<span class="tl-id">{p.PenId}</span>
												</a>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.title-row {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
	}

	.tabs-section {
		margin-top: 24px;
	}

	.tab-bar {
		display: flex;
		gap: 2px;
		border-bottom: 2px solid var(--border);
		margin-bottom: 0;
	}

	.tab-btn {
		padding: 6px 16px;
		font-size: 13px;
		font-weight: 600;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--text-muted);
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
	}

	.tab-btn:hover {
		color: var(--text);
	}

	.tab-btn.active {
		color: #6b21a8;
		border-bottom-color: #6b21a8;
	}

	.tab-panel {
		padding-top: 12px;
	}

	.table-header {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 8px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}

	td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	.entity-link {
		color: var(--link);
		text-decoration: none;
	}
	.entity-link:hover {
		text-decoration: underline;
	}

	.no-data {
		font-size: 13px;
		color: #999;
		font-style: italic;
	}

	.brand-timeline {
		padding-left: 64px;
	}

	.tl-year-block {
		position: relative;
		margin-bottom: 20px;
		padding-bottom: 20px;
		border-bottom: 1px solid var(--border);
	}
	.tl-year-block:last-child {
		border-bottom: none;
	}

	.tl-year-label {
		position: absolute;
		left: -64px;
		top: 0;
		width: 52px;
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
		text-align: right;
	}

	.tl-year-content {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.tl-category h3 {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		margin: 0 0 6px;
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.tl-items {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tl-item {
		display: inline-flex;
		flex-direction: column;
		padding: 5px 10px;
		border-radius: 6px;
		font-size: 12px;
		text-decoration: none;
		border: 1px solid var(--border-light);
		background: var(--bg-card);
		min-width: 120px;
	}

	.tl-tablet {
		border-left: 3px solid #2563eb;
	}
	.tl-pen {
		border-left: 3px solid #7c3aed;
	}
	.tl-item:hover {
		background: var(--hover-bg);
		border-color: var(--border);
	}

	.tl-name {
		font-weight: 600;
		color: var(--text);
	}
	.tl-id {
		font-size: 11px;
		color: var(--text-muted);
		font-weight: 700;
	}
	.tl-type {
		font-size: 10px;
		color: var(--text-dim);
		text-transform: uppercase;
	}
</style>
