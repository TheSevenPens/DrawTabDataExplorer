<script lang="ts">
	import { type AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import FieldPicker from '$lib/components/FieldPicker.svelte';
	import PopoverMenu from '$lib/components/PopoverMenu.svelte';
	import { moveItem } from '$lib/pill-dnd.js';
	import { fieldOptionLabelForKey } from '$lib/field-option-label.js';
	import {
		type PipelineSection,
		setPipelineFieldDragData,
		readPipelineFieldDragData,
		canAcceptPipelineFieldAt,
		clearPipelineFieldDrag,
		markPipelineCrossDropHandled,
	} from '$lib/query-builder/pipeline-field-drag.js';

	let {
		columns = $bindable(),
		fields,
		fieldGroups,
		isOpen,
		inline = false,
		pipelineSection,
		enableCrossSectionDrag = false,
		onCrossSectionDrop,
		onchange,
		ontoggle,
	}: {
		columns: string[];
		fields: AnyFieldDisplayDef[];
		fieldGroups: string[];
		isOpen: boolean;
		/** When true, render pills + picker inline (no toolbar toggle). */
		inline?: boolean;
		pipelineSection?: PipelineSection;
		enableCrossSectionDrag?: boolean;
		onCrossSectionDrop?: (field: string, source: PipelineSection) => void;
		onchange: () => void;
		ontoggle: () => void;
	} = $props();

	let showPicker = $state(false);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);
	let dragIndex: number | null = $state(null);
	let dragOverIndex: number | null = $state(null);
	let dragOverSide: 'left' | 'right' = $state('left');
	let crossDropTarget = $state(false);

	function getLabel(key: string) {
		return fieldOptionLabelForKey(key, fields);
	}

	function addField(key: string) {
		if (!columns.includes(key)) {
			columns.push(key);
			onchange();
		}
		showPicker = false;
	}

	function remove(index: number) {
		columns.splice(index, 1);
		onchange();
		contextMenu = null;
	}

	function removeGroup(index: number) {
		const col = columns[index];
		const field = fields.find((f) => f.key === col);
		if (!field) return;
		const groupKeys = new Set(fields.filter((f) => f.group === field.group).map((f) => f.key));
		columns = columns.filter((c) => !groupKeys.has(c));
		onchange();
		contextMenu = null;
	}

	function getGroupName(index: number) {
		return fields.find((f) => f.key === columns[index])?.group ?? '';
	}

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function onDragStart(e: DragEvent, index: number) {
		dragIndex = index;
		if (enableCrossSectionDrag && pipelineSection) {
			setPipelineFieldDragData(e, columns[index]!, pipelineSection);
		}
	}

	function onPanelDragEnter(e: DragEvent) {
		if (!enableCrossSectionDrag || !pipelineSection) return;
		if (!canAcceptPipelineFieldAt(pipelineSection)) return;
		e.preventDefault();
	}

	function onPanelDragOver(e: DragEvent) {
		if (!enableCrossSectionDrag || !pipelineSection) return;
		if (!canAcceptPipelineFieldAt(pipelineSection)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		crossDropTarget = true;
	}

	function onPanelDragLeave() {
		crossDropTarget = false;
	}

	function tryCrossSectionDrop(e: DragEvent): boolean {
		if (!enableCrossSectionDrag || !pipelineSection) return false;
		const data = readPipelineFieldDragData(e);
		if (!data || data.source === pipelineSection) return false;
		e.preventDefault();
		e.stopPropagation();
		crossDropTarget = false;
		markPipelineCrossDropHandled();
		onCrossSectionDrop?.(data.field, data.source);
		return true;
	}

	function onPanelDrop(e: DragEvent) {
		tryCrossSectionDrop(e);
	}

	function onDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const pct = (e.clientX - rect.left) / rect.width;
		if (pct < 0.35) {
			dragOverIndex = index;
			dragOverSide = 'left';
		} else if (pct > 0.65) {
			dragOverIndex = index;
			dragOverSide = 'right';
		} else if (dragOverIndex !== index) dragOverIndex = index;
	}

	function onDrop(e: DragEvent, index: number) {
		if (tryCrossSectionDrop(e)) {
			dragIndex = null;
			dragOverIndex = null;
			return;
		}
		if (dragIndex !== null && dragIndex !== index) {
			columns = moveItem(columns, dragIndex, index, dragOverSide);
			onchange();
		}
		dragIndex = null;
		dragOverIndex = null;
	}

	function onDragEnd() {
		// Columns are removed via context menu only; no drag-outside-to-remove
		dragIndex = null;
		dragOverIndex = null;
		crossDropTarget = false;
		clearPipelineFieldDrag();
	}
</script>

<div class="toolbar-item" class:inline>
	{#if !inline}
		<button class="toolbar-btn col-btn" class:open={isOpen} onclick={ontoggle}>
			Columns<span class="badge col-badge">{columns.length}</span>
		</button>
	{/if}

	{#if inline || isOpen}
		<div class="panel" class:inline-panel={inline} class:cross-drop-target={crossDropTarget}>
			<div
				class="panel-pills"
				ondragenter={onPanelDragEnter}
				ondragover={onPanelDragOver}
				ondragleave={onPanelDragLeave}
				ondrop={onPanelDrop}
				role="list"
			>
				{#each columns as col, i (col)}
					<button
						class="pill col-pill"
						class:dragging={dragIndex === i}
						class:gap-left={dragIndex !== null &&
							dragOverIndex === i &&
							dragOverSide === 'left' &&
							dragIndex !== i}
						class:gap-right={dragIndex !== null &&
							dragOverIndex === i &&
							dragOverSide === 'right' &&
							dragIndex !== i}
						draggable="true"
						oncontextmenu={(e) => onContextMenu(e, i)}
						ondragstart={(e) => onDragStart(e, i)}
						ondragover={(e) => onDragOver(e, i)}
						ondragleave={() => {}}
						ondrop={(e) => onDrop(e, i)}
						ondragend={onDragEnd}
						title={enableCrossSectionDrag
							? 'Right-click to remove. Drag to reorder or drop on Filters/Sort to add there.'
							: 'Right-click to remove. Drag to reorder.'}>{getLabel(col)}</button
					>
				{/each}
				<div class="add-wrapper" class:picker-open={showPicker} role="none">
					<button class="add-btn col-add" onclick={() => (showPicker = !showPicker)}>+</button>
					{#if showPicker}
						<FieldPicker
							{fields}
							{fieldGroups}
							exclude={columns}
							onselect={(key) => addField(key)}
							onselectgroup={(keys) => {
								for (const k of keys) addField(k);
							}}
							onremovegroup={(keys) => {
								const s = new Set(keys);
								columns = columns.filter((c) => !s.has(c));
								onchange();
							}}
							onclose={() => (showPicker = false)}
						/>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if contextMenu}
	{@const idx = contextMenu.index}
	<PopoverMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={[
			{ label: 'Remove', danger: true, onclick: () => remove(idx) },
			{ divider: true },
			{ label: `Remove all ${getGroupName(idx)}`, danger: true, onclick: () => removeGroup(idx) },
		]}
		onclose={() => (contextMenu = null)}
	/>
{/if}

<style>
	.toolbar-item {
		position: relative;
	}

	.toolbar-item.inline {
		position: static;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		font-size: 13px;
		min-height: 28px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		line-height: 1;
	}
	.toolbar-btn:hover,
	.toolbar-btn.open {
		border-color: var(--text-dim);
		color: var(--text);
		background: var(--hover-bg);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		font-size: 11px;
		font-weight: 600;
		border-radius: 9px;
		line-height: 1;
	}
	.col-badge {
		background: var(--border);
		color: var(--text-muted);
	}

	.panel {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 100;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		padding: 10px 12px;
		min-width: 260px;
	}

	.panel.inline-panel {
		position: static;
		border: none;
		box-shadow: none;
		padding: 0;
		min-width: 0;
		background: transparent;
	}

	.panel.cross-drop-target {
		outline: 2px dashed var(--link);
		outline-offset: 4px;
		border-radius: 6px;
	}
	.panel-pills {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		font-size: 13px;
		border-radius: 16px;
		cursor: pointer;
		color: var(--text);
		user-select: none;
	}
	.pill.dragging {
		opacity: 0.3;
	}
	.pill.gap-left {
		margin-left: 80px;
		transition: margin 0.15s ease;
	}
	.pill.gap-right {
		margin-right: 80px;
		transition: margin 0.15s ease;
	}

	.col-pill {
		background: var(--pill-col-bg);
		border: 1px solid var(--pill-col-border);
		cursor: grab;
		transition:
			opacity 0.15s,
			border-color 0.15s;
	}
	.col-pill:hover {
		background: var(--pill-col-hover);
		border-color: #86efac;
	}

	.add-btn {
		width: 26px;
		height: 26px;
		border: 1px dashed var(--border);
		border-radius: 50%;
		background: var(--bg-card);
		cursor: pointer;
		font-size: 14px;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.col-add:hover {
		border-color: #16a34a;
		color: #16a34a;
	}
	.add-wrapper {
		position: relative;
		z-index: 1;
	}

	.add-wrapper.picker-open {
		z-index: 200;
	}
</style>
