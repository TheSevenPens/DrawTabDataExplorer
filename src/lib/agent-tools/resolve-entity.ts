/**
 * Name → ranked candidates, for agent-facing tools that take an entity by the
 * name a human typed.
 *
 * The rule this enforces: **never return a single best guess.** "kamvas 22"
 * matches four tablets in the live dataset (Kamvas 22, 22 Plus, 22 Pro (2019),
 * 22 GEN3). A resolver that quietly picks one compares the wrong pair, and the
 * wrong answer looks exactly as authoritative as a right one. Callers get the
 * ranked list plus an `ambiguous` flag and decide — asking the user is a
 * legitimate outcome. See docs/WEBMCP.md § Requirement 6.
 */

export type MatchKind = 'exact' | 'prefix' | 'substring' | 'tokens';

/** Descending score order; ties are what `ambiguous` reports on. */
const SCORE: Record<MatchKind, number> = {
	exact: 100,
	prefix: 75,
	substring: 50,
	tokens: 25,
};

export interface Candidate {
	id: string;
	label: string;
	kind: MatchKind;
	score: number;
}

export interface ResolveResult {
	query: string;
	matches: Candidate[];
	/** More than one candidate tied at the top score — the caller must choose. */
	ambiguous: boolean;
	/** Total candidates before `limit` truncation, so callers can say "3 more". */
	totalMatches: number;
}

export interface ResolveOptions<T> {
	idOf: (item: T) => string;
	labelOf: (item: T) => string;
	/**
	 * Extra strings that should also match — the bare model name, the model id,
	 * alternate names. Without these, "kamvas 22" can only ever be a substring
	 * of "Huion Kamvas 22" and stays ambiguous against three siblings; with
	 * them it matches the bare name exactly and resolves cleanly.
	 */
	aliasesOf?: (item: T) => readonly string[];
	limit?: number;
}

/** Lowercase, punctuation → single spaces. "XP-Pen" and "XP Pen" both → "xp pen". */
function norm(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Same, with separators removed entirely, so "xppen" matches "XP-Pen". */
function squash(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function kindFor(query: string, target: string): MatchKind | null {
	const q = norm(query);
	const t = norm(target);
	if (!q || !t) return null;
	if (t === q || squash(target) === squash(query)) return 'exact';
	if (t.startsWith(q + ' ')) return 'prefix';
	if (t.includes(q) || squash(target).includes(squash(query))) return 'substring';
	const tokens = q.split(' ');
	if (tokens.length > 1 && tokens.every((tok) => t.includes(tok))) return 'tokens';
	return null;
}

export function resolveEntity<T>(
	query: string,
	items: readonly T[],
	opts: ResolveOptions<T>,
): ResolveResult {
	const { idOf, labelOf, aliasesOf, limit = 8 } = opts;
	const all: Candidate[] = [];

	for (const item of items) {
		const label = labelOf(item);
		const targets = [label, ...(aliasesOf?.(item) ?? [])];
		let best: MatchKind | null = null;
		for (const target of targets) {
			const kind = kindFor(query, target);
			if (kind && (best === null || SCORE[kind] > SCORE[best])) best = kind;
		}
		if (!best) continue;
		const id = idOf(item);
		// A wrong `idOf` path is silent and lethal: candidates come back with
		// `id: undefined`, the caller's `find(t => t.id === match.id)` matches
		// the first row whose id is also undefined, and it compares two
		// unrelated entities with full confidence. That happened while
		// verifying this module against live data. Fail loudly instead.
		if (typeof id !== 'string' || id === '') {
			throw new TypeError(
				`resolveEntity: idOf returned ${JSON.stringify(id)} for "${label}". ` +
					`Check the accessor path — a missing id silently resolves to the wrong entity.`,
			);
		}
		all.push({ id, label, kind: best, score: SCORE[best] });
	}

	// Score first; shorter labels win ties because "Kamvas 22" is a closer read
	// of "kamvas 22" than "Kamvas 22 Pro (2019)" is. Then label, so the order is
	// deterministic rather than dependent on input order.
	all.sort(
		(a, b) =>
			b.score - a.score || a.label.length - b.label.length || a.label.localeCompare(b.label),
	);

	const top = all[0]?.score;
	return {
		query,
		matches: all.slice(0, limit),
		ambiguous: all.filter((c) => c.score === top).length > 1,
		totalMatches: all.length,
	};
}
