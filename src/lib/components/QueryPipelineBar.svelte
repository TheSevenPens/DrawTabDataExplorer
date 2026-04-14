<script lang="ts">
	import { type FieldDef, getFieldDef, getOperatorsForField } from '$data/lib/pipeline/index.js';
	import FieldPicker from '$lib/components/FieldPicker.svelte';

	interface FilterItem {
		field: string;
		operator: string;
		value: string;
		disabled?: boolean;
	}

	interface SortItem {
		field: string;
		direction: 'asc' | 'desc';
	}

	let { filters = $bindable(), sorts = $bindable(), columns = $bindable(), fields, fieldGroups, defaultFilterField, onchange }: {
		filters: FilterItem[];
		sorts: SortItem[];
		columns: string[];
		fields: FieldDef<any>[];
		fieldGroups: string[];
		defaultFilterField?: string;
		onchange: () => void;
	} = $props();

	function getLabel(key: string): string {
		return fields.find(f => f.key === key)?.label ?? key;
	}

	function closeAllContextMenus() {
		filterContextMenu = null;
		sortContextMenu = null;
		colContextMenu = null;
	}

	// ── Filter ────────────────────────────────────────────────────────────────

	let filterEditingIndex: number | null = $state(null);
	let filterShowFieldPicker = $state(false);
	let filterContextMenu: { index: number; x: number; y: number } | null = $state(null);
	let filterDragIndex: number | null = $state(null);
	let filterDroppedInside = false;

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
		const initialField = (defaultFilterField && fields.some(f => f.key === defaultFilterField))
			? defaultFilterField
			: (fields[0]?.key ?? '');
		filters.push({ field: initialField, operator: '==', value: '' });
		filterEditingIndex = filters.length - 1;
	}

	function toggleFilterDisabled(index: number) {
		const f = filters[index];
		if (f) { f.disabled = !f.disabled; onchange(); }
		filterContextMenu = null;
	}

	function removeFilter(index: number) {
		filters.splice(index, 1);
		if (filterEditingIndex === index) filterEditingIndex = null;
		else if (filterEditingIndex !== null && filterEditingIndex > index) filterEditingIndex--;
		onchange();
		filterContextMenu = null;
	}

	function onFilterFieldChange(index: number, newField: string) {
		const f = filters[index]!;
		f.field = newField;
		const fieldDef = getFieldDef(newField, fields);
		const ops = fieldDef ? getOperatorsForField(fieldDef) : [];
		if (!ops.some(o => o.value === f.operator)) f.operator = ops[0]?.value ?? '==';
		f.value = '';
		onchange();
	}

	function onFilterOpChange(index: number, newOp: string) {
		filters[index]!.operator = newOp;
		onchange();
	}

	function onFilterValueChange(index: number, newValue: string) {
		filters[index]!.value = newValue;
		onchange();
	}

	function onFilterContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		filterContextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function onFilterDragStart(index: number) {
		filterDragIndex = index;
		filterDroppedInside = false;
	}

	function onFilterDragEnd() {
		if (!filterDroppedInside && filterDragIndex !== null) removeFilter(filterDragIndex);
		filterDragIndex = null;
	}

	// ── Sort ──────────────────────────────────────────────────────────────────

	let sortShowPicker = $state(false);
	let sortContextMenu: { index: number; x: number; y: number } | null = $state(null);
	let sortDragIndex: number | null = $state(null);
	let sortDragOverIndex: number | null = $state(null);
	let sortDragOverSide: 'left' | 'right' = $state('left');
	let sortDroppedInside = false;

	function addSortField(key: string) {
		if (!sorts.some(s => s.field === key)) { sorts.push({ field: key, direction: 'asc' }); onchange(); }
		sortShowPicker = false;
	}

	function toggleSortDirection(index: number) {
		const item = sorts[index];
		if (item) { item.direction = item.direction === 'asc' ? 'desc' : 'asc'; onchange(); }
	}

	function removeSort(index: number) {
		sorts.splice(index, 1);
		onchange();
		sortContextMenu = null;
	}

	function setSortDirection(index: number, dir: 'asc' | 'desc') {
		const item = sorts[index];
		if (item) { item.direction = dir; onchange(); }
		sortContextMenu = null;
	}

	function onSortContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		sortContextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function onSortDragStart(index: number) {
		sortDragIndex = index;
		sortDroppedInside = false;
	}

	function onSortDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const pct = (e.clientX - rect.left) / rect.width;
		if (pct < 0.35) { sortDragOverIndex = index; sortDragOverSide = 'left'; }
		else if (pct > 0.65) { sortDragOverIndex = index; sortDragOverSide = 'right'; }
		else if (sortDragOverIndex !== index) sortDragOverIndex = index;
	}

	function onSortDrop(index: number) {
		sortDroppedInside = true;
		if (sortDragIndex !== null && sortDragIndex !== index) {
			const item = sorts.splice(sortDragIndex, 1)[0]!;
			let insertAt = sortDragOverSide === 'right' ? index + 1 : index;
			if (sortDragIndex < index) insertAt--;
			sorts.splice(Math.max(0, insertAt), 0, item);
			onchange();
		}
		sortDragIndex = null;
		sortDragOverIndex = null;
	}

	function onSortDragEnd() {
		if (!sortDroppedInside && sortDragIndex !== null) { sorts.splice(sortDragIndex, 1); onchange(); }
		sortDragIndex = null;
		sortDragOverIndex = null;
	}

	// ── Columns ───────────────────────────────────────────────────────────────

	let colShowPicker = $state(false);
	let colContextMenu: { index: number; x: number; y: number } | null = $state(null);
	let colDragIndex: number | null = $state(null);
	let colDragOverIndex: number | null = $state(null);
	let colDragOverSide: 'left' | 'right' = $state('left');
	let colDroppedInside = false;

	function addColumnField(key: string) {
		if (!columns.includes(key)) { columns.push(key); onchange(); }
		colShowPicker = false;
	}

	function removeColumn(index: number) {
		columns.splice(index, 1);
		onchange();
		colContextMenu = null;
	}

	function removeColumnGroup(index: number) {
		const col = columns[index];
		const field = fields.find(f => f.key === col);
		if (!field) return;
		const groupKeys = new Set(fields.filter(f => f.group === field.group).map(f => f.key));
		columns = columns.filter(c => !groupKeys.has(c));
		onchange();
		colContextMenu = null;
	}

	function getColumnGroupName(index: number): string {
		const col = columns[index];
		return fields.find(f => f.key === col)?.group ?? '';
	}

	function onColContextMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		colContextMenu = { index, x: e.clientX, y: e.clientY };
	}

	function onColDragStart(index: number) {
		colDragIndex = index;
		colDroppedInside = false;
	}

	function onColDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const pct = (e.clientX - rect.left) / rect.width;
		if (pct < 0.35) { colDragOverIndex = index; colDragOverSide = 'left'; }
		else if (pct > 0.65) { colDragOverIndex = index; colDragOverSide = 'right'; }
		else if (colDragOverIndex !== index) colDragOverIndex = index;
	}

	function onColDrop(index: number) {
		colDroppedInside = true;
		if (colDragIndex !== null && colDragIndex !== index) {
			const item = columns.splice(colDragIndex, 1)[0]!;
			let insertAt = colDragOverSide === 'right' ? index + 1 : index;
			if (colDragIndex < index) insertAt--;
			columns.splice(Math.max(0, insertAt), 0, item);
			onchange();
		}
		colDragIndex = null;
		colDragOverIndex = null;
	}

	function onColDragEnd() {
		if (!colDroppedInside && colDragIndex !== null) { columns.splice(colDragIndex, 1); onchange(); }
		colDragIndex = null;
		colDragOverIndex = null;
	}
</script>

<svelte:window onclick={closeAllContextMenus} />

<!-- Filter bar -->
<div class="bar filter-bar">
	<span class="bar-label filter-label">filter</span>
	<div class="pills">
		{#each filters as filter, i}
			<button
				class="pill filter-pill"
				class:active={filterEditingIndex === i}
				class:disabled={filter.disabled}
				class:dragging={filterDragIndex === i}
				draggable="true"
				onclick={() => filterEditingIndex = filterEditingIndex === i ? null : i}
				oncontextmenu={(e) => onFilterContextMenu(e, i)}
				ondragstart={() => onFilterDragStart(i)}
				ondragend={onFilterDragEnd}
				title="Click to edit. Right-click for options. Drag out to remove."
			>
				{pillText(filter)}
			</button>
		{/each}
		<button class="add-btn filter-add" onclick={addFilter} title="Add filter">+</button>
	</div>
</div>

{#if filterEditingIndex !== null && filters[filterEditingIndex]}
	{@const filter = filters[filterEditingIndex]}
	{@const fieldDef = getFieldDef(filter.field, fields)}
	{@const operators = fieldDef ? getOperatorsForField(fieldDef) : []}
	{@const needsValue = filter.operator !== 'empty' && filter.operator !== 'notempty'}
	<div class="editor">
		<div class="field-select-wrapper">
			<button class="field-select-btn" onclick={() => filterShowFieldPicker = !filterShowFieldPicker}>
				{getLabel(filter.field)} ▾
			</button>
			{#if filterShowFieldPicker}
				<FieldPicker
					{fields}
					{fieldGroups}
					selected={filter.field}
					onselect={(key) => { onFilterFieldChange(filterEditingIndex!, key); filterShowFieldPicker = false; }}
					onclose={() => filterShowFieldPicker = false}
				/>
			{/if}
		</div>

		<select value={filter.operator} onchange={(e) => onFilterOpChange(filterEditingIndex!, (e.target as HTMLSelectElement).value)}>
			{#each operators as op}
				<option value={op.value} selected={op.value === filter.operator}>{op.label}</option>
			{/each}
		</select>

		{#if needsValue && fieldDef?.type === 'enum' && fieldDef.enumValues}
			<select value={filter.value} onchange={(e) => { onFilterValueChange(filterEditingIndex!, (e.target as HTMLSelectElement).value); }}>
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
				oninput={(e) => onFilterValueChange(filterEditingIndex!, (e.target as HTMLInputElement).value)}
			/>
		{/if}

		<button class="done-btn" onclick={() => filterEditingIndex = null}>Done</button>
	</div>
{/if}

<!-- Sort bar -->
<div class="bar sort-bar">
	<span class="bar-label sort-label">sort</span>
	<div class="pills">
		{#each sorts as sort, i}
			<button
				class="pill sort-pill"
				class:dragging={sortDragIndex === i}
				class:gap-left={sortDragIndex !== null && sortDragOverIndex === i && sortDragOverSide === 'left' && sortDragIndex !== i}
				class:gap-right={sortDragIndex !== null && sortDragOverIndex === i && sortDragOverSide === 'right' && sortDragIndex !== i}
				draggable="true"
				onclick={() => toggleSortDirection(i)}
				oncontextmenu={(e) => onSortContextMenu(e, i)}
				ondragstart={() => onSortDragStart(i)}
				ondragover={(e) => onSortDragOver(e, i)}
				ondragleave={() => {}}
				ondrop={() => onSortDrop(i)}
				ondragend={onSortDragEnd}
				title="Click to toggle. Right-click for options. Drag to reorder."
			>
				{getLabel(sort.field)}<span class="arrow">{sort.direction === 'asc' ? '▲' : '▼'}</span>
			</button>
		{/each}
		<div class="add-wrapper">
			<button class="add-btn sort-add" onclick={() => sortShowPicker = !sortShowPicker}>+</button>
			{#if sortShowPicker}
				<FieldPicker
					{fields}
					{fieldGroups}
					exclude={sorts.map(s => s.field)}
					onselect={(key) => addSortField(key)}
					onselectgroup={(keys) => { for (const k of keys) addSortField(k); }}
					onremovegroup={(keys) => { const s = new Set(keys); sorts = sorts.filter(x => !s.has(x.field)); onchange(); }}
					onclose={() => sortShowPicker = false}
				/>
			{/if}
		</div>
	</div>
</div>

<!-- Column bar -->
<div class="bar column-bar">
	<span class="bar-label column-label">columns</span>
	<div class="pills">
		{#each columns as col, i}
			<button
				class="pill col-pill"
				class:dragging={colDragIndex === i}
				class:gap-left={colDragIndex !== null && colDragOverIndex === i && colDragOverSide === 'left' && colDragIndex !== i}
				class:gap-right={colDragIndex !== null && colDragOverIndex === i && colDragOverSide === 'right' && colDragIndex !== i}
				draggable="true"
				oncontextmenu={(e) => onColContextMenu(e, i)}
				ondragstart={() => onColDragStart(i)}
				ondragover={(e) => onColDragOver(e, i)}
				ondragleave={() => {}}
				ondrop={() => onColDrop(i)}
				ondragend={onColDragEnd}
				title="Right-click to remove. Drag to reorder."
			>
				{getLabel(col)}
			</button>
		{/each}
		<div class="add-wrapper">
			<button class="add-btn col-add" onclick={() => colShowPicker = !colShowPicker}>+</button>
			{#if colShowPicker}
				<FieldPicker
					{fields}
					{fieldGroups}
					exclude={columns}
					onselect={(key) => addColumnField(key)}
					onselectgroup={(keys) => { for (const k of keys) addColumnField(k); }}
					onremovegroup={(keys) => { const s = new Set(keys); columns = columns.filter(c => !s.has(c)); onchange(); }}
					onclose={() => colShowPicker = false}
				/>
			{/if}
		</div>
	</div>
</div>

<!-- Context menus -->
{#if filterContextMenu}
	<div class="context-menu" style="left: {filterContextMenu.x}px; top: {filterContextMenu.y}px;">
		<button onclick={() => { filterEditingIndex = filterContextMenu!.index; filterContextMenu = null; }}>Edit</button>
		<button onclick={() => toggleFilterDisabled(filterContextMenu!.index)}>
			{filters[filterContextMenu.index]?.disabled ? 'Enable' : 'Disable'}
		</button>
		<hr />
		<button class="delete" onclick={() => removeFilter(filterContextMenu!.index)}>Remove</button>
	</div>
{/if}

{#if sortContextMenu}
	<div class="context-menu" style="left: {sortContextMenu.x}px; top: {sortContextMenu.y}px;">
		<button onclick={() => setSortDirection(sortContextMenu!.index, 'asc')}>Sort Ascending</button>
		<button onclick={() => setSortDirection(sortContextMenu!.index, 'desc')}>Sort Descending</button>
		<hr />
		<button class="delete" onclick={() => removeSort(sortContextMenu!.index)}>Remove</button>
	</div>
{/if}

{#if colContextMenu}
	<div class="context-menu" style="left: {colContextMenu.x}px; top: {colContextMenu.y}px;">
		<button class="delete" onclick={() => removeColumn(colContextMenu!.index)}>Remove</button>
		<hr />
		<button class="delete" onclick={() => removeColumnGroup(colContextMenu!.index)}>Remove all {getColumnGroupName(colContextMenu.index)}</button>
	</div>
{/if}

<style>
	/* ── Shared bar structure ───────────────────────────────────────────────── */
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		min-height: 40px;
		margin-bottom: 4px;
	}

	.column-bar { align-items: flex-start; margin-bottom: 12px; }

	.bar-label { font-weight: 600; color: #6b21a8; }
	.filter-label { min-width: 42px; }
	.sort-label   { min-width: 50px; }
	.column-label { min-width: 60px; padding-top: 2px; }

	.pills {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}

	/* ── Shared pill structure ─────────────────────────────────────────────── */
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

	.pill.dragging  { opacity: 0.3; }
	.pill.gap-left  { margin-left: 80px;  transition: margin 0.15s ease; }
	.pill.gap-right { margin-right: 80px; transition: margin 0.15s ease; }

	/* Filter pill */
	.filter-pill { background: var(--pill-filter-bg); border: 1px solid var(--pill-filter-border); }
	.filter-pill:hover  { background: var(--pill-filter-hover); border-color: #f59e0b; }
	.filter-pill.active { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217,119,6,0.2); }
	.filter-pill.disabled { opacity: 0.45; text-decoration: line-through; }

	/* Sort pill */
	.sort-pill {
		background: var(--pill-sort-bg);
		border: 1px solid var(--pill-sort-border);
		cursor: grab;
		gap: 4px;
		transition: opacity 0.15s, border-color 0.15s;
	}
	.sort-pill:hover { background: var(--pill-sort-hover); border-color: #93c5fd; }
	.sort-pill .arrow { font-size: 10px; color: #6b21a8; }

	/* Column pill */
	.col-pill {
		background: var(--pill-col-bg);
		border: 1px solid var(--pill-col-border);
		cursor: grab;
		transition: opacity 0.15s, border-color 0.15s;
	}
	.col-pill:hover { background: var(--pill-col-hover); border-color: #86efac; }

	/* ── Add button ────────────────────────────────────────────────────────── */
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

	.filter-add:hover { border-color: #d97706; color: #d97706; }
	.sort-add:hover   { border-color: #2563eb; color: #2563eb; }
	.col-add:hover    { border-color: #16a34a; color: #16a34a; }

	.add-wrapper { position: relative; }

	/* ── Filter editor ─────────────────────────────────────────────────────── */
	.editor {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--editor-bg);
		border: 1px solid var(--pill-filter-border);
		border-top: none;
		border-radius: 0 0 6px 6px;
		margin-bottom: 12px;
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

	.editor input { width: 160px; }

	.field-select-wrapper { position: relative; }

	.field-select-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		cursor: pointer;
	}
	.field-select-btn:hover { border-color: var(--link); }

	.done-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #d97706;
		background: var(--bg-card);
		border-radius: 4px;
		cursor: pointer;
		color: #d97706;
	}
	.done-btn:hover { background: #d97706; color: #fff; }

	/* ── Context menu ──────────────────────────────────────────────────────── */
	.context-menu {
		position: fixed;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
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
		color: var(--text);
	}
	.context-menu button:hover       { background: var(--hover-bg); }
	.context-menu button.delete      { color: #e11d48; }
	.context-menu button.delete:hover { background: #fef2f2; }

	.context-menu hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 2px 0;
	}
</style>
