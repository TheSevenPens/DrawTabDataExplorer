<script lang="ts">
	import { type AnyFieldDef } from '$data/lib/pipeline/index.js';
	import FieldPicker from '$lib/components/FieldPicker.svelte';

	let {
		columns = $bindable(),
		fields,
		fieldGroups,
		isOpen,
		onchange,
		ontoggle,
	}: {
		columns: string[];
		fields: AnyFieldDef[];
		fieldGroups: string[];
		isOpen: boolean;
		onchange: () => void;
		ontoggle: () => void;
	} = $props();

	let showPicker = $state(false);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);
	let dragIndex: number | null = $state(null);
	let dragOverIndex: number | null = $state(null);
	let dragOverSide: 'left' | 'right' = $state('left');

	function getLabel(key: string) { return fields.find(f => f.key === key)?.label ?? key; }

	function addField(key: string) {
		if (!columns.includes(key)) { columns.push(key); onchange(); }
		showPicker = false;
	}

	function remove(index: number) { columns.splice(index, 1); onchange(); contextMenu = null; }

	function removeGroup(index: number) {
		const col = columns[index];
		const field = fields.find(f => f.key === col);
		if (!field) return;
		const groupKeys = new Set(fields.filter(f => f.group === field.group).map(f => f.key));
		columns = columns.filter(c => !groupKeys.has(c));
		onchange();
		contextMenu = null;
	}

	function getGroupName(index: number) { return fields.find(f => f.key === columns[index])?.group ?? ''; }

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function onDragStart(index: number) { dragIndex = index; }

	function onDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const pct = (e.clientX - rect.left) / rect.width;
		if (pct < 0.35) { dragOverIndex = index; dragOverSide = 'left'; }
		else if (pct > 0.65) { dragOverIndex = index; dragOverSide = 'right'; }
		else if (dragOverIndex !== index) dragOverIndex = index;
	}

	function onDrop(index: number) {
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
		// Columns are removed via context menu only; no drag-outside-to-remove
		dragIndex = null;
		dragOverIndex = null;
	}
</script>

<svelte:window onclick={() => contextMenu = null} />

<div class="toolbar-item">
	<button
		class="toolbar-btn col-btn"
		class:open={isOpen}
		onclick={ontoggle}
	>
		Columns<span class="badge col-badge">{columns.length}</span>
	</button>

	{#if isOpen}
		<div class="panel">
			<div class="panel-pills">
				{#each columns as col, i}
					<button
						class="pill col-pill"
						class:dragging={dragIndex === i}
						class:gap-left={dragIndex !== null && dragOverIndex === i && dragOverSide === 'left' && dragIndex !== i}
						class:gap-right={dragIndex !== null && dragOverIndex === i && dragOverSide === 'right' && dragIndex !== i}
						draggable="true"
						oncontextmenu={(e) => onContextMenu(e, i)}
						ondragstart={() => onDragStart(i)}
						ondragover={(e) => onDragOver(e, i)}
						ondragleave={() => {}}
						ondrop={() => onDrop(i)}
						ondragend={onDragEnd}
						title="Right-click to remove. Drag to reorder."
					>{getLabel(col)}</button>
				{/each}
				<div class="add-wrapper" role="none">
					<button class="add-btn col-add" onclick={() => showPicker = !showPicker}>+</button>
					{#if showPicker}
						<FieldPicker
							{fields}
							{fieldGroups}
							exclude={columns}
							onselect={(key) => addField(key)}
							onselectgroup={(keys) => { for (const k of keys) addField(k); }}
							onremovegroup={(keys) => { const s = new Set(keys); columns = columns.filter(c => !s.has(c)); onchange(); }}
							onclose={() => showPicker = false}
						/>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button class="delete" onclick={() => remove(contextMenu!.index)}>Remove</button>
		<hr />
		<button class="delete" onclick={() => removeGroup(contextMenu!.index)}>Remove all {getGroupName(contextMenu.index)}</button>
	</div>
{/if}

<style>
	.toolbar-item { position: relative; }

	.toolbar-btn {
		display: inline-flex; align-items: center; gap: 5px;
		padding: 5px 10px; font-size: 13px; min-height: 28px;
		border: 1px solid var(--border); border-radius: 4px;
		background: var(--bg-card); color: var(--text-muted);
		cursor: pointer; white-space: nowrap; line-height: 1;
	}
	.toolbar-btn:hover, .toolbar-btn.open { border-color: var(--text-dim); color: var(--text); background: var(--hover-bg); }

	.badge {
		display: inline-flex; align-items: center; justify-content: center;
		min-width: 18px; height: 18px; padding: 0 4px;
		font-size: 11px; font-weight: 600; border-radius: 9px; line-height: 1;
	}
	.col-badge { background: var(--border); color: var(--text-muted); }

	.panel {
		position: absolute; top: calc(100% + 4px); left: 0; z-index: 100;
		background: var(--bg-card); border: 1px solid var(--border-light);
		border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);
		padding: 10px 12px; min-width: 260px;
	}
	.panel-pills { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

	.pill {
		display: inline-flex; align-items: center; padding: 3px 10px;
		font-size: 13px; border-radius: 16px; cursor: pointer; color: var(--text); user-select: none;
	}
	.pill.dragging { opacity: 0.3; }
	.pill.gap-left  { margin-left: 80px; transition: margin 0.15s ease; }
	.pill.gap-right { margin-right: 80px; transition: margin 0.15s ease; }

	.col-pill { background: var(--pill-col-bg); border: 1px solid var(--pill-col-border); cursor: grab; transition: opacity 0.15s, border-color 0.15s; }
	.col-pill:hover { background: var(--pill-col-hover); border-color: #86efac; }

	.add-btn {
		width: 26px; height: 26px; border: 1px dashed var(--border); border-radius: 50%;
		background: var(--bg-card); cursor: pointer; font-size: 14px;
		color: var(--text-muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	}
	.col-add:hover { border-color: #16a34a; color: #16a34a; }
	.add-wrapper { position: relative; }

	.context-menu {
		position: fixed; background: var(--bg-card); border: 1px solid var(--border-light);
		border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 200; min-width: 150px;
	}
	.context-menu button {
		display: block; width: 100%; text-align: left; padding: 6px 12px;
		font-size: 13px; border: none; background: none; cursor: pointer; color: var(--text);
	}
	.context-menu button:hover { background: var(--hover-bg); }
	.context-menu button.delete { color: #e11d48; }
	.context-menu button.delete:hover { background: #fef2f2; }
	.context-menu hr { border: none; border-top: 1px solid var(--border); margin: 2px 0; }
</style>
