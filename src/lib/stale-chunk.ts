// Recovery for the one failure mode a static deploy can't avoid: every Pages
// deploy replaces the whole site, so the content-hashed chunks under
// `_app/immutable/` from the previous build are gone. A tab that predates the
// deploy still holds their filenames, and its next lazy route import 404s.
//
// `kit.version.pollInterval` plus the `beforeNavigate` guard in
// +layout.svelte handles the common case by turning the next navigation into
// a full page load. This is the fallback for the race the poll can't close —
// a deploy landing between one poll and the click that follows it.

/** Same event, four wordings. Chrome/Edge, Firefox, Safari, then Vite's CSS
 * preload helper (a route's stylesheet is hashed and deleted the same way). */
const STALE_CHUNK_PATTERNS = [
	/failed to fetch dynamically imported module/i,
	/error loading dynamically imported module/i,
	/importing a module script failed/i,
	/unable to preload css/i,
];

/** Session key holding the epoch ms of the last recovery reload. */
export const STALE_CHUNK_RELOAD_KEY = 'drawtab-stale-chunk-reload';

/** A second failure this soon after a reload means fresh HTML didn't fix it,
 * so the chunk is genuinely missing and reloading again would just loop. */
export const STALE_CHUNK_RELOAD_COOLDOWN_MS = 60_000;

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export function isStaleChunkError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
	if (!message) return false;
	return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * True when `error` is a stale-chunk failure and we haven't already tried to
 * reload out of it. Records the attempt in `storage` as a side effect, which
 * is what makes a second call inside the cooldown return false.
 *
 * A null `storage` (Safari private mode, storage disabled) yields false: with
 * nowhere to record the attempt there's no way to stop a reload loop, and a
 * loop is worse than the error page.
 */
export function shouldReloadForStaleChunk(
	error: unknown,
	storage: StorageLike | null,
	now: number,
): boolean {
	if (!isStaleChunkError(error)) return false;
	if (!storage) return false;
	const last = Number(storage.getItem(STALE_CHUNK_RELOAD_KEY));
	if (Number.isFinite(last) && last > 0 && now - last < STALE_CHUNK_RELOAD_COOLDOWN_MS) {
		return false;
	}
	storage.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
	return true;
}

/** sessionStorage, or null where touching it throws (private modes, embeds). */
export function safeSessionStorage(): StorageLike | null {
	try {
		const probe = globalThis.sessionStorage;
		if (!probe) return null;
		probe.getItem(STALE_CHUNK_RELOAD_KEY);
		return probe;
	} catch {
		return null;
	}
}
