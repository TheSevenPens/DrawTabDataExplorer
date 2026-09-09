<script lang="ts">
	// Full-width block for a `multiline` FieldDisplayDef (see
	// $lib/multiline-fields.ts). The value is rendered verbatim in a
	// monospace face with whitespace preserved — the notes are authored as
	// markdown and we deliberately do NOT format it, so what you typed is
	// what you read back. Long lines soft-wrap rather than scroll.
	let { label, value }: { label: string; value: string } = $props();
</script>

<section class="multiline-field">
	<h2>{label}</h2>
	<pre>{value}</pre>
</section>

<style>
	.multiline-field {
		margin-bottom: 16px;
	}

	h2 {
		font-size: var(--type-micro);
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		margin-bottom: 6px;
	}

	pre {
		margin: 0;
		padding: 10px 12px;
		font-family: ui-monospace, 'Cascadia Code', 'Cascadia Mono', 'Fira Code', monospace;
		font-size: 12px;
		line-height: 1.55;
		tab-size: 4;
		/* pre-wrap keeps every space, tab and newline the author typed while
		   still soft-wrapping a long line to the panel width. */
		white-space: pre-wrap;
		overflow-wrap: break-word;
		color: var(--text);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
</style>
