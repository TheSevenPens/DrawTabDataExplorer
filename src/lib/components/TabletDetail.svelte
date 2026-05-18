<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { type TabletFamily } from '$data/lib/entities/tablet-family-fields.js';
	import type { InventoryTablet } from '$data/lib/entities/inventory-tablet-fields.js';
	import TabletSizeComparison from '$lib/components/TabletSizeComparison.svelte';
	import ForceProportionsView from '$lib/components/ForceProportionsView.svelte';
	import { flaggedTablets, toggleFlag } from '$lib/flagged-store.js';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import { buildPenNameMap } from '$lib/pen-helpers.js';
	import JsonDialog from '$lib/components/JsonDialog.svelte';
	import TabletModelTab from '$lib/components/tablet-detail/TabletModelTab.svelte';
	import TabletSpecsTab from '$lib/components/tablet-detail/TabletSpecsTab.svelte';
	import TabletCompatiblePensTab from '$lib/components/tablet-detail/TabletCompatiblePensTab.svelte';
	import TabletInventoryTab from '$lib/components/tablet-detail/TabletInventoryTab.svelte';
	import TabletSimilarTab from '$lib/components/tablet-detail/TabletSimilarTab.svelte';

	let { data } = $props();
	let tablet: Tablet = $derived(data.tablet);
	let allTablets: Tablet[] = $derived(data.allTablets);
	let allPens: Pen[] = $derived(data.allPens);
	let compatiblePens: Pen[] = $derived(data.compatiblePens);
	let isoSizes: ISOPaperSize[] = $derived(data.isoSizes);
	let family: TabletFamily | null = $derived(data.family);
	let inventoryUnits: InventoryTablet[] = $derived(data.inventoryUnits ?? []);

	let showJson = $state(false);
	let activeTab = $state<'model' | 'specs' | 'size' | 'force' | 'pens' | 'inventory' | 'similar'>(
		'model',
	);

	let isPenTablet = $derived(tablet.Model.Type === 'PENTABLET');
	let activeAreaW = $derived(tablet.Digitizer?.Dimensions?.Width ?? 0);
	let activeAreaH = $derived(tablet.Digitizer?.Dimensions?.Height ?? 0);
	let canShowForce = $derived(isPenTablet && activeAreaW > 0 && activeAreaH > 0);

	let penNameMap = $derived(buildPenNameMap(allPens));

	let includedPenItems = $derived(
		(tablet.Model.IncludedPen ?? []).map((id) => ({
			entityId: id,
			name: penNameMap.get(id) ?? id,
		})),
	);
</script>

<Nav />

<div class="title-row">
	<h1>{tabletBrandAndName(tablet)}</h1>
	<button
		class="flag-toggle"
		class:flagged={$flaggedTablets.includes(tablet.Meta.EntityId)}
		onclick={() => toggleFlag(tablet.Meta.EntityId)}
	>
		{$flaggedTablets.includes(tablet.Meta.EntityId) ? 'Unflag' : 'Flag'}
	</button>
	<button class="json-btn" onclick={() => (showJson = true)}>JSON</button>
</div>

{#if showJson}
	<JsonDialog entity={tablet} onclose={() => (showJson = false)} />
{/if}

<section class="basics">
	<dl class="basics-grid">
		<div class="basics-item">
			<dt>Brand</dt>
			<dd>
				<a href={resolve('/entity/[entityId]', { entityId: tablet.Model.Brand.toLowerCase() })}
					>{brandName(tablet.Model.Brand)}</a
				>
			</dd>
		</div>
		{#if family}
			<div class="basics-item">
				<dt>Family</dt>
				<dd>
					<a href={resolve('/entity/[entityId]', { entityId: family.EntityId })}
						>{family.FamilyName}</a
					>
				</dd>
			</div>
		{/if}
		<div class="basics-item">
			<dt>Model ID</dt>
			<dd>{tablet.Model.Id}</dd>
		</div>
		<div class="basics-item">
			<dt>Type</dt>
			<dd>{tablet.Model.Type}</dd>
		</div>
		{#if tablet.Model.LaunchYear}
			<div class="basics-item">
				<dt>Year</dt>
				<dd>{tablet.Model.LaunchYear}</dd>
			</div>
		{/if}
		{#if tablet.Model.Status}
			<div class="basics-item">
				<dt>Status</dt>
				<dd>{tablet.Model.Status}</dd>
			</div>
		{/if}
		{#if tablet.Model.Audience}
			<div class="basics-item">
				<dt>Audience</dt>
				<dd>{tablet.Model.Audience}</dd>
			</div>
		{/if}
		{#if includedPenItems.length > 0}
			<div class="basics-item">
				<dt>Included Pen</dt>
				<dd>
					{#each includedPenItems as pen, i (pen.entityId)}
						{#if i > 0},
						{/if}
						<a href={resolve('/entity/[entityId]', { entityId: pen.entityId })}>{pen.name}</a>
					{/each}
				</dd>
			</div>
		{/if}
	</dl>
</section>

<Tabs
	tabs={[
		{ id: 'model', label: 'Model' },
		{ id: 'specs', label: 'Specs' },
		{ id: 'size', label: 'Size Comparison' },
		{ id: 'force', label: 'Force Proportions', visible: canShowForce },
		{ id: 'pens', label: 'Compatible Pens' },
		{ id: 'inventory', label: 'Inventory', badge: inventoryUnits.length },
		{ id: 'similar', label: 'Similar Tablets' },
	] satisfies Tab[]}
	bind:active={activeTab}
/>

<section class="tab-content">
	{#if activeTab === 'model'}
		<TabletModelTab {tablet} {family} {includedPenItems} />
	{:else if activeTab === 'specs'}
		<TabletSpecsTab {tablet} {isoSizes} />
	{:else if activeTab === 'size'}
		<TabletSizeComparison {tablet} {allTablets} {isoSizes} />
	{:else if activeTab === 'force' && canShowForce}
		<ForceProportionsView width={activeAreaW} height={activeAreaH} />
	{:else if activeTab === 'pens'}
		<TabletCompatiblePensTab {tablet} {compatiblePens} />
	{:else if activeTab === 'inventory'}
		<TabletInventoryTab {inventoryUnits} />
	{:else if activeTab === 'similar'}
		<TabletSimilarTab {tablet} {allTablets} />
	{/if}
</section>

<style>
	.title-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 16px;
	}

	h1 {
		margin: 0;
	}

	.flag-toggle {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #d97706;
		border-radius: 4px;
		background: var(--bg-card);
		color: #d97706;
		cursor: pointer;
		font-weight: 600;
	}

	.flag-toggle:hover {
		background: #d97706;
		color: #fff;
	}

	.flag-toggle.flagged {
		background: #d97706;
		color: #fff;
	}

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

	.json-btn:hover {
		background: #6b7280;
		color: #fff;
	}

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

	.basics-item dd a:hover {
		text-decoration: underline;
	}

	.tab-content {
		margin-bottom: 24px;
	}
</style>
