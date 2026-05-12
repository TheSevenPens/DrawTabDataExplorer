<script lang="ts">
	import type { AnyFieldDef } from 'queriton';

	interface Props {
		entityType: string;
		onclose: () => void;
		// Rich mode — scope toggles enabled (rows: view vs all, columns: view vs all)
		allData?: any[];
		filteredData?: any[];
		allFields?: AnyFieldDef[];
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
	let format = $state<'csv' | 'json' | 'html' | 'markdown'>('csv');
	let output = $state<'clipboard' | 'file'>('clipboard');
	let statusMsg = $state('');

	interface ExportField {
		key: string;
		label: string;
		getValue: (row: any) => unknown;
	}

	const exportRows: any[] = $derived.by(() => {
		if (simpleMode) {
			return (rows ?? []).map((arr) => {
				const obj: Record<string, unknown> = {};
				(headers ?? []).forEach((h, i) => {
					obj[h] = arr[i];
				});
				return obj;
			});
		}
		return (rowMode === 'all' ? allData : filteredData) ?? [];
	});

	const exportFields: ExportField[] = $derived.by(() => {
		if (simpleMode) {
			return (headers ?? []).map((h) => ({ key: h, label: h, getValue: (row: any) => row[h] }));
		}
		const keys = colMode === 'all' ? (allFields ?? []).map((f) => f.key) : (visibleFields ?? []);
		return keys
			.map((k) => (allFields ?? []).find((f) => f.key === k))
			.filter((f): f is AnyFieldDef => Boolean(f))
			.map((f) => ({ key: f.key, label: f.label, getValue: (row: any) => f.getValue(row) }));
	});

	function cell(row: any, field: ExportField): string {
		const v = field.getValue(row);
		return v == null ? '' : String(v);
	}

	function csvEscape(v: string): string {
		if (v.includes(',') || v.includes('"') || v.includes('\n')) {
			return '"' + v.replace(/"/g, '""') + '"';
		}
		return v;
	}

	function htmlEscape(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function buildCSV(): string {
		const header = exportFields.map((f) => csvEscape(f.label)).join(',');
		const body = exportRows
			.map((row) => exportFields.map((f) => csvEscape(cell(row, f))).join(','))
			.join('\n');
		return header + '\n' + body;
	}

	function buildJSON(): string {
		return JSON.stringify(
			exportRows.map((row) => Object.fromEntries(exportFields.map((f) => [f.key, cell(row, f)]))),
			null,
			2,
		);
	}

	function buildHTML(): string {
		const ths = exportFields.map((f) => `<th>${htmlEscape(f.label)}</th>`).join('');
		const trs = exportRows
			.map((row) => {
				const tds = exportFields.map((f) => `<td>${htmlEscape(cell(row, f))}</td>`).join('');
				return `  <tr>${tds}</tr>`;
			})
			.join('\n');
		return `<table>\n<thead>\n  <tr>${ths}</tr>\n</thead>\n<tbody>\n${trs}\n</tbody>\n</table>`;
	}

	function buildMarkdown(): string {
		const header = '| ' + exportFields.map((f) => f.label).join(' | ') + ' |';
		const sep = '| ' + exportFields.map(() => '---').join(' | ') + ' |';
		const body = exportRows
			.map(
				(row) =>
					'| ' + exportFields.map((f) => cell(row, f).replace(/\|/g, '\\|')).join(' | ') + ' |',
			)
			.join('\n');
		return [header, sep, body].join('\n');
	}

	function getContent(): string {
		if (format === 'csv') return buildCSV();
		if (format === 'json') return buildJSON();
		if (format === 'html') return buildHTML();
		return buildMarkdown();
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
		const base = filename ?? entityType;
		const date = new Date().toISOString().slice(0, 10);
		return `${base}-${date}.${getExtension()}`;
	}

	async function doExport() {
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

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onBackdropClick}>
	<div class="dialog" role="dialog" aria-modal="true" aria-label={title}>
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
					Exporting <strong>{exportRows.length}</strong>
					{exportRows.length === 1 ? 'row' : 'rows'}
					&times;
					<strong>{exportFields.length}</strong>
					{exportFields.length === 1 ? 'column' : 'columns'}
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
				</div>
			</fieldset>

			<!-- Output -->
			<fieldset>
				<legend>Output</legend>
				<label>
					<input type="radio" bind:group={output} value="clipboard" />
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
				disabled={exportRows.length === 0 || exportFields.length === 0}
			>
				{output === 'clipboard' ? 'Copy' : 'Download'}
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

	.dialog {
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 10px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 14px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 4px;
	}
	.close-btn:hover {
		background: var(--hover-bg);
		color: var(--text);
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
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		background: var(--bg-card);
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
		border-color: #2563eb;
		color: #2563eb;
		background: #eff6ff;
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
		color: #16a34a;
		font-weight: 500;
	}

	.cancel-btn {
		margin-left: auto;
		padding: 6px 14px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}
	.cancel-btn:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}

	.export-btn {
		padding: 6px 16px;
		font-size: 13px;
		border: 1px solid #2563eb;
		border-radius: 4px;
		background: #2563eb;
		color: #fff;
		cursor: pointer;
		font-weight: 500;
	}
	.export-btn:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}
	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
