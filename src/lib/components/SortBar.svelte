<script lang="ts">
	import { type AnyFieldDef } from '$data/lib/pipeline/index.js';
	import FieldPicker from '$lib/components/FieldPicker.svelte';

	interface SortItem {
		field: string;
		direction: 'asc' | 'desc';
	}

	let {
		sorts = $bindable(),
		fields,
		fieldGroups,
		isOpen,
		onchange,
		ontoggle,
	}: {
		sorts: SortItem[];
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
	let droppedInside = false;

	function getLabel(key: string) {
		return fields.find((f) => f.key === key)?.label ?? key;
	}

	function addField(key: string) {
		if (!sorts.some((s) => s.field === key)) {
			sorts.push({ field: key, direction: 'asc' });
			onchange();
		}
		showPicker = false;
	}

	function toggleDirection(index: number) {
		const item = sorts[index];
		if (item) {
			item.direction = item.direction === 'asc' ? 'desc' : 'asc';
			onchange();
		}
	}

	function remove(index: number) {
		sorts.splice(index, 1);
		onchange();
		contextMenu = null;
	}

	function setDirection(index: number, dir: 'asc' | 'desc') {
		const item = sorts[index];
		if (item) {
			item.direction = dir;
			onchange();
		}
		contextMenu = null;
	}

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
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
		} else if (dragOverIndex !== index) dragOverIndex = index;
	}

	function onDrop(index: number) {
		droppedInside = true;
		if (dragIndex !== null && dragIndex !== index) {
			const item = sorts.splice(dragIndex, 1)[0]!;
			let insertAt = dragOverSide === 'right' ? index + 1 : index;
			if (dragIndex < index) insertAt--;
			sorts.splice(Math.max(0, insertAt), 0, item);
			onchange();
		}
		dragIndex = null;
		dragOverIndex = null;
	}

	function onDragEnd() {
		if (!droppedInside && dragIndex !== null) {
			sorts.splice(dragIndex, 1);
			onchange();
		}
		dragIndex = null;
		dragOverIndex = null;
	}
</script>

<svelte:window onclick={() => (contextMenu = null)} />

<div class="toolbar-item">
	<button
		class="toolbar-btn sort-btn"
		class:has-active={sorts.length > 0}
		class:open={isOpen}
		onclick={ontoggle}
	>
		Sort{#if sorts.length > 0}<span class="sort-summary"
				>{getLabel(sorts[0]!.field)}&nbsp;{sorts[0]!.direction === 'asc'
					? '▲'
					: '▼'}{#if sorts.length > 1}&nbsp;+{sorts.length - 1}{/if}</span
			>{/if}
	</button>

	{#if isOpen}
		<div class="panel">
			<div class="panel-pills">
				{#each sorts as sort, i}
					<button
						class="pill sort-pill"
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
						onclick={() => toggleDirection(i)}
						oncontextmenu={(e) => onContextMenu(e, i)}
						ondragstart={() => onDragStart(i)}
						ondragover={(e) => onDragOver(e, i)}
						ondragleave={() => {}}
						ondrop={() => onDrop(i)}
						ondragend={onDragEnd}
						title="Click to toggle direction. Right-click for options. Drag to reorder."
					>
						{getLabel(sort.field)}<span class="arrow">{sort.direction === 'asc' ? '▲' : '▼'}</span>
					</button>
				{/each}
				<div class="add-wrapper" role="none">
					<button class="add-btn sort-add" onclick={() => (showPicker = !showPicker)}>+</button>
					{#if showPicker}
						<FieldPicker
							{fields}
							{fieldGroups}
							exclude={sorts.map((s) => s.field)}
							onselect={(key) => addField(key)}
							onselectgroup={(keys) => {
								for (const k of keys) addField(k);
							}}
							onremovegroup={(keys) => {
								const s = new Set(keys);
								sorts = sorts.filter((x) => !s.has(x.field));
								onchange();
							}}
							onclose={() => (showPicker = false)}
						/>
					{/if}
				</div>
			</div>
			{#if sorts.length === 0}
				<p class="empty-hint">No sort yet. Click + to add one.</p>
			{/if}
		</div>
	{/if}
</div>

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button onclick={() => setDirection(contextMenu!.index, 'asc')}>Sort Ascending</button>
		<button onclick={() => setDirection(contextMenu!.index, 'desc')}>Sort Descending</button>
		<hr />
		<button class="delete" onclick={() => remove(contextMenu!.index)}>Remove</button>
	</div>
{/if}

<style>
	.toolbar-item {
		position: relative;
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
	.sort-btn.has-active {
		border-color: #2563eb;
		color: #2563eb;
	}
	.sort-btn.has-active:hover,
	.sort-btn.has-active.open {
		background: #eff6ff;
	}

	.sort-summary {
		font-size: 11px;
		color: #2563eb;
		font-weight: 500;
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
	.panel-pills {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}
	.empty-hint {
		font-size: 12px;
		color: var(--text-muted);
		margin: 6px 0 0;
		font-style: italic;
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

	.sort-pill {
		background: var(--pill-sort-bg);
		border: 1px solid var(--pill-sort-border);
		cursor: grab;
		gap: 4px;
		transition:
			opacity 0.15s,
			border-color 0.15s;
	}
	.sort-pill:hover {
		background: var(--pill-sort-hover);
		border-color: #93c5fd;
	}
	.sort-pill .arrow {
		font-size: 10px;
		color: #6b21a8;
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
	.sort-add:hover {
		border-color: #2563eb;
		color: #2563eb;
	}
	.add-wrapper {
		position: relative;
	}

	.context-menu {
		position: fixed;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 200;
		min-width: 150px;
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
		color: var(--text);
	}
	.context-menu button:hover {
		background: var(--hover-bg);
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
