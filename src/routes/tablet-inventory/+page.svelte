<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		INVENTORY_TABLET_FIELDS,
		INVENTORY_TABLET_FIELD_GROUPS,
		INVENTORY_TABLET_DEFAULT_COLUMNS,
		INVENTORY_TABLET_DEFAULT_VIEW,
		type InventoryTablet,
	} from '$data/lib/entities/inventory-tablet-fields.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';
	import { inventoryTabletCellLinks } from '$lib/inventory-cell-links.js';
	import { groupByOrderDate } from '$lib/inventory-timeline.js';
	import { tabletSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let tabletTabs = $derived(tabletSubNavTabs({ flaggedCount: $flaggedCount }));

	// Units (the explorer) or Timeline — when each unit was ordered (#80).
	let activeTab = $state('units');
	let timeline = $derived(groupByOrderDate(data.tablets));

	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const TYPE_LABELS: Record<string, string> = {
		PENTABLET: 'Pen tablet',
		PENDISPLAY: 'Pen display',
		STANDALONE: 'Standalone',
	};
	const day = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? String(Number(d.slice(8))) : '');
	const model = (u: InventoryTablet) => data.modelById.get(u.TabletEntityId);
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<Tabs
	tabs={[
		{ id: 'units', label: 'Units', badge: data.tablets.length },
		{ id: 'timeline', label: 'Timeline' },
	]}
	bind:active={activeTab}
/>

{#if activeTab === 'units'}
	<EntityExplorer
		title="Tablet Inventory (sevenpens)"
		entityType="inventory-tablets"
		entityLabel="tablets"
		data={data.tablets}
		fields={INVENTORY_TABLET_FIELDS}
		fieldGroups={INVENTORY_TABLET_FIELD_GROUPS}
		defaultColumns={INVENTORY_TABLET_DEFAULT_COLUMNS}
		defaultView={INVENTORY_TABLET_DEFAULT_VIEW}
		defaultFilterField="Brand"
		quickFilterFields={['Brand']}
		cellLinks={inventoryTabletCellLinks(data.tabletNameMap)}
	/>
{:else}
	<h1 class="sr-only">Tablet inventory timeline</h1>
	{#if timeline.years.length === 0 && timeline.undated.length === 0}
		<EmptyState>No tablets in the inventory.</EmptyState>
	{/if}
	{#snippet unitRow(u: InventoryTablet, when: string)}
		<li class="unit">
			<span class="when">{when}</span>
			<span class="model">
				<a href={resolve('/entity/[entityId]', { entityId: u.TabletEntityId })}
					>{model(u)?.label ?? u.ModelName ?? u.TabletEntityId}</a
				>
			</span>
			<a class="unit-id" href={resolve('/tablet-inventory/[id]', { id: u._id })}>{u.InventoryId}</a>
			<span class="meta">{TYPE_LABELS[model(u)?.type ?? u.TabletType] ?? u.TabletType}</span>
			<span class="meta">{u.Vendor}</span>
		</li>
	{/snippet}
	<div class="timeline">
		{#each timeline.years as y (y.year)}
			<section class="year">
				<h2>{y.year} <span class="count">{y.count}</span></h2>
				{#each y.months as m (m.month)}
					<h3>{m.month ? MONTHS[m.month - 1] : 'Month unknown'}</h3>
					<ul>
						{#each m.units as u (u._id)}
							{@render unitRow(u, day(u.OrderDate))}
						{/each}
					</ul>
				{/each}
			</section>
		{/each}
		{#if timeline.undated.length > 0}
			<section class="year">
				<h2>Order date unknown <span class="count">{timeline.undated.length}</span></h2>
				<ul>
					{#each timeline.undated as u (u._id)}
						{@render unitRow(u, '')}
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}

<style>
	.timeline {
		max-width: 960px;
	}

	.year {
		margin-bottom: 28px;
	}

	h2 {
		margin: 0 0 4px;
		font-size: var(--type-heading);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-tight);
		color: var(--text);
	}

	.count {
		font-size: var(--type-caption);
		color: var(--text-dim);
		letter-spacing: normal;
	}

	h3 {
		margin: 12px 0 4px;
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-muted);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* One line per unit: day, model, unit id, type, vendor — aligned columns
	   without a table's chrome. */
	.unit {
		display: grid;
		grid-template-columns: 2.5ch minmax(0, 1fr) 9ch 11ch 12ch;
		gap: 12px;
		align-items: baseline;
		padding: 3px 0;
		font-size: var(--type-body);
		border-bottom: 1px solid var(--border);
	}

	.when {
		text-align: right;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}

	.model {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.model a,
	.unit-id {
		color: var(--text);
		text-decoration: none;
	}

	.model a:hover,
	.unit-id:hover {
		color: var(--accent);
	}

	.unit-id {
		font-variant-numeric: tabular-nums;
	}

	.meta {
		color: var(--text-muted);
		font-size: var(--type-caption);
	}

	@media (max-width: 640px) {
		.unit {
			grid-template-columns: 2.5ch minmax(0, 1fr) 9ch;
		}
		.meta {
			display: none;
		}
	}
</style>
