<script lang="ts">
	import { type AnyFieldDef, getFieldDef, getOperatorsForField } from 'queriton';
	import FieldPicker from '$lib/components/FieldPicker.svelte';

	interface FilterItem {
		field: string;
		operator: string;
		value: string;
		disabled?: boolean;
	}

	let {
		filters = $bindable(),
		fields,
		fieldGroups,
		defaultFilterField,
		isOpen,
		onchange,
		ontoggle,
	}: {
		filters: FilterItem[];
		fields: AnyFieldDef[];
		fieldGroups: string[];
		defaultFilterField?: string;
		isOpen: boolean;
		onchange: () => void;
		ontoggle: () => void;
	} = $props();

	let editingIndex: number | null = $state(null);
	let showFieldPicker = $state(false);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);
	let dragIndex: number | null = $state(null);
	let droppedInside = false;

	let activeCount = $derived(filters.filter((f) => !f.disabled).length);

	function getLabel(key: string) {
		return fields.find((f) => f.key === key)?.label ?? key;
	}

	function getOpLabel(op: string): string {
		const labels: Record<string, string> = {
			'==': '=',
			'!=': '!=',
			'>': '>',
			'>=': '>=',
			'<': '<',
			'<=': '<=',
			contains: 'contains',
			notcontains: 'does not contain',
			startswith: 'starts with',
			notstartswith: 'does not start with',
			empty: 'is empty',
			notempty: 'is not empty',
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
		const initialField =
			defaultFilterField && fields.some((f) => f.key === defaultFilterField)
				? defaultFilterField
				: (fields[0]?.key ?? '');
		filters.push({ field: initialField, operator: '==', value: '' });
		editingIndex = filters.length - 1;
		if (!isOpen) ontoggle();
	}

	function removeFilter(index: number) {
		filters.splice(index, 1);
		if (editingIndex === index) editingIndex = null;
		else if (editingIndex !== null && editingIndex > index) editingIndex--;
		onchange();
		contextMenu = null;
	}

	function toggleDisabled(index: number) {
		const f = filters[index];
		if (f) {
			f.disabled = !f.disabled;
			onchange();
		}
		contextMenu = null;
	}

	function onFieldChange(index: number, newField: string) {
		const f = filters[index]!;
		f.field = newField;
		const fieldDef = getFieldDef(newField, fields);
		const ops = fieldDef ? getOperatorsForField(fieldDef) : [];
		if (!ops.some((o) => o.value === f.operator)) f.operator = ops[0]?.value ?? '==';
		f.value = '';
		onchange();
	}

	function onOpChange(index: number, newOp: string) {
		filters[index]!.operator = newOp;
		onchange();
	}
	function onValueChange(index: number, v: string) {
		filters[index]!.value = v;
		onchange();
	}

	function onContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		contextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function onDragStart(index: number) {
		dragIndex = index;
		droppedInside = false;
	}
	function onDragEnd() {
		if (!droppedInside && dragIndex !== null) removeFilter(dragIndex);
		dragIndex = null;
	}
</script>

<svelte:window onclick={() => (contextMenu = null)} />

<div class="toolbar-item">
	<button
		class="toolbar-btn filter-btn"
		class:has-active={activeCount > 0}
		class:open={isOpen}
		onclick={ontoggle}
	>
		Filters{#if activeCount > 0}<span class="badge filter-badge">{activeCount}</span>{/if}
	</button>

	{#if isOpen}
		<div class="panel filter-panel">
			<div class="panel-pills">
				{#each filters as filter, i}
					<button
						class="pill filter-pill"
						class:active={editingIndex === i}
						class:disabled={filter.disabled}
						class:dragging={dragIndex === i}
						draggable="true"
						onclick={() => (editingIndex = editingIndex === i ? null : i)}
						oncontextmenu={(e) => onContextMenu(e, i)}
						ondragstart={() => onDragStart(i)}
						ondragend={onDragEnd}
						title="Click to edit. Right-click for options. Drag out to remove."
						>{pillText(filter)}</button
					>
				{/each}
				<button class="add-btn filter-add" onclick={addFilter} title="Add filter">+</button>
			</div>
			{#if filters.length === 0}
				<p class="empty-hint">No filters yet. Click + to add one.</p>
			{/if}
			{#if editingIndex !== null && filters[editingIndex]}
				{@const filter = filters[editingIndex]}
				{@const fieldDef = getFieldDef(filter.field, fields)}
				{@const operators = fieldDef ? getOperatorsForField(fieldDef) : []}
				{@const needsValue = filter.operator !== 'empty' && filter.operator !== 'notempty'}
				<div class="editor">
					<div class="field-select-wrapper">
						<button class="field-select-btn" onclick={() => (showFieldPicker = !showFieldPicker)}>
							{getLabel(filter.field)} ▾
						</button>
						{#if showFieldPicker}
							<FieldPicker
								{fields}
								{fieldGroups}
								selected={filter.field}
								onselect={(key) => {
									onFieldChange(editingIndex!, key);
									showFieldPicker = false;
								}}
								onclose={() => (showFieldPicker = false)}
							/>
						{/if}
					</div>
					<select
						value={filter.operator}
						onchange={(e) => onOpChange(editingIndex!, (e.target as HTMLSelectElement).value)}
					>
						{#each operators as op}
							<option value={op.value} selected={op.value === filter.operator}>{op.label}</option>
						{/each}
					</select>
					{#if needsValue && fieldDef?.type === 'enum' && fieldDef.enumValues}
						<select
							value={filter.value}
							onchange={(e) => {
								onValueChange(editingIndex!, (e.target as HTMLSelectElement).value);
							}}
						>
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
					<button class="done-btn" onclick={() => (editingIndex = null)}>Done</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if contextMenu}
	<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button
			onclick={() => {
				editingIndex = contextMenu!.index;
				if (!isOpen) ontoggle();
				contextMenu = null;
			}}>Edit</button
		>
		<button onclick={() => toggleDisabled(contextMenu!.index)}>
			{filters[contextMenu.index]?.disabled ? 'Enable' : 'Disable'}
		</button>
		<hr />
		<button class="delete" onclick={() => removeFilter(contextMenu!.index)}>Remove</button>
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
	.filter-btn.has-active {
		border-color: #d97706;
		color: #d97706;
	}
	.filter-btn.has-active:hover,
	.filter-btn.has-active.open {
		background: #fffbeb;
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
	.filter-badge {
		background: #d97706;
		color: #fff;
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
	.filter-panel {
		min-width: 520px;
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
	.filter-pill {
		background: var(--pill-filter-bg);
		border: 1px solid var(--pill-filter-border);
	}
	.filter-pill:hover {
		background: var(--pill-filter-hover);
		border-color: #f59e0b;
	}
	.filter-pill.active {
		border-color: #d97706;
		box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.2);
	}
	.filter-pill.disabled {
		opacity: 0.45;
		text-decoration: line-through;
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
	.filter-add:hover {
		border-color: #d97706;
		color: #d97706;
	}

	.editor {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 0 2px;
		border-top: 1px solid var(--border-light);
		margin-top: 8px;
		flex-wrap: wrap;
	}
	.editor select,
	.editor input {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}
	.editor input {
		width: 160px;
	}
	.field-select-wrapper {
		position: relative;
	}
	.field-select-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		cursor: pointer;
	}
	.field-select-btn:hover {
		border-color: var(--link);
	}
	.done-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #d97706;
		background: var(--bg-card);
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
