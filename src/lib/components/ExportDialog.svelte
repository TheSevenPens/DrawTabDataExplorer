<script lang="ts">
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import type { RowRecord } from '$lib/table-types.js';
	import { datedFilename } from '$lib/chart-export/filenames.js';
	import { modalBehavior } from '$lib/modal-behavior.js';
	import {
		cellString,
		tableFromArrays,
		toCSV,
		toHTML,
		toJSON,
		toMarkdown,
		type ExportTable,
	} from '$lib/table-export.js';

	interface Props {
		entityType: string;
		onclose: () => void;
		// Rich mode — scope toggles enabled (rows: view vs all, columns: view vs all)
		// Heterogeneous entity rows from callers — see table-types.ts (#221).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		allData?: any[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		filteredData?: any[];
		allFields?: AnyFieldDisplayDef[];
		visibleFields?: string[];
		// Simple mode — pre-built headers + rows, no scope toggles
		headers?: string[];
		rows?: (string | number)[][];
		// Optional overrides
		filename?: string;
		title?: string;
	}

	let {
		entityType,
		onclose,
		allData,
		filteredData,
		allFields,
		visibleFields,
		headers,
		rows,
		filename,
		title = 'Export Data',
	}: Props = $props();

	// "Simple mode" is when the caller provides flat headers+rows arrays
	// (no FieldDef metadata, no view/all distinction). Used by surfaces
	// where the data is already a static, pre-rendered table — e.g. each
	// Data Quality section. The scope toggles are hidden in this mode.
	let simpleMode = $derived(headers !== undefined && rows !== undefined);

	let rowMode = $state<'all' | 'view'>('view');
	let colMode = $state<'all' | 'view'>('view');
	let format = $state<'csv' | 'json' | 'html' | 'markdown' | 'pptx'>('csv');
	let output = $state<'clipboard' | 'file'>('clipboard');
	let rowsPerSlide = $state(20);
	let statusMsg = $state('');

	$effect(() => {
		// PowerPoint can only be written as a file — clipboard makes no sense
		// for a binary OOXML payload.
		if (format === 'pptx' && output !== 'file') output = 'file';
	});

	// Rich mode: the FieldDefs in scope for the current column toggle.
	const exportFieldDefs: AnyFieldDisplayDef[] = $derived.by(() => {
		if (simpleMode) return [];
		const keys = colMode === 'all' ? (allFields ?? []).map((f) => f.key) : (visibleFields ?? []);
		return keys
			.map((k) => (allFields ?? []).find((f) => f.key === k))
			.filter((f): f is AnyFieldDisplayDef => Boolean(f));
	});

	// One positional table feeds every format. Simple mode keeps the caller's
	// arrays as-is — keying them by heading is what dropped same-named
	// columns (#329).
	const table: ExportTable = $derived.by(() => {
		if (simpleMode) return tableFromArrays(headers ?? [], rows ?? []);
		const data: RowRecord[] = (rowMode === 'all' ? allData : filteredData) ?? [];
		return {
			headers: exportFieldDefs.map((f) => f.label),
			rows: data.map((row) => exportFieldDefs.map((f) => cellString(f.getValue(row)))),
		};
	});

	// JSON object keys: field keys in rich mode, headings in simple mode.
	let jsonKeys = $derived(simpleMode ? table.headers : exportFieldDefs.map((f) => f.key));

	function getContent(): string {
		if (format === 'csv') return toCSV(table);
		if (format === 'json') return toJSON(table, jsonKeys);
		if (format === 'html') return toHTML(table);
		return toMarkdown(table);
	}

	function getMimeType(): string {
		if (format === 'csv') return 'text/csv';
		if (format === 'json') return 'application/json';
		if (format === 'html') return 'text/html';
		return 'text/markdown';
	}

	function getExtension(): string {
		if (format === 'csv') return 'csv';
		if (format === 'json') return 'json';
		if (format === 'html') return 'html';
		return 'md';
	}

	function getFilename(): string {
		return datedFilename(filename ?? entityType, getExtension());
	}

	async function doExport() {
		if (format === 'pptx') {
			// Imported here rather than at the top of the module: pptxgenjs is
			// ~360 KB, and a static edge from this component put it in the app
			// entry's graph, so every page carried a modulepreload for it — ~123 KB
			// gzipped, on pages with no export UI at all. pptx-export.ts already
			// loads pptxgenjs itself lazily; this is the edge that defeated it (#310).
			const { exportTableAsPptx } = await import('$lib/pptx-export.js');
			await exportTableAsPptx({
				headers: table.headers,
				rows: table.rows,
				title,
				filename: filename ?? entityType,
				rowsPerSlide,
			});
			onclose();
			return;
		}
		const content = getContent();
		if (output === 'clipboard') {
			await navigator.clipboard.writeText(content);
			statusMsg = 'Copied!';
			setTimeout(() => {
				statusMsg = '';
				onclose();
			}, 900);
		} else {
			const blob = new Blob([content], { type: getMimeType() });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = getFilename();
			a.click();
			URL.revokeObjectURL(url);
			onclose();
		}
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<!-- Backdrop = "click outside to close" affordance. Keyboard equivalent is
	 Escape, handled by modalBehavior (which also contains Tab — #335). -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onBackdropClick}>
	<div
		class="dialog"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		use:modalBehavior={{ onclose }}
	>
		<div class="dialog-header">
			<h2>{title}</h2>
			<button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="dialog-body">
			{#if !simpleMode}
				<!-- Rows -->
				<fieldset>
					<legend>Rows</legend>
					<label>
						<input type="radio" bind:group={rowMode} value="view" />
						Current view <span class="count">({filteredData?.length ?? 0})</span>
					</label>
					<label>
						<input type="radio" bind:group={rowMode} value="all" />
						All rows <span class="count">({allData?.length ?? 0})</span>
					</label>
				</fieldset>

				<!-- Columns -->
				<fieldset>
					<legend>Columns</legend>
					<label>
						<input type="radio" bind:group={colMode} value="view" />
						View columns <span class="count">({visibleFields?.length ?? 0})</span>
					</label>
					<label>
						<input type="radio" bind:group={colMode} value="all" />
						All columns <span class="count">({allFields?.length ?? 0})</span>
					</label>
				</fieldset>
			{:else}
				<!-- Simple mode: no scope toggles, just show what's about to be exported -->
				<div class="summary">
					Exporting <strong>{table.rows.length}</strong>
					{table.rows.length === 1 ? 'row' : 'rows'}
					&times;
					<strong>{table.headers.length}</strong>
					{table.headers.length === 1 ? 'column' : 'columns'}
				</div>
			{/if}

			<!-- Format -->
			<fieldset>
				<legend>Format</legend>
				<div class="format-row">
					<label class="format-opt" class:selected={format === 'csv'}>
						<input type="radio" bind:group={format} value="csv" />
						CSV
					</label>
					<label class="format-opt" class:selected={format === 'json'}>
						<input type="radio" bind:group={format} value="json" />
						JSON
					</label>
					<label class="format-opt" class:selected={format === 'html'}>
						<input type="radio" bind:group={format} value="html" />
						HTML
					</label>
					<label class="format-opt" class:selected={format === 'markdown'}>
						<input type="radio" bind:group={format} value="markdown" />
						Markdown
					</label>
					<label class="format-opt" class:selected={format === 'pptx'}>
						<input type="radio" bind:group={format} value="pptx" />
						PowerPoint
					</label>
				</div>
			</fieldset>

			{#if format === 'pptx'}
				<fieldset>
					<legend>Rows per slide</legend>
					<label class="rps-row">
						<input
							type="number"
							min="1"
							max="200"
							step="1"
							bind:value={rowsPerSlide}
							class="rps-input"
						/>
						<span class="count">
							{table.rows.length} rows → {Math.max(
								1,
								Math.ceil(table.rows.length / Math.max(1, rowsPerSlide)),
							)} slide{Math.max(1, Math.ceil(table.rows.length / Math.max(1, rowsPerSlide))) === 1
								? ''
								: 's'}
						</span>
					</label>
				</fieldset>
			{/if}

			<!-- Output -->
			<fieldset>
				<legend>Output</legend>
				<label class:disabled={format === 'pptx'}>
					<input type="radio" bind:group={output} value="clipboard" disabled={format === 'pptx'} />
					Copy to clipboard
				</label>
				<label>
					<input type="radio" bind:group={output} value="file" />
					Save as file
				</label>
			</fieldset>
		</div>

		<div class="dialog-footer">
			{#if statusMsg}
				<span class="status">{statusMsg}</span>
			{/if}
			<button class="cancel-btn" onclick={onclose}>Cancel</button>
			<button
				class="export-btn"
				onclick={doExport}
				disabled={table.rows.length === 0 || table.headers.length === 0}
			>
				{format === 'pptx' ? 'Download .pptx' : output === 'clipboard' ? 'Copy' : 'Download'}
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Square panel, no shadow — see ModalRoot. */
	.dialog {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		width: 360px;
		max-width: calc(100vw - 32px);
		display: flex;
		flex-direction: column;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px 10px;
		border-bottom: 1px solid var(--border-light);
	}

	.dialog-header h2 {
		margin: 0;
		font-size: var(--type-heading);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-tight);
		color: var(--text);
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 14px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--radius);
	}
	.close-btn:hover {
		background: transparent;
		color: var(--accent);
	}

	.dialog-body {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	fieldset {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	legend {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	label {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: var(--text);
		cursor: pointer;
	}

	.count {
		color: var(--text-muted);
		font-size: 12px;
	}

	.rps-row {
		gap: 10px;
	}
	.rps-input {
		width: 64px;
		padding: 4px 6px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
	}
	.rps-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	label.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.summary {
		font-size: 13px;
		color: var(--text-muted);
		padding: 4px 0;
	}
	.summary strong {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	/* Format as a button-row */
	.format-row {
		display: flex;
		gap: 6px;
	}

	.format-opt {
		flex: 1;
		justify-content: center;
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		background: transparent;
		color: var(--text-muted);
		transition:
			border-color 0.1s,
			color 0.1s;
	}
	.format-opt input {
		display: none;
	}
	.format-opt:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}
	.format-opt.selected {
		border-color: var(--accent);
		color: var(--accent);
		background: transparent;
	}

	.dialog-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px 14px;
		border-top: 1px solid var(--border-light);
	}

	.status {
		flex: 1;
		font-size: 13px;
		color: var(--good);
		font-weight: 500;
	}

	.cancel-btn {
		margin-left: auto;
		padding: 6px 14px;
		font-size: var(--type-caption);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.cancel-btn:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}

	.export-btn {
		padding: 6px 16px;
		font-size: var(--type-caption);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--accent);
		color: var(--accent-contrast);
		cursor: pointer;
	}
	.export-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}
	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
