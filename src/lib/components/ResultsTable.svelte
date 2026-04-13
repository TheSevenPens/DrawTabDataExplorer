<script lang="ts">
	import { type FieldDef, getFieldDef } from '$data/lib/pipeline/index.js';
	import { base } from '$app/paths';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';

	let { data, visibleFields, fields, total, entityLabel = "records", detailBasePath = "", columnWidths = $bindable({}), onwidthchange, flaggedIds, onToggleFlag }: {
		data: any[];
		visibleFields: string[];
		fields: FieldDef<any>[];
		total: number;
		entityLabel?: string;
		detailBasePath?: string;
		columnWidths?: Record<string, number>;
		onwidthchange?: () => void;
		flaggedIds?: Set<string>;
		onToggleFlag?: (entityId: string) => void;
	} = $props();

	let showFlags = $derived(!!flaggedIds && !!onToggleFlag);

	let fieldDefs = $derived(
		visibleFields.map((k) => getFieldDef(k, fields)).filter((f) => f !== undefined)
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
				{#each fieldDefs as f}
					<th
						style={columnWidths[f.key] ? `width: ${columnWidths[f.key]}px` : ''}
					>
						<div class="th-content">
							<span>{getFieldLabel(f.label, f.unit, $unitPreference)}</span>
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
			{#each data as item}
				<tr>
					{#if showFlags}
						{@const eid = item.Meta?.EntityId ?? item.EntityId ?? ''}
						<td class="flag-col">
							<button
								class="flag-btn"
								class:flagged={flaggedIds!.has(eid)}
								onclick={() => onToggleFlag!(eid)}
								title={flaggedIds!.has(eid) ? 'Unflag' : 'Flag for comparison'}
							>{flaggedIds!.has(eid) ? '\u2691' : '\u2690'}</button>
						</td>
					{/if}
					{#each fieldDefs as f}
						{@const val = f.getValue(item)}
						{@const displayVal = formatValue(val, f.unit, $unitPreference)}
						{#if f.key === 'EntityId' && detailBasePath && val}
							<td><a class="entity-link" href="{base}{detailBasePath}/{encodeURIComponent(val)}">{val}</a></td>
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

	.flag-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: var(--text-dim);
		padding: 0;
		line-height: 1;
	}

	.flag-btn.flagged {
		color: #d97706;
	}

	.flag-btn:hover {
		color: #d97706;
	}
</style>
