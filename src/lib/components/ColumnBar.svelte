<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';

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

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function onDragStart(index: number) {
		dragIndex = index;
	}

	function onDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function onDragLeave() {
		dragOverIndex = null;
	}

	function onDrop(index: number) {
		if (dragIndex !== null && dragIndex !== index) {
			const item = columns.splice(dragIndex, 1)[0]!;
			columns.splice(index, 0, item);
			onchange();
		}
		dragIndex = null;
		dragOverIndex = null;
	}

	function onDragEnd() {
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
				class:drag-over={dragOverIndex === i && dragIndex !== i}
				class:dragging={dragIndex === i}
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
				<div class="picker">
					{#if availableByGroup.length === 0}
						<div class="picker-empty">All fields added</div>
					{:else}
						{#each availableByGroup as { group, fields: groupFields }}
							<div class="picker-group-label">{group}</div>
							{#each groupFields as f}
								<button class="picker-item" onclick={() => addField(f.key)}>{f.label}</button>
							{/each}
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button class="delete" onclick={() => removeColumn(contextMenu!.index)}>Remove</button>
	</div>
{/if}

<style>
	.column-bar {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		min-height: 40px;
		margin-bottom: 16px;
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
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 16px;
		cursor: grab;
		color: #333;
		user-select: none;
		transition: opacity 0.15s, border-color 0.15s;
	}

	.pill:hover {
		background: #dcfce7;
		border-color: #86efac;
	}

	.pill.dragging {
		opacity: 0.4;
	}

	.pill.drag-over {
		border-color: #16a34a;
		box-shadow: -2px 0 0 0 #16a34a;
	}

	.add-wrapper {
		position: relative;
	}

	.add-btn {
		width: 26px;
		height: 26px;
		border: 1px dashed #aaa;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		font-size: 14px;
		color: #555;
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
		background: #fff;
		border: 1px solid #ddd;
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
		color: #888;
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
		color: #333;
	}

	.picker-item:hover {
		background: #f0f7ff;
	}

	.picker-empty {
		padding: 8px 12px;
		font-size: 13px;
		color: #999;
	}

	.context-menu {
		position: fixed;
		background: #fff;
		border: 1px solid #ddd;
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
</style>
