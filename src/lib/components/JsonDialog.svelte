<script lang="ts">
	let { entity, onclose }: { entity: Record<string, any>; onclose: () => void } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let copied = $state(false);

	const json = $derived(JSON.stringify(entity, null, 2));

	$effect(() => {
		dialog?.showModal();
	});

	function copyJson() {
		navigator.clipboard.writeText(json);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} onclose={onclose} onclick={(e) => { if (e.target === dialog) dialog?.close(); }}>
	<div class="header">
		<span class="title">JSON</span>
		<div class="actions">
			<button class="copy-btn" onclick={copyJson}>{copied ? 'Copied!' : 'Copy'}</button>
			<button class="close-btn" onclick={() => dialog?.close()}>✕</button>
		</div>
	</div>
	<pre>{json}</pre>
</dialog>

<style>
	dialog {
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 8px;
		padding: 0;
		width: min(680px, 90vw);
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
	}

	dialog::backdrop {
		background: rgba(0, 0, 0, 0.4);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border, #e0e0e0);
		background: var(--surface, #fafafa);
		flex-shrink: 0;
	}

	.title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted, #555);
	}

	.actions {
		display: flex;
		gap: 6px;
	}

	pre {
		margin: 0;
		padding: 14px;
		font-size: 12px;
		font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
		line-height: 1.5;
		overflow: auto;
		flex: 1;
		color: var(--text, #222);
		background: var(--bg, #fff);
	}

	.copy-btn, .close-btn {
		font-size: 12px;
		padding: 3px 9px;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		background: var(--bg, #fff);
		color: var(--text, #333);
		cursor: pointer;
	}

	.copy-btn:hover {
		background: #f0f0f0;
	}

	.close-btn:hover {
		background: #fee2e2;
		border-color: #fca5a5;
	}
</style>
