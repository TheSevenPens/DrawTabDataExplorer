<script lang="ts">
	// Shared status line for inline good/warning/error/info notices (GitHub #237).
	// Replaces the per-route `.good` success text (and ad-hoc warning/error
	// paragraphs) with one consistent visual language. Message is a snippet so
	// callers keep their wording/markup.
	import type { Snippet } from 'svelte';

	type Variant = 'good' | 'warning' | 'error' | 'info';

	let { variant = 'info', children }: { variant?: Variant; children: Snippet } = $props();
</script>

<p
	class="status"
	class:good={variant === 'good'}
	class:warning={variant === 'warning'}
	class:error={variant === 'error'}
	class:info={variant === 'info'}
	role={variant === 'error' ? 'alert' : undefined}
>
	{@render children()}
</p>

<style>
	.status {
		font-size: 14px;
		font-weight: 600;
		margin: 0;
	}

	.good {
		color: var(--good);
	}
	.warning {
		color: var(--warning);
	}
	.error {
		color: var(--danger);
	}
	.info {
		color: var(--text-muted);
		font-weight: 400;
	}
</style>
