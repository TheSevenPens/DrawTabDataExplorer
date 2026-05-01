<script lang="ts">
	import { modalRequest } from '$lib/modal-store.js';
	import { onMount, tick } from 'svelte';

	let inputEl: HTMLInputElement | undefined = $state();
	let inputValue = $state('');

	// Sync local input state whenever a new prompt request arrives, and
	// focus the input on the next tick.
	$effect(() => {
		const req = $modalRequest;
		if (req?.kind === 'prompt') {
			inputValue = req.defaultValue;
			tick().then(() => inputEl?.select());
		}
	});

	function close(result: string | boolean | null) {
		const req = $modalRequest;
		if (!req) return;
		modalRequest.set(null);
		// Cast appropriately based on kind.
		if (req.kind === 'prompt') {
			(req.resolve as (v: string | null) => void)(result as string | null);
		} else {
			(req.resolve as (v: boolean) => void)(result as boolean);
		}
	}

	function confirm() {
		const req = $modalRequest;
		if (!req) return;
		if (req.kind === 'prompt') {
			const trimmed = inputValue.trim();
			close(trimmed === '' ? null : trimmed);
		} else {
			close(true);
		}
	}

	function cancel() {
		const req = $modalRequest;
		if (!req) return;
		close(req.kind === 'prompt' ? null : false);
	}

	function onKey(e: KeyboardEvent) {
		if (!$modalRequest) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		} else if (e.key === 'Enter' && $modalRequest.kind === 'prompt') {
			e.preventDefault();
			confirm();
		}
	}

	onMount(() => {
		// Backdrop click closes; we register on the root for capture.
	});
</script>

<svelte:window on:keydown={onKey} />

{#if $modalRequest}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) cancel();
		}}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
			<h2 id="modal-title" class="modal-title">{$modalRequest.title}</h2>

			{#if $modalRequest.kind === 'prompt'}
				<input
					bind:this={inputEl}
					bind:value={inputValue}
					class="modal-input"
					type="text"
					autocomplete="off"
				/>
			{:else if $modalRequest.body}
				<p class="modal-body">{$modalRequest.body}</p>
			{/if}

			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={cancel}>
					{$modalRequest.cancelLabel}
				</button>
				<button type="button" class="btn-primary" onclick={confirm}>
					{$modalRequest.confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 16px;
	}

	.modal {
		background: var(--bg-card, #fff);
		color: var(--text, #222);
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 8px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
		min-width: 320px;
		max-width: 480px;
		width: 100%;
		padding: 20px;
	}

	.modal-title {
		font-size: 15px;
		font-weight: 600;
		margin: 0 0 12px;
	}

	.modal-body {
		font-size: 14px;
		color: var(--text-muted, #666);
		margin: 0 0 16px;
		line-height: 1.4;
	}

	.modal-input {
		width: 100%;
		padding: 8px 10px;
		font-size: 14px;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		background: var(--bg, #fff);
		color: var(--text, #222);
		margin-bottom: 16px;
	}

	.modal-input:focus {
		outline: none;
		border-color: var(--link, #2563eb);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.btn-primary,
	.btn-secondary {
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-primary {
		background: var(--link, #2563eb);
		color: #fff;
		border: 1px solid var(--link, #2563eb);
	}

	.btn-primary:hover {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	.btn-secondary {
		background: transparent;
		color: var(--text, #222);
		border: 1px solid var(--border, #ccc);
	}

	.btn-secondary:hover {
		background: var(--hover-bg, #f0f0f0);
	}
</style>
