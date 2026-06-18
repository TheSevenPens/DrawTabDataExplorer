<script lang="ts">
	// Shared command button for the app (GitHub #239). Replaces the ~20 one-off
	// `.copy-btn` / `.add-btn` / `.clear-btn` / `.run-btn` styles scattered across
	// routes with a small, boring variant set. Body stays a snippet so callers
	// keep their label/icon markup; styling + a11y live here.
	import type { Snippet } from 'svelte';
	import { resolveButtonTitle, type ButtonVariant, type ButtonSize } from './button-helpers.js';

	let {
		variant = 'secondary',
		size = 'sm',
		type = 'button',
		disabled = false,
		disabledReason,
		title,
		pressed,
		onclick,
		children,
		...rest
	}: {
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		/** When disabled, shown as the tooltip so the reason is discoverable. */
		disabledReason?: string;
		title?: string;
		/** aria-pressed for toggle buttons; omit for plain command buttons. */
		pressed?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		[key: string]: unknown;
	} = $props();

	let resolvedTitle = $derived(resolveButtonTitle({ disabled, disabledReason, title }));
</script>

<button
	{type}
	class="btn"
	class:primary={variant === 'primary'}
	class:secondary={variant === 'secondary'}
	class:subtle={variant === 'subtle'}
	class:danger={variant === 'danger'}
	class:icon={variant === 'icon'}
	class:menu-trigger={variant === 'menu-trigger'}
	class:md={size === 'md'}
	class:sm={size === 'sm'}
	{disabled}
	title={resolvedTitle}
	aria-pressed={pressed}
	aria-haspopup={variant === 'menu-trigger' ? 'menu' : undefined}
	{onclick}
	{...rest}
>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-family: inherit;
		border: 1px solid transparent;
		border-radius: 4px;
		line-height: 1;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	/* sizes */
	.btn.sm {
		padding: 3px 8px;
		font-size: 12px;
	}
	.btn.md {
		padding: 6px 16px;
		font-size: 13px;
		font-weight: 600;
	}

	/* primary — filled accent (run/save/add primary actions) */
	.btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
		font-weight: 600;
	}
	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	/* secondary — outline accent */
	.btn.secondary {
		background: var(--bg-card);
		border-color: #2563eb;
		color: #2563eb;
		font-weight: 600;
	}
	.btn.secondary:hover:not(:disabled) {
		background: #2563eb;
		color: #fff;
	}

	/* subtle — neutral, for copy/toolbar commands */
	.btn.subtle {
		background: var(--bg-card);
		border-color: var(--border);
		color: var(--text-muted);
	}
	.btn.subtle:hover:not(:disabled) {
		background: var(--hover-bg);
		color: var(--text);
	}

	/* danger — destructive (clear/delete/remove) */
	.btn.danger {
		background: var(--bg-card);
		border-color: #fca5a5;
		color: #dc2626;
	}
	.btn.danger:hover:not(:disabled) {
		background: #dc2626;
		border-color: #dc2626;
		color: #fff;
	}

	/* icon — compact, icon-only */
	.btn.icon {
		padding: 4px 6px;
		background: none;
		border-color: transparent;
		color: var(--text-muted);
	}
	.btn.icon:hover:not(:disabled) {
		background: var(--hover-bg);
		color: var(--text);
	}

	/* menu-trigger — opens an anchored PopoverMenu (#232/#234) */
	.btn.menu-trigger {
		background: var(--bg-card);
		border-color: var(--border);
		color: var(--text-muted);
	}
	.btn.menu-trigger:hover:not(:disabled) {
		background: var(--hover-bg);
		color: var(--text);
	}

	/* toggle pressed state (used with subtle/menu-trigger for view toggles) */
	.btn[aria-pressed='true'] {
		color: var(--text);
		border-color: var(--border);
		font-weight: 600;
	}
</style>
