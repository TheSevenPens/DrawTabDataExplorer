// Universal entity resolver — parses an EntityId and redirects to the
// appropriate detail page. Opt out of prerendering; the SPA fallback
// (404.html) handles unrecognised paths at runtime.
export const prerender = false;

export function load() {
	// No server-side work needed — the Svelte component handles the redirect.
	return {};
}
