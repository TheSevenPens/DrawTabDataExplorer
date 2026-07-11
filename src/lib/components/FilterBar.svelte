<script lang="ts">
	import {
		type AnyFieldDisplayDef,
		getFieldDef,
		getOperatorsForField,
	} from '@thesevenpens/queriton';
	import FieldPicker from '$lib/components/FieldPicker.svelte';
	import PopoverMenu from '$lib/components/PopoverMenu.svelte';
	import { fieldOptionLabelForKey } from '$lib/field-option-label.js';
	import {
		type PipelineSection,
		setPipelineFieldDragData,
		readPipelineFieldDragData,
		canAcceptPipelineFieldAt,
		clearPipelineFieldDrag,
		markPipelineCrossDropHandled,
		consumePipelineCrossDropHandled,
	} from '$lib/query-builder/pipeline-field-drag.js';

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
		inline = false,
		pipelineSection,
		enableCrossSectionDrag = false,
		onCrossSectionDrop,
		onchange,
		ontoggle,
	}: {
		filters: FilterItem[];
		fields: AnyFieldDisplayDef[];
		fieldGroups: string[];
		defaultFilterField?: string;
		isOpen: boolean;
		/** When true, render pills + picker inline (no toolbar toggle). */
		inline?: boolean;
		pipelineSection?: PipelineSection;
		enableCrossSectionDrag?: boolean;
		onCrossSectionDrop?: (field: string, source: PipelineSection) => void;
		onchange: () => void;
		ontoggle: () => void;
	} = $props();

	let editingIndex: number | null = $state(null);
	let showFieldPicker = $state(false);
	let showAddPicker = $state(false);
	let contextMenu: { index: number; x: number; y: number } | null = $state(null);
	let dragIndex: number | null = $state(null);
	let droppedInside = false;
	let crossDropTarget = $state(false);

	let activeCount = $derived(filters.filter((f) => !f.disabled).length);

	function getLabel(key: string) {
		return fieldOptionLabelForKey(key, fields);
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
		addFilterWithField(initialField);
		if (!inline && !isOpen) ontoggle();
	}

	function addFilterWithField(key: string) {
		const fieldDef = getFieldDef(key, fields);
		const ops = fieldDef ? getOperatorsForField(fieldDef) : [];
		filters.push({ field: key, operator: ops[0]?.value ?? '==', value: '' });
		editingIndex = filters.length - 1;
		showAddPicker = false;
		onchange();
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

	function onDragStart(e: DragEvent, index: number) {
		dragIndex = index;
		droppedInside = false;
		if (enableCrossSectionDrag && pipelineSection) {
			setPipelineFieldDragData(e, filters[index]!.field, pipelineSection);
		}
	}
	function onDragEnd() {
		if (enableCrossSectionDrag && consumePipelineCrossDropHandled()) {
			dragIndex = null;
			crossDropTarget = false;
			clearPipelineFieldDrag();
			return;
		}
		if (!droppedInside && dragIndex !== null) removeFilter(dragIndex);
		dragIndex = null;
		crossDropTarget = false;
		clearPipelineFieldDrag();
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
</script>

<div class="toolbar-item" class:inline>
	{#if !inline}
		<button
			class="toolbar-btn filter-btn"
			class:has-active={activeCount > 0}
			class:open={isOpen}
			onclick={ontoggle}
		>
			Filters{#if activeCount > 0}<span class="badge filter-badge">{activeCount}</span>{/if}
		</button>
	{/if}

	{#if inline || isOpen}
		<div
			class="panel filter-panel"
			class:inline-panel={inline}
			class:cross-drop-target={crossDropTarget}
		>
			<div
				class="panel-pills"
				ondragenter={onPanelDragEnter}
				ondragover={onPanelDragOver}
				ondragleave={onPanelDragLeave}
				ondrop={onPanelDrop}
				role="list"
			>
				{#each filters as filter, i (i)}
					<button
						class="pill filter-pill"
						class:active={editingIndex === i}
						class:disabled={filter.disabled}
						class:dragging={dragIndex === i}
						draggable="true"
						onclick={() => (editingIndex = editingIndex === i ? null : i)}
						oncontextmenu={(e) => onContextMenu(e, i)}
						ondragstart={(e) => onDragStart(e, i)}
						ondragover={enableCrossSectionDrag ? onPanelDragOver : undefined}
						ondrop={enableCrossSectionDrag ? onPanelDrop : undefined}
						ondragend={onDragEnd}
						title={enableCrossSectionDrag
							? 'Click to edit. Drag to another section to copy the field there. Drag out to remove.'
							: 'Click to edit. Right-click for options. Drag out to remove.'}
						>{pillText(filter)}</button
					>
				{/each}
				<div class="add-wrapper" role="none">
					<button
						class="add-btn filter-add"
						onclick={() => (inline ? (showAddPicker = !showAddPicker) : addFilter())}
						title="Add filter">+</button
					>
					{#if inline && showAddPicker}
						<FieldPicker
							{fields}
							{fieldGroups}
							onselect={(key) => addFilterWithField(key)}
							onselectgroup={(keys) => {
								for (const k of keys) addFilterWithField(k);
							}}
							onclose={() => (showAddPicker = false)}
						/>
					{/if}
				</div>
			</div>
			{#if filters.length === 0 && !inline}
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
						{#each operators as op (op.value)}
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
							{#each fieldDef.enumValues as v (v)}
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
	{@const idx = contextMenu.index}
	<PopoverMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={[
			{
				label: 'Edit',
				onclick: () => {
					editingIndex = idx;
					if (!isOpen) ontoggle();
				},
			},
			{
				label: filters[idx]?.disabled ? 'Enable' : 'Disable',
				onclick: () => toggleDisabled(idx),
			},
			{ divider: true },
			{ label: 'Remove', danger: true, onclick: () => removeFilter(idx) },
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

	.panel.inline-panel {
		position: static;
		border: none;
		box-shadow: none;
		padding: 0;
		min-width: 0;
		background: transparent;
	}

	.filter-panel.inline-panel {
		min-width: 0;
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
	.add-wrapper {
		position: relative;
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
</style>
