<script lang="ts">
	import { type FieldDef, type FilterStep, getFieldDef, getOperatorsForField } from '$data/lib/pipeline/index.js';

	interface FilterItem {
		field: string;
		operator: string;
		value: string;
	}

	let { filters = $bindable(), fields, onchange }: {
		filters: FilterItem[];
		fields: FieldDef<any>[];
		onchange: () => void;
	} = $props();

	let editingIndex: number | null = $state(null);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);

	function getLabel(key: string): string {
		return fields.find(f => f.key === key)?.label ?? key;
	}

	function getOpLabel(op: string): string {
		const labels: Record<string, string> = {
			'==': '=', '!=': '!=', '>': '>', '>=': '>=', '<': '<', '<=': '<=',
			'contains': 'contains', 'startswith': 'starts with',
			'empty': 'is empty', 'notempty': 'is not empty',
		};
		return labels[op] ?? op;
	}

	function pillText(f: FilterItem): string {
		const label = getLabel(f.field);
		if (f.operator === 'empty') return `${label} is empty`;
		if (f.operator === 'notempty') return `${label} is not empty`;
		return `${label} ${getOpLabel(f.operator)} ${f.value || '?'}`;
	}

	function addFilter() {
		filters.push({ field: fields[0]?.key ?? '', operator: '==', value: '' });
		editingIndex = filters.length - 1;
	}

	function removeFilter(index: number) {
		filters.splice(index, 1);
		if (editingIndex === index) editingIndex = null;
		else if (editingIndex !== null && editingIndex > index) editingIndex--;
		onchange();
		contextMenu = null;
	}

	function onFieldChange(index: number, newField: string) {
		const f = filters[index]!;
		f.field = newField;
		const fieldDef = getFieldDef(newField, fields);
		const ops = fieldDef ? getOperatorsForField(fieldDef) : [];
		if (!ops.some(o => o.value === f.operator)) {
			f.operator = ops[0]?.value ?? '==';
		}
		f.value = '';
		onchange();
	}

	function onOpChange(index: number, newOp: string) {
		filters[index]!.operator = newOp;
		onchange();
	}

	function onValueChange(index: number, newValue: string) {
		filters[index]!.value = newValue;
		onchange();
	}

	function doneEditing() {
		editingIndex = null;
	}

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function closeContextMenu() {
		contextMenu = null;
	}
</script>

<svelte:window onclick={closeContextMenu} />

<div class="filter-bar">
	<span class="filter-label">where</span>
	<div class="pills">
		{#each filters as filter, i}
			<button
				class="pill"
				class:active={editingIndex === i}
				onclick={() => editingIndex = editingIndex === i ? null : i}
				oncontextmenu={(e) => onContextMenu(e, i)}
				title="Click to edit. Right-click to remove."
			>
				{pillText(filter)}
			</button>
		{/each}
		<button class="add-btn" onclick={addFilter} title="Add filter">+</button>
	</div>
</div>

{#if editingIndex !== null && filters[editingIndex]}
	{@const filter = filters[editingIndex]}
	{@const fieldDef = getFieldDef(filter.field, fields)}
	{@const operators = fieldDef ? getOperatorsForField(fieldDef) : []}
	{@const needsValue = filter.operator !== 'empty' && filter.operator !== 'notempty'}
	<div class="editor">
		<select value={filter.field} onchange={(e) => onFieldChange(editingIndex!, (e.target as HTMLSelectElement).value)}>
			{#each fields as f}
				<option value={f.key} selected={f.key === filter.field}>{f.label}</option>
			{/each}
		</select>

		<select value={filter.operator} onchange={(e) => onOpChange(editingIndex!, (e.target as HTMLSelectElement).value)}>
			{#each operators as op}
				<option value={op.value} selected={op.value === filter.operator}>{op.label}</option>
			{/each}
		</select>

		{#if needsValue && fieldDef?.type === 'enum' && fieldDef.enumValues}
			<select value={filter.value} onchange={(e) => { onValueChange(editingIndex!, (e.target as HTMLSelectElement).value); }}>
				<option value="">-- select --</option>
				{#each fieldDef.enumValues as v}
					<option value={v} selected={v === filter.value}>{v}</option>
				{/each}
			</select>
		{:else if needsValue}
			<input
				type={fieldDef?.type === 'number' ? 'number' : 'text'}
				placeholder="value..."
				value={filter.value}
				oninput={(e) => onValueChange(editingIndex!, (e.target as HTMLInputElement).value)}
			/>
		{/if}

		<button class="done-btn" onclick={doneEditing}>Done</button>
	</div>
{/if}

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button onclick={() => { editingIndex = contextMenu!.index; contextMenu = null; }}>Edit</button>
		<hr />
		<button class="delete" onclick={() => removeFilter(contextMenu!.index)}>Remove</button>
	</div>
{/if}

<style>
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		min-height: 40px;
		margin-bottom: 4px;

	}

	.filter-label {
		font-weight: 600;
		color: #6b21a8;
		min-width: 42px;
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
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 16px;
		cursor: pointer;
		color: #333;
		user-select: none;
	}

	.pill:hover {
		background: #fde68a;
		border-color: #f59e0b;
	}

	.pill.active {
		border-color: #d97706;
		box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.2);
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
		border-color: #d97706;
		color: #d97706;
	}

	.editor {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		border-top: none;
		border-radius: 0 0 6px 6px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.editor select,
	.editor input {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.editor input {
		width: 160px;
	}

	.done-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #d97706;
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: #d97706;
	}

	.done-btn:hover {
		background: #d97706;
		color: #fff;
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
