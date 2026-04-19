<script lang="ts">
	import { type FieldDef, type Step, getFieldDef, getOperatorsForField } from '$data/lib/pipeline/index.js';
	import FieldPicker from '$lib/components/FieldPicker.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';

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

	let {
		filters = $bindable(),
		sorts = $bindable(),
		columns = $bindable(),
		fields,
		fieldGroups,
		defaultFilterField,
		onchange,
		steps,
		entityType,
		defaultView,
		onload,
	}: {
		filters: FilterItem[];
		sorts: SortItem[];
		columns: string[];
		fields: FieldDef<any>[];
		fieldGroups: string[];
		defaultFilterField?: string;
		onchange: () => void;
		steps: Step[];
		entityType: string;
		defaultView: Step[];
		onload: (steps: Step[]) => void;
	} = $props();

	// ── Panel open/close ─────────────────────────────────────────────────────

	let openPanel: 'filter' | 'sort' | 'columns' | 'views' | null = $state(null);

	function togglePanel(name: 'filter' | 'sort' | 'columns' | 'views') {
		closeAllContextMenus();
		openPanel = openPanel === name ? null : name;
	}

	function closeAll() {
		openPanel = null;
		closeAllContextMenus();
	}

	function closeAllContextMenus() {
		filterContextMenu = null;
		sortContextMenu = null;
		colContextMenu = null;
	}

	function getLabel(key: string): string {
		return fields.find(f => f.key === key)?.label ?? key;
	}

	// ── Filter ────────────────────────────────────────────────────────────────

	let filterEditingIndex: number | null = $state(null);
	let filterShowFieldPicker = $state(false);
	let filterContextMenu: { index: number; x: number; y: number } | null = $state(null);
	let filterDragIndex: number | null = $state(null);
	let filterDroppedInside = false;

	let activeFilterCount = $derived(filters.filter(f => !f.disabled).length);

	function getOpLabel(op: string): string {
		const labels: Record<string, string> = {
			'==': '=', '!=': '!=', '>': '>', '>=': '>=', '<': '<', '<=': '<=',
			'contains': 'contains', 'notcontains': 'does not contain',
			'startswith': 'starts with', 'notstartswith': 'does not start with',
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
		openPanel = 'filter';
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
		// Columns are only removed via context menu; do not remove on drag-outside
		colDragIndex = null;
		colDragOverIndex = null;
	}
</script>

<svelte:window onclick={closeAll} />

<div class="toolbar" onclick={(e) => e.stopPropagation()}>

	<!-- ── Filters ── -->
	<div class="toolbar-item">
		<button
			class="toolbar-btn filter-btn"
			class:has-active={activeFilterCount > 0}
			class:open={openPanel === 'filter'}
			onclick={() => togglePanel('filter')}
		>
			Filters{#if activeFilterCount > 0}<span class="badge filter-badge">{activeFilterCount}</span>{/if}
		</button>
		{#if openPanel === 'filter'}
			<div class="panel filter-panel">
				<div class="panel-pills">
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
				{#if filters.length === 0}
					<p class="empty-hint">No filters yet. Click + to add one.</p>
				{/if}
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
			</div>
		{/if}
	</div>

	<!-- ── Sort ── -->
	<div class="toolbar-item">
		<button
			class="toolbar-btn sort-btn"
			class:has-active={sorts.length > 0}
			class:open={openPanel === 'sort'}
			onclick={() => togglePanel('sort')}
		>
			Sort{#if sorts.length > 0}<span class="sort-summary">{getLabel(sorts[0]!.field)}&nbsp;{sorts[0]!.direction === 'asc' ? '▲' : '▼'}{#if sorts.length > 1}&nbsp;+{sorts.length - 1}{/if}</span>{/if}
		</button>
		{#if openPanel === 'sort'}
			<div class="panel sort-panel">
				<div class="panel-pills">
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
							title="Click to toggle direction. Right-click for options. Drag to reorder."
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
				{#if sorts.length === 0}
					<p class="empty-hint">No sort yet. Click + to add one.</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- ── Columns ── -->
	<div class="toolbar-item">
		<button
			class="toolbar-btn col-btn"
			class:open={openPanel === 'columns'}
			onclick={() => togglePanel('columns')}
		>
			Columns<span class="badge col-badge">{columns.length}</span>
		</button>
		{#if openPanel === 'columns'}
			<div class="panel col-panel">
				<div class="panel-pills">
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
		{/if}
	</div>

	<!-- ── Views ── -->
	<div class="toolbar-item views-item">
		<button
			class="toolbar-btn views-btn"
			class:open={openPanel === 'views'}
			onclick={() => togglePanel('views')}
		>
			Views
		</button>
		{#if openPanel === 'views'}
			<div class="panel views-panel">
				<SavedViews {steps} {entityType} {defaultView} onload={(s) => { onload(s); openPanel = null; }} />
			</div>
		{/if}
	</div>

</div>

<!-- Context menus — position:fixed so DOM placement doesn't affect visual position -->
{#if filterContextMenu}
	<div class="context-menu" style="left: {filterContextMenu.x}px; top: {filterContextMenu.y}px;">
		<button onclick={() => { filterEditingIndex = filterContextMenu!.index; openPanel = 'filter'; filterContextMenu = null; }}>Edit</button>
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
	/* ── Toolbar ─────────────────────────────────────────────────────────────── */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}

	.toolbar-item {
		position: relative;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		line-height: 1;
		min-height: 28px;
	}

	.toolbar-btn:hover,
	.toolbar-btn.open {
		border-color: var(--text-dim);
		color: var(--text);
		background: var(--hover-bg);
	}

	.filter-btn.has-active { border-color: #d97706; color: #d97706; }
	.filter-btn.has-active:hover,
	.filter-btn.has-active.open { background: #fffbeb; }

	.sort-btn.has-active { border-color: #2563eb; color: #2563eb; }
	.sort-btn.has-active:hover,
	.sort-btn.has-active.open { background: #eff6ff; }

	/* ── Badges & summary text ─────────────────────────────────────────────── */
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

	.filter-badge { background: #d97706; color: #fff; }
	.col-badge    { background: var(--border); color: var(--text-muted); }

	.sort-summary {
		font-size: 11px;
		color: #2563eb;
		font-weight: 500;
	}

	/* ── Panels ──────────────────────────────────────────────────────────────── */
	.panel {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 100;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.12);
		padding: 10px 12px;
		min-width: 260px;
	}

	.filter-panel { min-width: 520px; }

	.views-item .panel {
		left: auto;
		right: 0;
		min-width: 360px;
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

	/* ── Pills ───────────────────────────────────────────────────────────────── */
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

	.filter-pill { background: var(--pill-filter-bg); border: 1px solid var(--pill-filter-border); }
	.filter-pill:hover  { background: var(--pill-filter-hover); border-color: #f59e0b; }
	.filter-pill.active { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217,119,6,0.2); }
	.filter-pill.disabled { opacity: 0.45; text-decoration: line-through; }

	.sort-pill {
		background: var(--pill-sort-bg);
		border: 1px solid var(--pill-sort-border);
		cursor: grab;
		gap: 4px;
		transition: opacity 0.15s, border-color 0.15s;
	}
	.sort-pill:hover { background: var(--pill-sort-hover); border-color: #93c5fd; }
	.sort-pill .arrow { font-size: 10px; color: #6b21a8; }

	.col-pill {
		background: var(--pill-col-bg);
		border: 1px solid var(--pill-col-border);
		cursor: grab;
		transition: opacity 0.15s, border-color 0.15s;
	}
	.col-pill:hover { background: var(--pill-col-hover); border-color: #86efac; }

	/* ── Add button ──────────────────────────────────────────────────────────── */
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

	.filter-add:hover { border-color: #d97706; color: #d97706; }
	.sort-add:hover   { border-color: #2563eb; color: #2563eb; }
	.col-add:hover    { border-color: #16a34a; color: #16a34a; }

	.add-wrapper { position: relative; }

	/* ── Filter editor ───────────────────────────────────────────────────────── */
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

	/* ── Context menu ────────────────────────────────────────────────────────── */
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
