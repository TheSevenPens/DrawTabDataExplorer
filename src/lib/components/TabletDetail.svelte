<script lang="ts">
	import EntityLink from '$lib/components/EntityLink.svelte';
	import { brandName, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import DetailPageFrame from '$lib/components/DetailPageFrame.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import { type TabletFamily } from '$data/lib/entities/tablet-family-fields.js';
	import type { InventoryTablet } from '$data/lib/entities/inventory-tablet-fields.js';
	import TabletSizeComparison from '$lib/components/TabletSizeComparison.svelte';
	import ForceProportionsView from '$lib/components/ForceProportionsView.svelte';
	import { flaggedTablets, toggleFlag } from '$lib/flagged-store.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import { buildPenNameMap } from '$lib/pen-helpers.js';
	import JsonTab from '$lib/components/JsonTab.svelte';
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

	let activeTab = $state<
		'model' | 'specs' | 'size' | 'force' | 'pens' | 'inventory' | 'similar' | 'json'
	>('model');

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

<DetailPageFrame title={tabletFullName(tablet)}>
	{#snippet actions()}
		<FlagButton
			flagged={$flaggedTablets.includes(tablet.Meta.EntityId)}
			onclick={() => toggleFlag(tablet.Meta.EntityId)}
			label="Flag this tablet for comparison"
		/>
	{/snippet}
</DetailPageFrame>

<section class="basics">
	<dl class="basics-grid">
		<div class="basics-item">
			<dt>Brand</dt>
			<dd>
				<EntityLink entityId={tablet.Model.Brand.toLowerCase()}
					>{brandName(tablet.Model.Brand)}</EntityLink
				>
			</dd>
		</div>
		{#if family}
			<div class="basics-item">
				<dt>Family</dt>
				<dd>
					<EntityLink entityId={family.EntityId}>{family.FamilyName}</EntityLink>
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
						<EntityLink entityId={pen.entityId}>{pen.name}</EntityLink>
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
		{ id: 'json', label: 'JSON' },
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
		<TabletCompatiblePensTab
			{tablet}
			{compatiblePens}
			inventoryPenCounts={data.inventoryPenCounts ?? new Map()}
		/>
	{:else if activeTab === 'inventory'}
		<TabletInventoryTab {inventoryUnits} />
	{:else if activeTab === 'similar'}
		<TabletSimilarTab {tablet} {allTablets} />
	{:else if activeTab === 'json'}
		<JsonTab entity={tablet} />
	{/if}
</section>

<style>
	/* Matches PenDetail: no card, just space and a hairline. */
	.basics {
		margin-bottom: 20px;
		padding: 0 0 16px;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		border-radius: var(--radius);
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
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-dim);
		margin-bottom: 3px;
	}

	.basics-item dd {
		font-size: var(--type-subhead);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-tight);
		color: var(--text);
	}

	.tab-content {
		margin-bottom: 24px;
	}
</style>
