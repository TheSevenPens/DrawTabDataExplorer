// Keyboard model for a WAI-ARIA tablist (GitHub #335), with *manual*
// activation: arrow keys only move focus between tabs; Enter/Space (the
// native button click) selects. Automatic activation would push a history
// entry and render a tab on every arrow press, since Tabs mirrors the
// selection into the URL hash.

/** Index to focus after `key` in a list of `count` tabs, or null when the
 * key isn't a tablist navigation key. Arrows wrap; Home/End jump. */
export function nextTabIndex(current: number, count: number, key: string): number | null {
	if (count === 0) return null;
	switch (key) {
		case 'ArrowRight':
			return (current + 1) % count;
		case 'ArrowLeft':
			return (current - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}
