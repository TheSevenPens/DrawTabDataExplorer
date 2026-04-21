<script lang="ts">
	import { base } from '$app/paths';
	import { type Brand, BRAND_FIELDS, BRAND_FIELD_GROUPS } from '$data/lib/entities/brand-fields.js';
	import { type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();

	let brand: Brand = $derived(data.brand);
	let tablets: Tablet[] = $derived(data.tablets);
	let pens: Pen[] = $derived(data.pens);

	let activeTab = $state<'tablets' | 'pens'>('tablets');

	let sortedTablets = $derived(
		[...tablets].sort((a, b) => (b.Model.LaunchYear ?? '').localeCompare(a.Model.LaunchYear ?? ''))
	);
	let sortedPens = $derived(
		[...pens].sort((a, b) => (b.PenYear ?? '').localeCompare(a.PenYear ?? ''))
	);
</script>

<Nav />

<div class="title-row">
	<h1>{brand.BrandName}</h1>
</div>

<DetailView
	item={brand}
	fields={BRAND_FIELDS}
	fieldGroups={BRAND_FIELD_GROUPS}
/>

<div class="tabs-section">
	<div class="tab-bar">
		<button class="tab-btn" class:active={activeTab === 'tablets'} onclick={() => activeTab = 'tablets'}>
			Tablets ({tablets.length})
		</button>
		<button class="tab-btn" class:active={activeTab === 'pens'} onclick={() => activeTab = 'pens'}>
			Pens ({pens.length})
		</button>
	</div>

	<div class="tab-panel">
		{#if activeTab === 'tablets'}
			{#if sortedTablets.length > 0}
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
						{#each sortedTablets as t}
							<tr>
								<td><a class="entity-link" href="{base}/entity/{encodeURIComponent(t.Meta.EntityId)}">{t.Model.Name} ({t.Model.Id})</a></td>
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
		{:else}
			{#if sortedPens.length > 0}
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Pen ID</th>
							<th>Year</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedPens as p}
							<tr>
								<td><a class="entity-link" href="{base}/entity/{encodeURIComponent(p.EntityId)}">{p.PenName}</a></td>
								<td>{p.PenId}</td>
								<td>{p.PenYear ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No pens found for this brand.</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.title-row {
		margin-bottom: 16px;
	}

	h1 { margin: 0; }

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

	.no-data { font-size: 13px; color: #999; font-style: italic; }
</style>
