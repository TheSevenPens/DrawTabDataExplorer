<script lang="ts">
	import { onMount } from 'svelte';

	interface DevError {
		id: number;
		message: string;
		source: string;
	}

	let errors = $state<DevError[]>([]);
	let nextId = 0;

	function addError(message: string, source: string) {
		errors = [...errors, { id: nextId++, message, source }];
	}

	function dismiss(id: number) {
		errors = errors.filter((e) => e.id !== id);
	}

	function dismissAll() {
		errors = [];
	}

	onMount(() => {
		function onError(event: ErrorEvent) {
			const source = [event.filename, event.lineno, event.colno].filter(Boolean).join(':');
			addError(event.message ?? 'Unknown error', source);
		}

		function onUnhandledRejection(event: PromiseRejectionEvent) {
			const reason = event.reason;
			const message = reason instanceof Error ? reason.message : String(reason);
			const source =
				reason instanceof Error && reason.stack ? (reason.stack.split('\n')[1]?.trim() ?? '') : '';
			addError(message, source);
		}

		window.addEventListener('error', onError);
		window.addEventListener('unhandledrejection', onUnhandledRejection);

		return () => {
			window.removeEventListener('error', onError);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
		};
	});
</script>

{#if errors.length > 0}
	<div class="dev-banner" role="alert">
		<div class="banner-header">
			<span class="banner-title">⚠ {errors.length} runtime error{errors.length > 1 ? 's' : ''}</span
			>
			<button class="dismiss-all" onclick={dismissAll}>Dismiss all</button>
		</div>
		{#each errors as err (err.id)}
			<div class="error-row">
				<div class="error-body">
					<span class="error-message">{err.message}</span>
					{#if err.source}
						<span class="error-source">{err.source}</span>
					{/if}
				</div>
				<button class="dismiss-one" onclick={() => dismiss(err.id)} aria-label="Dismiss">✕</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.dev-banner {
		position: fixed;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		width: min(680px, calc(100vw - 32px));
		background: #1e1b1b;
		border: 1px solid #dc2626;
		border-radius: 6px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		z-index: 9999;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		overflow: hidden;
	}

	.banner-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		background: #dc2626;
	}

	.banner-title {
		color: #fff;
		font-weight: 700;
		font-size: 12px;
	}

	.dismiss-all {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		color: #fff;
		font-size: 11px;
		padding: 1px 7px;
		cursor: pointer;
	}

	.dismiss-all:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.error-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 7px 10px;
		border-top: 1px solid #3a2020;
	}

	.error-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.error-message {
		color: #fca5a5;
		word-break: break-word;
	}

	.error-source {
		color: #6b7280;
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dismiss-one {
		flex-shrink: 0;
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		font-size: 13px;
		padding: 0 2px;
		line-height: 1;
	}

	.dismiss-one:hover {
		color: #fca5a5;
	}
</style>
