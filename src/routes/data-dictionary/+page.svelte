<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import { BRAND_FIELDS } from '$data/lib/entities/brand-fields.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { TABLET_FAMILY_FIELDS } from '$data/lib/entities/tablet-family-fields.js';
	import { PEN_FIELDS } from '$data/lib/entities/pen-fields.js';
	import { PEN_FAMILY_FIELDS } from '$data/lib/entities/pen-family-fields.js';
	import { DRIVER_FIELDS } from '$data/lib/entities/driver-fields.js';
	import { PEN_COMPAT_FIELDS } from '$data/lib/entities/pen-compat-fields.js';
	import { PRESSURE_RESPONSE_FIELDS } from '$data/lib/entities/pressure-response-fields.js';
	import { INVENTORY_PEN_FIELDS } from '$data/lib/entities/inventory-pen-fields.js';
	import { INVENTORY_TABLET_FIELDS } from '$data/lib/entities/inventory-tablet-fields.js';

	const dataTabs = dataSubNavTabs();

	interface EntityDef {
		id: string;
		category: string;
		label: string;
		fields: AnyFieldDisplayDef[];
	}

	const entityDefs: EntityDef[] = [
		{ id: 'brands', category: 'Core', label: 'Brands', fields: BRAND_FIELDS },
		{ id: 'tablets', category: 'Core', label: 'Tablets', fields: TABLET_FIELDS },
		{
			id: 'tablet-families',
			category: 'Core',
			label: 'Tablet Families',
			fields: TABLET_FAMILY_FIELDS,
		},
		{ id: 'pens', category: 'Core', label: 'Pens', fields: PEN_FIELDS },
		{ id: 'pen-families', category: 'Core', label: 'Pen Families', fields: PEN_FAMILY_FIELDS },
		{ id: 'drivers', category: 'Core', label: 'Drivers', fields: DRIVER_FIELDS },
		{
			id: 'pen-compat',
			category: 'Relationships',
			label: 'Pen Compatibility',
			fields: PEN_COMPAT_FIELDS,
		},
		{
			id: 'pressure-response',
			category: 'Pressure',
			label: 'Pressure Response',
			fields: PRESSURE_RESPONSE_FIELDS,
		},
		{
			id: 'inventory-pens',
			category: 'Inventory',
			label: 'Inventory Pens',
			fields: INVENTORY_PEN_FIELDS,
		},
		{
			id: 'inventory-tablets',
			category: 'Inventory',
			label: 'Inventory Tablets',
			fields: INVENTORY_TABLET_FIELDS,
		},
	];

	const entityIds = new Set(entityDefs.map((e) => e.id));
	const defaultEntity = 'brands';

	const groupedEntities: [string, EntityDef[]][] = (() => {
		const map = new Map<string, EntityDef[]>();
		for (const e of entityDefs) {
			if (!map.has(e.category)) map.set(e.category, []);
			map.get(e.category)!.push(e);
		}
		return [...map.entries()];
	})();

	let activeEntity: string = $derived.by(() => {
		const hash = page.url.hash.slice(1);
		return entityIds.has(hash) ? hash : defaultEntity;
	});

	let activeDef: EntityDef = $derived(
		entityDefs.find((e) => e.id === activeEntity) ?? entityDefs[0],
	);

	function setEntity(id: string) {
		// page.url.pathname is already resolved (includes base path).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}#${id}`, {
			replaceState: false,
			noScroll: true,
		});
	}

	function fieldsByGroup(fields: AnyFieldDisplayDef[]): [string, AnyFieldDisplayDef[]][] {
		const map = new Map<string, AnyFieldDisplayDef[]>();
		for (const f of fields) {
			if (!map.has(f.group)) map.set(f.group, []);
			map.get(f.group)!.push(f);
		}
		return [...map.entries()];
	}

	function formatType(f: AnyFieldDisplayDef): string {
		if (f.type === 'enum' && f.enumValues && f.enumValues.length > 0) {
			return `enum (${f.enumValues.length})`;
		}
		return f.type;
	}
</script>

<Nav />
<SubNav tabs={dataTabs} />
<h1 class="sr-only">Data Dictionary</h1>

<div class="dict-layout">
	<nav class="dict-tree" aria-label="Entity types">
		{#each groupedEntities as [category, items] (category)}
			<div class="tree-cat">
				<div class="tree-cat-label">{category}</div>
				<ul>
					{#each items as item (item.id)}
						<li>
							<button
								type="button"
								class:active={activeEntity === item.id}
								onclick={() => setEntity(item.id)}
							>
								<span class="tree-label">{item.label}</span>
								<span class="tree-count">{item.fields.length}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<main class="dict-content">
		<section>
			<div class="section-header">
				<h2>{activeDef.label}</h2>
				<span class="section-meta">{activeDef.fields.length} fields</span>
			</div>

			{#each fieldsByGroup(activeDef.fields) as [groupName, groupFields] (groupName)}
				<div class="group-header">
					<h3>{groupName}</h3>
					<span class="group-meta">{groupFields.length} fields</span>
				</div>
				<table class="dict-table">
					<thead>
						<tr>
							<th>Key</th>
							<th>Label</th>
							<th>Type</th>
							<th>Unit</th>
							<th class="flag-col">Computed</th>
							<th>Enum values</th>
						</tr>
					</thead>
					<tbody>
						{#each groupFields as f (f.key)}
							<tr>
								<td class="mono">{f.key}</td>
								<td>{f.label}</td>
								<td>{formatType(f)}</td>
								<td>{f.unit ?? ''}</td>
								<td class="flag-col">{f.computed ? '✓' : ''}</td>
								<td class="enum-cell">
									{#if f.type === 'enum' && f.enumValues}
										<span class="dim">{f.enumValues.join(', ')}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/each}
		</section>
	</main>
</div>

<style>
	.dict-layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.dict-tree {
		flex: 0 0 240px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-right: 1px solid var(--border);
		padding: 4px 12px 4px 0;
		font-size: 13px;
	}

	.dict-content {
		flex: 1;
		min-width: 0;
	}

	.tree-cat {
		margin-bottom: 14px;
	}

	.tree-cat-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		padding: 0 8px;
		margin-bottom: 4px;
	}

	.tree-cat ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tree-cat li {
		margin: 0;
	}

	.tree-cat button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 5px 10px;
		font-size: 13px;
		text-align: left;
		border: 1px solid transparent;
		/* Reserved up-front so the active accent edge doesn't shift the tree. */
		border-left: 2px solid transparent;
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1.3;
	}

	/* Mirrors SectionedPage: bright label + accent edge rather than a
	   tinted block, which also retires the per-theme colour overrides. */
	.tree-cat button:hover {
		background: var(--hover-bg);
		color: var(--text);
	}

	.tree-cat button.active {
		background: transparent;
		border-left-color: var(--accent);
		color: var(--text);
		font-weight: 600;
	}

	.tree-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tree-count {
		font-size: 11px;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}

	section {
		margin-bottom: 24px;
	}

	.section-header {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	h2 {
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.section-meta,
	.group-meta {
		font-size: 12px;
		color: var(--text-muted);
	}

	.group-header {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 20px 0 6px;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--border);
	}

	.group-header h3 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin: 0;
	}

	.dict-table {
		border-collapse: collapse;
		font-size: 13px;
		width: 100%;
	}

	.dict-table th,
	.dict-table td {
		padding: 4px 12px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}

	.dict-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
	}

	.flag-col {
		text-align: center;
		width: 80px;
	}

	.enum-cell {
		max-width: 360px;
		white-space: normal;
		font-size: 12px;
		line-height: 1.4;
	}

	.dim {
		color: var(--text-dim);
	}
</style>
