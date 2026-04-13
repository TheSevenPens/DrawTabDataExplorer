<script lang="ts">
	let { entity, onclose }: { entity: Record<string, any>; onclose: () => void } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let copied = $state(false);
	const json = $derived(JSON.stringify(entity, null, 2));
	const title = $derived(entity.Meta?.EntityId ?? entity.EntityId ?? 'JSON');

	// Drag state
	let posX = $state<number | null>(null);
	let posY = $state<number | null>(null);
	let dragging = false;
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	$effect(() => {
		dialog?.showModal();
	});

	function copyJson() {
		navigator.clipboard.writeText(json);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function onTitleMousedown(e: MouseEvent) {
		if (!dialog) return;
		dragging = true;
		const rect = dialog.getBoundingClientRect();
		// Snap from center-based positioning to absolute on first drag
		if (posX === null) {
			posX = rect.left;
			posY = rect.top;
		}
		dragOffsetX = e.clientX - posX!;
		dragOffsetY = e.clientY - posY!;
		e.preventDefault();
	}

	function onWindowMousemove(e: MouseEvent) {
		if (!dragging) return;
		posX = e.clientX - dragOffsetX;
		posY = e.clientY - dragOffsetY;
	}

	function onWindowMouseup() {
		dragging = false;
	}
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<dialog
	bind:this={dialog}
	onclose={onclose}
	style={posX !== null ? `left: ${posX}px; top: ${posY}px; margin: 0;` : ''}
>
	<!-- Title bar -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="titlebar" onmousedown={onTitleMousedown}>
		<span class="titlebar-icon">&#123;&#125;</span>
		<span class="titlebar-title">{title}</span>
		<div class="titlebar-controls">
			<button class="copy-btn" onclick={copyJson} title="Copy JSON">
				{copied ? '✓ Copied' : 'Copy'}
			</button>
			<button class="close-btn" onclick={() => dialog?.close()} title="Close">✕</button>
		</div>
	</div>

	<!-- Content -->
	<pre>{json}</pre>
</dialog>

<style>
	dialog {
		border: 1px solid #aaa;
		border-radius: 6px;
		padding: 0;
		width: min(700px, 90vw);
		max-height: 75vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 6px rgba(0,0,0,0.15), 0 10px 40px rgba(0,0,0,0.20);
		position: fixed;
	}

	dialog::backdrop {
		background: transparent;
	}

	/* Title bar */
	.titlebar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 8px 0 12px;
		height: 32px;
		background: linear-gradient(to bottom, #e8e8e8, #d4d4d4);
		border-bottom: 1px solid #aaa;
		border-radius: 6px 6px 0 0;
		cursor: move;
		user-select: none;
		flex-shrink: 0;
	}

	.titlebar-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.titlebar-title {
		flex: 1;
		font-size: 12px;
		font-weight: 600;
		color: #222;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.titlebar-controls {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.copy-btn {
		font-size: 11px;
		padding: 2px 8px;
		border: 1px solid #bbb;
		border-radius: 3px;
		background: #f5f5f5;
		color: #333;
		cursor: pointer;
		height: 22px;
	}

	.copy-btn:hover {
		background: #e8e8e8;
	}

	.close-btn {
		width: 22px;
		height: 22px;
		border: 1px solid #bbb;
		border-radius: 3px;
		background: #f5f5f5;
		color: #333;
		cursor: pointer;
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.close-btn:hover {
		background: #e81123;
		border-color: #e81123;
		color: #fff;
	}

	/* JSON content */
	pre {
		margin: 0;
		padding: 12px 14px;
		font-size: 12px;
		font-family: ui-monospace, 'Cascadia Code', 'Cascadia Mono', 'Fira Code', monospace;
		line-height: 1.5;
		overflow: auto;
		flex: 1;
		color: #1e1e1e;
		background: #fff;
		tab-size: 2;
	}
</style>
