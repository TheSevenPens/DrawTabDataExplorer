import type { HandleClientError } from '@sveltejs/kit';
import { safeSessionStorage, shouldReloadForStaleChunk } from '$lib/stale-chunk.js';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	// Always log to console with full context so browser devtools show the source
	console.error(
		`[SvelteKit] ${status} on ${event.url.pathname}`,
		'\nMessage:',
		message,
		'\nError:',
		error,
	);

	// A route chunk that 404s means this tab predates the current deploy (see
	// src/lib/stale-chunk.ts). Fresh HTML names the chunks that still exist, so
	// reload rather than showing an error page the user can only fix by
	// reloading anyway. Guarded against looping when the chunk is really gone.
	if (shouldReloadForStaleChunk(error, safeSessionStorage(), Date.now())) {
		location.reload();
		return { message: 'A new version of the site was deployed — reloading.' };
	}

	// Return a clean message for +error.svelte to display
	return {
		message: error instanceof Error ? error.message : message,
	};
};
