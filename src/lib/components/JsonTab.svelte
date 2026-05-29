<!--
  Inline JSON view rendered as a detail-page tab. Replaces the older
  JsonDialog modal on Pen/Tablet detail pages — the JSON is now reached
  via the "JSON" tab on the detail page rather than a floating dialog.
-->
<script lang="ts">
	let { entity }: { entity: Record<string, unknown> } = $props();

	let copied = $state(false);
	const json = $derived(JSON.stringify(entity, null, 2));

	function copyJson() {
		void navigator.clipboard.writeText(json);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="json-tab">
	<div class="toolbar">
		<button class="copy-btn" onclick={copyJson} title="Copy JSON to clipboard">
			{copied ? '✓ Copied' : 'Copy'}
		</button>
	</div>
	<pre>{json}</pre>
</div>

<style>
	.json-tab {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.toolbar {
		display: flex;
		justify-content: flex-end;
	}
	.copy-btn {
		font-size: 12px;
		padding: 3px 10px;
		border: 1px solid var(--border, #bbb);
		border-radius: 3px;
		background: var(--bg-card, #f5f5f5);
		color: var(--text, #333);
		cursor: pointer;
	}
	.copy-btn:hover {
		border-color: #2563eb;
		color: #2563eb;
	}
	pre {
		margin: 0;
		padding: 12px 14px;
		font-size: 12px;
		font-family: ui-monospace, 'Cascadia Code', 'Cascadia Mono', 'Fira Code', monospace;
		line-height: 1.5;
		overflow: auto;
		max-height: 70vh;
		color: var(--text, #1e1e1e);
		background: var(--bg-card, #fff);
		border: 1px solid var(--border, #ddd);
		border-radius: 4px;
		tab-size: 2;
	}
</style>
