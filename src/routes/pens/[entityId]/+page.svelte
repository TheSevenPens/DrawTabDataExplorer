<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPensFromURL, loadPenCompatFromURL, loadTabletsFromURL, loadPressureResponseFromURL, brandName, type Tablet, type PressureResponse } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import JsonDialog from '$lib/components/JsonDialog.svelte';

	let pen: Pen | null = $state(null);
	let showJson = $state(false);
	let activeTab = $state<'specs' | 'tablets' | 'included' | 'pressure'>('specs');
	let compatibleTablets: Tablet[] = $state([]);
	let includedWithTablets: Tablet[] = $state([]);
	let pressureSessionCount = $state(0);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId!);
		const [allPens, allCompat, allTablets, allPressure] = await Promise.all([
			loadPensFromURL(base) as Promise<Pen[]>,
			loadPenCompatFromURL(base) as Promise<PenCompat[]>,
			loadTabletsFromURL(base),
			loadPressureResponseFromURL(base),
		]);

		const found = allPens.find((p) => p.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		pen = found;

		const compatTabletIds = new Set(
			allCompat
				.filter((c) => c.PenId === found.PenId)
				.map((c) => c.TabletId)
		);

		compatibleTablets = allTablets.filter((t) => compatTabletIds.has(t.Model.Id));

		// Pressure response data
		pressureSessionCount = allPressure.filter(s => s.PenEntityId === found.EntityId).length;

		// Find tablets that include this pen
		includedWithTablets = allTablets.filter((t) => {
			return (t.Model.IncludedPen ?? []).some((p) => p === found.EntityId);
		});
	});
</script>

<Nav />

{#if notFound}
	<h1>Pen not found</h1>
	<p><a href="{base}/pens">Back to pens</a></p>
{:else}
	<div class="title-row">
		<h1>{pen?.PenName ?? 'Loading...'}</h1>
		{#if pen}
			<button class="json-btn" onclick={() => showJson = true}>JSON</button>
		{/if}
	</div>

	{#if showJson && pen}
		<JsonDialog entity={pen} onclose={() => showJson = false} />
	{/if}

	{#if pen}
		<section class="basics">
			<dl class="basics-grid">
				<div class="basics-item">
					<dt>Brand</dt>
					<dd><a href="{base}/brands/{pen.Brand}">{brandName(pen.Brand)}</a></dd>
				</div>
				<div class="basics-item">
					<dt>Pen ID</dt>
					<dd>{pen.PenId}</dd>
				</div>
				{#if pen.PenYear}
					<div class="basics-item">
						<dt>Year</dt>
						<dd>{pen.PenYear}</dd>
					</div>
				{/if}
				{#if pen.PenFamily}
					<div class="basics-item">
						<dt>Family</dt>
						<dd>{pen.PenFamily}</dd>
					</div>
				{/if}
			</dl>
		</section>

		<div class="detail-tabs">
			<button class:active={activeTab === 'specs'}    onclick={() => activeTab = 'specs'}>Specs</button>
			<button class:active={activeTab === 'tablets'}  onclick={() => activeTab = 'tablets'}>Compatible Tablets</button>
			<button class:active={activeTab === 'included'} onclick={() => activeTab = 'included'}>Included With</button>
			<button class:active={activeTab === 'pressure'} onclick={() => activeTab = 'pressure'}>Pressure Response</button>
		</div>

		{#if activeTab === 'specs'}
			<div class="tab-content">
				<DetailView item={pen} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} />
			</div>
		{/if}

		{#if activeTab === 'tablets'}
			<div class="tab-content">
				{#if compatibleTablets.length > 0}
					<ul class="entity-list">
						{#each compatibleTablets as tablet}
							<li><a href="{base}/tablets/{encodeURIComponent(tablet.Meta.EntityId)}">{brandName(tablet.Model.Brand)} {tablet.Model.Name} ({tablet.Model.Id})</a></li>
						{/each}
					</ul>
				{:else}
					<p class="no-data">No tablet compatibility data available for this pen.</p>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'included'}
			<div class="tab-content">
				{#if includedWithTablets.length > 0}
					<ul class="entity-list">
						{#each includedWithTablets as tablet}
							<li><a href="{base}/tablets/{encodeURIComponent(tablet.Meta.EntityId)}">{brandName(tablet.Model.Brand)} {tablet.Model.Name} ({tablet.Model.Id})</a></li>
						{/each}
					</ul>
				{:else}
					<p class="no-data">No tablets list this pen as included.</p>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'pressure'}
			<div class="tab-content">
				{#if pressureSessionCount > 0}
					<p class="pr-link"><a href="{base}/pressure-response/{encodeURIComponent(pen.EntityId)}">{pressureSessionCount} measurement session{pressureSessionCount === 1 ? '' : 's'} available</a></p>
				{:else}
					<p class="no-data">No pressure response data available for this pen model.</p>
				{/if}
			</div>
		{/if}
	{/if}
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}

	.title-row h1 { margin: 0; }

	.json-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #6b7280;
		border-radius: 4px;
		background: var(--bg-card);
		color: #6b7280;
		cursor: pointer;
		font-weight: 600;
	}

	.json-btn:hover { background: #6b7280; color: #fff; }

	/* ── Basics ── */
	.basics {
		margin-bottom: 20px;
		padding: 12px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.basics-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		margin: 0;
		padding: 0;
	}

	.basics-item {
		display: flex;
		flex-direction: column;
		padding: 4px 20px 4px 0;
		min-width: 100px;
	}

	.basics-item dt {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-dim);
		margin-bottom: 2px;
	}

	.basics-item dd {
		font-size: 13px;
		color: var(--text);
	}

	.basics-item dd a {
		color: var(--link);
		text-decoration: none;
	}

	.basics-item dd a:hover { text-decoration: underline; }

	/* ── Tabs ── */
	.detail-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 16px;
	}

	.detail-tabs button {
		padding: 6px 16px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		bottom: -2px;
	}

	.detail-tabs button:hover {
		color: #2563eb;
		background: var(--bg-card);
		border-color: var(--border);
	}

	.detail-tabs button.active {
		background: var(--bg);
		color: #2563eb;
		border-color: var(--border);
		font-weight: 600;
	}

	.tab-content { margin-bottom: 24px; }

	/* ── Lists ── */
	.entity-list {
		list-style: none;
		padding: 0;
	}

	.entity-list li {
		padding: 4px 0;
		font-size: 13px;
	}

	.entity-list a {
		color: var(--link);
		text-decoration: none;
	}

	.entity-list a:hover { text-decoration: underline; }

	.pr-link { font-size: 13px; }

	.pr-link a {
		color: var(--link);
		text-decoration: none;
	}

	.pr-link a:hover { text-decoration: underline; }

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
