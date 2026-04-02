<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';

	interface SortItem {
		field: string;
		direction: 'asc' | 'desc';
	}

	let { sorts = $bindable(), fields, onchange }: {
		sorts: SortItem[];
		fields: FieldDef<any>[];
		onchange: () => void;
	} = $props();

	let showPicker = $state(false);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);

	function getLabel(key: string): string {
		return fields.find(f => f.key === key)?.label ?? key;
	}

	function addField(key: string) {
		if (!sorts.some(s => s.field === key)) {
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

	function removeSort(index: number) {
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

	function closeContextMenu() {
		contextMenu = null;
	}

	// Available fields not yet in sorts
	let availableFields = $derived(
		fields.filter(f => !sorts.some(s => s.field === f.key))
	);
</script>

<svelte:window onclick={closeContextMenu} />

<div class="sort-bar">
	<span class="sort-label">sort by</span>
	<div class="pills">
		{#each sorts as sort, i}
			<button
				class="pill"
				onclick={() => toggleDirection(i)}
				oncontextmenu={(e) => onContextMenu(e, i)}
				title="Click to toggle direction. Right-click for options."
			>
				{getLabel(sort.field)}
				<span class="arrow">{sort.direction === 'asc' ? '▲' : '▼'}</span>
			</button>
		{/each}
		<div class="add-wrapper">
			<button class="add-btn" onclick={() => showPicker = !showPicker}>+</button>
			{#if showPicker}
				<div class="picker">
					{#if availableFields.length === 0}
						<div class="picker-empty">All fields added</div>
					{:else}
						{#each availableFields as f}
							<button class="picker-item" onclick={() => addField(f.key)}>{f.label}</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button onclick={() => setDirection(contextMenu!.index, 'asc')}>Sort Ascending</button>
		<button onclick={() => setDirection(contextMenu!.index, 'desc')}>Sort Descending</button>
		<hr />
		<button class="delete" onclick={() => removeSort(contextMenu!.index)}>Remove</button>
	</div>
{/if}

<style>
	.sort-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		min-height: 40px;
	}

	.sort-label {
		font-weight: 600;
		color: #6b21a8;
		min-width: 50px;
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
		gap: 4px;
		padding: 3px 10px;
		font-size: 13px;
		background: #eef2ff;
		border: 1px solid #c7d2fe;
		border-radius: 16px;
		cursor: pointer;
		color: #333;
		user-select: none;
	}

	.pill:hover {
		background: #dbeafe;
		border-color: #93c5fd;
	}

	.pill .arrow {
		font-size: 10px;
		color: #6b21a8;
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
		border-color: #2563eb;
		color: #2563eb;
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
		max-height: 300px;
		overflow-y: auto;
		min-width: 180px;
	}

	.picker-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 6px 12px;
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
		color: #333;
	}

	.context-menu button:hover {
		background: #f0f7ff;
	}

	.context-menu button.delete {
		color: #e11d48;
	}

	.context-menu button.delete:hover {
		background: #fef2f2;
	}

	.context-menu hr {
		border: none;
		border-top: 1px solid #eee;
		margin: 2px 0;
	}
</style>
