<script lang="ts">
	interface Props {
		headers: string[];
		rows: (string | number)[][];
		label?: string;
	}
	let { headers, rows, label = 'Export' }: Props = $props();

	let open = $state(false);
	let copied = $state<string | null>(null);

	function csvEscape(v: string | number): string {
		const s = String(v ?? '');
		return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	}

	function mdEscape(v: string | number): string {
		return String(v ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
	}

	function toCSV(): string {
		const lines = [headers.map(csvEscape).join(',')];
		for (const r of rows) lines.push(r.map(csvEscape).join(','));
		return lines.join('\n');
	}

	function toMarkdown(): string {
		const head = '| ' + headers.map(mdEscape).join(' | ') + ' |';
		const sep = '|' + headers.map(() => ' --- ').join('|') + '|';
		const body = rows.map((r) => '| ' + r.map(mdEscape).join(' | ') + ' |');
		return [head, sep, ...body].join('\n');
	}

	async function copy(format: 'csv' | 'md'): Promise<void> {
		const text = format === 'csv' ? toCSV() : toMarkdown();
		try {
			await navigator.clipboard.writeText(text);
			copied = format;
			setTimeout(() => {
				copied = null;
			}, 1500);
		} catch (err) {
			console.error('Copy failed', err);
		}
		open = false;
	}

	function onWindowClick(): void {
		if (open) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="export-wrap">
	<button
		type="button"
		class="export-btn"
		disabled={rows.length === 0}
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
	>
		{copied === 'csv' ? 'Copied CSV ✓' : copied === 'md' ? 'Copied MD ✓' : `${label} ▾`}
	</button>
	{#if open}
		<div class="dropdown" role="menu">
			<button type="button" class="item" onclick={() => copy('csv')}>Copy as CSV</button>
			<button type="button" class="item" onclick={() => copy('md')}>Copy as Markdown</button>
		</div>
	{/if}
</div>

<style>
	.export-wrap {
		position: relative;
		display: inline-block;
	}
	.export-btn {
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		background: #f8f8f8;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		color: #333;
	}
	.export-btn:hover:not(:disabled) {
		background: #eee;
		border-color: #999;
	}
	.export-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.dropdown {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
		z-index: 10;
		min-width: 12rem;
	}
	.item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.8rem;
		font-size: 0.9rem;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		color: #333;
	}
	.item:hover {
		background: #f0f0f0;
	}
</style>
