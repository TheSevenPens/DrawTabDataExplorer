<script lang="ts">
	import { type AnyFieldDisplayDef, getFieldDef } from '@thesevenpens/queriton';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import type { CellLinks } from '$lib/table-types.js';

	let {
		data,
		visibleFields,
		fields,
		detailBasePath = '',
		linkField = 'EntityId',
		cellLinks = {},
		columnWidths = $bindable({}),
		onwidthchange,
		flaggedIds,
		onToggleFlag,
	}: {
		// Heterogeneous entity rows — see EntityExplorer / table-types.ts (#221).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: any[];
		visibleFields: string[];
		fields: AnyFieldDisplayDef[];
		detailBasePath?: string;
		linkField?: string;
		cellLinks?: CellLinks;
		columnWidths?: Record<string, number>;
		onwidthchange?: () => void;
		flaggedIds?: Set<string>;
		onToggleFlag?: (entityId: string) => void;
	} = $props();

	let showFlags = $derived(!!flaggedIds && !!onToggleFlag);

	let fieldDefs = $derived(
		visibleFields.map((k) => getFieldDef(k, fields)).filter((f) => f !== undefined),
	);

	let resizing: { key: string; startX: number; startWidth: number } | null = $state(null);

	function onResizeStart(e: MouseEvent, key: string, th: HTMLElement) {
		e.preventDefault();
		const startWidth = th.offsetWidth;
		resizing = { key, startX: e.clientX, startWidth };

		const onMouseMove = (e: MouseEvent) => {
			if (!resizing) return;
			const diff = e.clientX - resizing.startX;
			const newWidth = Math.max(40, resizing.startWidth + diff);
			columnWidths[resizing.key] = newWidth;
		};

		const onMouseUp = () => {
			resizing = null;
			onwidthchange?.();
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}
</script>

<div class="table-wrap">
	<table style="table-layout: {Object.keys(columnWidths).length > 0 ? 'fixed' : 'auto'};">
		<thead>
			<tr>
				{#if showFlags}
					<th class="flag-col"></th>
				{/if}
				{#each fieldDefs as f (f.key)}
					<th style={columnWidths[f.key] ? `width: ${columnWidths[f.key]}px` : ''}>
						<div class="th-content">
							<span>{getFieldLabel(f.label, f.unit, $unitPreference)}</span>
							<!-- Mouse-drag-only column resize. Keyboard-driven resize would need
								 a separate focus + arrow-key model; out of scope here. -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="resize-handle"
								onmousedown={(e) => {
									const th = (e.target as HTMLElement).closest('th');
									if (th) onResizeStart(e, f.key, th);
								}}
							></div>
						</div>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data as item, i (i)}
				<tr>
					{#if showFlags}
						{@const eid = item.Meta?.EntityId ?? item.EntityId ?? item.InventoryId ?? ''}
						<td class="flag-col">
							<FlagButton
								compact
								flagged={flaggedIds!.has(eid)}
								onclick={() => onToggleFlag!(eid)}
							/>
						</td>
					{/if}
					{#each fieldDefs as f (f.key)}
						{@const val = f.getValue(item)}
						{@const displayVal = f.getDisplayValue
							? f.getDisplayValue(item)
							: formatValue(val, f.unit, $unitPreference)}
						{#if cellLinks[f.key]}
							{@const links = cellLinks[f.key](item)}
							<td class:dim={links.length === 0}>
								{#each links as link, i (i)}
									{#if i > 0},
									{/if}
									<!-- link.href is constructed by the caller (with base or resolve) -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a class="entity-link" href={link.href}>{link.label}</a>
								{/each}
							</td>
						{:else if f.key === linkField && detailBasePath}
							{@const entityId = item.Meta?.EntityId ?? item.EntityId ?? val}
							{@const linkHref =
								`${base}${detailBasePath}/${encodeURIComponent(entityId)}` as ResolvedPathname}
							<td>
								<a class="entity-link" href={linkHref}>{displayVal}</a>
							</td>
						{:else}
							<td class:dim={!val || val === '-'}>{displayVal}</td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.entity-link {
		color: var(--link);
		text-decoration: none;
	}

	.entity-link:hover {
		text-decoration: underline;
	}

	.th-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}

	.resize-handle {
		width: 4px;
		height: 100%;
		min-height: 16px;
		cursor: col-resize;
		flex-shrink: 0;
		border-right: 2px solid transparent;
	}

	.resize-handle:hover {
		border-right-color: var(--link);
	}

	td {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.flag-col {
		width: 28px;
		padding: 0 2px;
		text-align: center;
	}
</style>
