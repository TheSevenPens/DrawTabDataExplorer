<script lang="ts">
	// Shared modal shell for the entity pickers (PenPicker, TabletPicker —
	// GitHub #215). Owns the modal *mechanics* only: backdrop click-to-close,
	// Escape-to-close, the dialog frame, and the header (title + optional
	// accessory + close button). Each picker supplies its own filters/list as
	// `children` and an optional `headerAccessory` (e.g. a slot-count badge) and
	// `footer` snippet. FieldPicker is intentionally not migrated (different
	// shape — it's a column/field picker, not an entity list).
	import type { Snippet } from 'svelte';

	let {
		title,
		onclose,
		headerAccessory,
		children,
		footer,
	}: {
		title: string;
		onclose: () => void;
		headerAccessory?: Snippet;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Backdrop = "click outside to close"; keyboard equivalent is Escape (above). -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onBackdropClick}>
	<div class="modal" role="dialog" aria-modal="true" aria-label={title} tabindex="-1">
		<div class="modal-header">
			<h2>{title}</h2>
			{@render headerAccessory?.()}
			<button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
		</div>

		{@render children()}
		{@render footer?.()}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	/* Square panel, no shadow — see ModalRoot for the same reasoning. */
	.modal {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		width: min(640px, 95vw);
		max-height: min(600px, 90vh);
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px 12px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: var(--type-heading);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-tight);
		color: var(--text);
		flex: 1;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: var(--text-muted);
		padding: 2px 6px;
		border-radius: var(--radius);
		line-height: 1;
	}

	.close-btn:hover {
		background: transparent;
		color: var(--accent);
	}
</style>
