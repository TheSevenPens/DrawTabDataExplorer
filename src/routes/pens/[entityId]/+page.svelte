<script lang="ts">
	import { base } from '$app/paths';
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import JsonDialog from '$lib/components/JsonDialog.svelte';

	let { data } = $props();
	const pen: Pen = data.pen;
	const compatibleTablets: Tablet[] = data.compatibleTablets;
	const includedWithTablets: Tablet[] = data.includedWithTablets;
	const pressureSessionCount: number = data.pressureSessionCount;

	let showJson = $state(false);
	let activeTab = $state<'specs' | 'tablets' | 'included' | 'pressure'>('specs');
</script>

<Nav />

<div class="title-row">
	<h1>{pen.PenName}</h1>
	<button class="json-btn" onclick={() => showJson = true}>JSON</button>
</div>

{#if showJson}
	<JsonDialog entity={pen} onclose={() => showJson = false} />
{/if}

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

	.basics {
		margin-bottom: 20px;
		padding: 12px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.basics-grid { display: flex; flex-wrap: wrap; gap: 0; margin: 0; padding: 0; }
	.basics-item { display: flex; flex-direction: column; padding: 4px 20px 4px 0; min-width: 100px; }
	.basics-item dt { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); margin-bottom: 2px; }
	.basics-item dd { font-size: 13px; color: var(--text); }
	.basics-item dd a { color: var(--link); text-decoration: none; }
	.basics-item dd a:hover { text-decoration: underline; }

	.detail-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
	.detail-tabs button {
		padding: 6px 16px; font-size: 13px; border: 1px solid transparent;
		border-bottom: none; border-radius: 4px 4px 0 0; background: transparent;
		color: var(--text-muted); cursor: pointer; position: relative; bottom: -2px;
	}
	.detail-tabs button:hover { color: #2563eb; background: var(--bg-card); border-color: var(--border); }
	.detail-tabs button.active { background: var(--bg); color: #2563eb; border-color: var(--border); font-weight: 600; }

	.tab-content { margin-bottom: 24px; }

	.entity-list { list-style: none; padding: 0; }
	.entity-list li { padding: 4px 0; font-size: 13px; }
	.entity-list a { color: var(--link); text-decoration: none; }
	.entity-list a:hover { text-decoration: underline; }

	.pr-link { font-size: 13px; }
	.pr-link a { color: var(--link); text-decoration: none; }
	.pr-link a:hover { text-decoration: underline; }

	.no-data { font-size: 13px; color: var(--text-dim); font-style: italic; }
</style>
