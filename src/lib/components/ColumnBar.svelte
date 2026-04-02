<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';
	import FieldPicker from '$lib/components/FieldPicker.svelte';

	let { columns = $bindable(), fields, fieldGroups, onchange }: {
		columns: string[];
		fields: FieldDef<any>[];
		fieldGroups: string[];
		onchange: () => void;
	} = $props();

	let showPicker = $state(false);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);
	let dragIndex: number | null = $state(null);
	let dragOverIndex: number | null = $state(null);
	let dragOverSide: 'left' | 'right' = $state('left');
	let droppedInside = false;

	function getLabel(key: string): string {
		return fields.find(f => f.key === key)?.label ?? key;
	}

	function addField(key: string) {
		if (!columns.includes(key)) {
			columns.push(key);
			onchange();
		}
		showPicker = false;
	}

	function removeColumn(index: number) {
		columns.splice(index, 1);
		onchange();
		contextMenu = null;
	}

	function removeGroup(index: number) {
		const col = columns[index];
		const field = fields.find(f => f.key === col);
		if (!field) return;
		const groupKeys = new Set(fields.filter(f => f.group === field.group).map(f => f.key));
		columns = columns.filter(c => !groupKeys.has(c));
		onchange();
		contextMenu = null;
	}

	function getGroupName(index: number): string {
		const col = columns[index];
		const field = fields.find(f => f.key === col);
		return field?.group ?? '';
	}

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function onDragStart(index: number) {
		dragIndex = index;
		droppedInside = false;
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
		} else if (dragOverIndex !== index) {
			dragOverIndex = index;
		}
	}

	function onDragLeave() {
	}

	function onDrop(index: number) {
		droppedInside = true;
		if (dragIndex !== null && dragIndex !== index) {
			const item = columns.splice(dragIndex, 1)[0]!;
			let insertAt = dragOverSide === 'right' ? index + 1 : index;
			if (dragIndex < index) insertAt--;
			columns.splice(Math.max(0, insertAt), 0, item);
			onchange();
		}
		dragIndex = null;
		dragOverIndex = null;
	}

	function onDragEnd() {
		if (!droppedInside && dragIndex !== null) {
			columns.splice(dragIndex, 1);
			onchange();
		}
		dragIndex = null;
		dragOverIndex = null;
	}

	let availableByGroup = $derived.by(() => {
		const inColumns = new Set(columns);
		const groups: { group: string; fields: FieldDef<any>[] }[] = [];
		for (const group of fieldGroups) {
			const available = fields.filter(f => f.group === group && !inColumns.has(f.key));
			if (available.length > 0) {
				groups.push({ group, fields: available });
			}
		}
		return groups;
	});
</script>

<svelte:window onclick={closeContextMenu} />

<div class="column-bar">
	<span class="column-label">columns</span>
	<div class="pills">
		{#each columns as col, i}
			<button
				class="pill"
				class:dragging={dragIndex === i}
				class:gap-left={dragIndex !== null && dragOverIndex === i && dragOverSide === 'left' && dragIndex !== i}
				class:gap-right={dragIndex !== null && dragOverIndex === i && dragOverSide === 'right' && dragIndex !== i}
				draggable="true"
				oncontextmenu={(e) => onContextMenu(e, i)}
				ondragstart={() => onDragStart(i)}
				ondragover={(e) => onDragOver(e, i)}
				ondragleave={onDragLeave}
				ondrop={() => onDrop(i)}
				ondragend={onDragEnd}
				title="Right-click to remove. Drag to reorder."
			>
				{getLabel(col)}
			</button>
		{/each}
		<div class="add-wrapper">
			<button class="add-btn" onclick={() => showPicker = !showPicker}>+</button>
			{#if showPicker}
				<FieldPicker
					{fields}
					{fieldGroups}
					exclude={columns}
					onselect={(key) => { addField(key); }}
					onselectgroup={(keys) => { for (const k of keys) addField(k); }}
				onremovegroup={(keys) => { const removeSet = new Set(keys); columns = columns.filter(c => !removeSet.has(c)); onchange(); }}
					onclose={() => showPicker = false}
				/>
			{/if}
		</div>
	</div>
</div>

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button class="delete" onclick={() => removeColumn(contextMenu!.index)}>Remove</button>
		<hr />
		<button class="delete" onclick={() => removeGroup(contextMenu!.index)}>Remove all {getGroupName(contextMenu.index)}</button>
	</div>
{/if}

<style>
	.column-bar {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		min-height: 40px;
		margin-bottom: 12px;
	}

	.column-label {
		font-weight: 600;
		color: #6b21a8;
		min-width: 60px;
		padding-top: 2px;
	}

	.pills {
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
		background: var(--pill-col-bg);
		border: 1px solid var(--pill-col-border);
		border-radius: 16px;
		cursor: grab;
		color: var(--text);
		user-select: none;
		transition: opacity 0.15s, border-color 0.15s;
	}

	.pill:hover {
		background: var(--pill-col-hover);
		border-color: #86efac;
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

	.add-wrapper {
		position: relative;
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
	}

	.add-btn:hover {
		border-color: #16a34a;
		color: #16a34a;
	}

	.picker {
		position: absolute;
		top: 32px;
		left: 0;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.1);
		z-index: 100;
		max-height: 400px;
		overflow-y: auto;
		min-width: 200px;
	}

	.picker-group-label {
		padding: 6px 12px 2px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.picker-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 5px 12px 5px 20px;
		font-size: 13px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--text);
	}

	.picker-item:hover {
		background: var(--hover-bg);
	}

	.picker-empty {
		padding: 8px 12px;
		font-size: 13px;
		color: var(--text-dim);
	}

	.context-menu {
		position: fixed;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		z-index: 200;
		min-width: 120px;
	}

	.context-menu button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 6px 12px;
		font-size: 13px;
		border: none;
		background: none;
		cursor: pointer;
	}

	.context-menu button.delete {
		color: #e11d48;
	}

	.context-menu button.delete:hover {
		background: #fef2f2;
	}

	.context-menu hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 2px 0;
	}
</style>
