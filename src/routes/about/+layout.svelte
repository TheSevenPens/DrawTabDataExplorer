<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';

	let { children }: { children: Snippet } = $props();
	const tabs = [
		{ href: '/about', label: 'Overview' },
		{ href: '/about/agents', label: 'Agents' },
	];
</script>

<ChromeLayout subNavTabs={tabs}>
	{@render children()}
</ChromeLayout>
