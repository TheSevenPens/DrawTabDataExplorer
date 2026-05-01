import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	// Always log to console with full context so browser devtools show the source
	console.error(
		`[SvelteKit] ${status} on ${event.url.pathname}`,
		'\nMessage:',
		message,
		'\nError:',
		error,
	);

	// Return a clean message for +error.svelte to display
	return {
		message: error instanceof Error ? error.message : message,
	};
};
