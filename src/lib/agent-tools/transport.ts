/**
 * Binding agent-facing tools to whatever tool API the browser happens to expose.
 *
 * The reason this is an adapter rather than a direct `navigator.modelContext`
 * call: the tool *definitions* are the durable asset and the transport is the
 * volatile part. WebMCP is an unstable proposal, implementations differ, and
 * the overwhelmingly common case is a browser with no tool API at all. None of
 * that should reach the tools themselves — `describeFields` does not need to
 * know which spec revision shipped.
 *
 * Two rules:
 *
 * 1. **Absence is not an error.** A page with no agent attached is the normal
 *    case, not a degraded one. Registration reports what happened and never
 *    throws; a site that breaks because a browser lacks an experimental API is
 *    worse than one with no agent support.
 * 2. **Return the accounting.** Same rule as `compareEntities` — a caller that
 *    gets `registered: 3` without knowing the backend was `none` will report
 *    success for a no-op.
 */

/** JSON Schema for a tool's arguments. Kept loose: the shape is the spec's. */
export type ToolInputSchema = Record<string, unknown>;

export interface AgentTool {
	/** Stable, snake_case, unique across the page. */
	name: string;
	/**
	 * What the tool does AND when to reach for it. Agents choose from this text
	 * alone, so "returns field definitions" is worse than "call before querying
	 * so you know which fields and enum values exist".
	 */
	description: string;
	inputSchema: ToolInputSchema;
	/** May be async. Throwing is reported to the caller, never swallowed. */
	handler: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

/**
 * Where tools get registered. Implemented by the real browser API, by a no-op,
 * and by a recording fake in tests — which is the point of the seam.
 */
export interface ToolBackend {
	/** Identifies the backend in the result, so callers can tell a no-op apart. */
	readonly kind: string;
	register(tool: AgentTool): void;
	/** Optional: not every host supports withdrawal. */
	unregister?(name: string): void;
}

export interface RegistrationResult {
	backend: string;
	/** True only when a real tool API accepted the registrations. */
	live: boolean;
	registered: string[];
	/** Name → error message. A tool the host rejected, not one that threw later. */
	failed: Record<string, string>;
	/** Names supplied more than once; the first wins and later ones are skipped. */
	duplicates: string[];
}

/** Registration was attempted against nothing. Used when no API is present. */
export const noopBackend: ToolBackend = {
	kind: 'none',
	register() {},
};

/**
 * The `navigator.modelContext` shape, feature-detected.
 *
 * Deliberately duck-typed rather than typed against a published d.ts: the
 * proposal has renamed this surface more than once, and a hard type would make
 * the build fail on spec churn rather than degrade to `none` at runtime.
 */
export function detectBackend(globalObj: unknown = globalThis): ToolBackend {
	const nav = (globalObj as { navigator?: Record<string, unknown> })?.navigator;
	const ctx = nav?.modelContext as
		| { registerTool?: (t: unknown) => void; unregisterTool?: (n: string) => void }
		| undefined;

	if (typeof ctx?.registerTool !== 'function') return noopBackend;

	return {
		kind: 'navigator.modelContext',
		register: (tool) => ctx.registerTool!(tool),
		unregister:
			typeof ctx.unregisterTool === 'function' ? (name) => ctx.unregisterTool!(name) : undefined,
	};
}

/**
 * Register a tool set. Safe to call when nothing is listening.
 *
 * Returns both the result and a disposer, because a SPA that re-registers on
 * every navigation leaks tool definitions into the host otherwise.
 */
export function registerTools(
	tools: readonly AgentTool[],
	backend: ToolBackend = detectBackend(),
): { result: RegistrationResult; dispose: () => void } {
	const result: RegistrationResult = {
		backend: backend.kind,
		live: backend.kind !== 'none',
		registered: [],
		failed: {},
		duplicates: [],
	};

	const seen = new Set<string>();
	for (const tool of tools) {
		if (seen.has(tool.name)) {
			result.duplicates.push(tool.name);
			continue;
		}
		seen.add(tool.name);
		try {
			backend.register(tool);
			result.registered.push(tool.name);
		} catch (err) {
			result.failed[tool.name] = err instanceof Error ? err.message : String(err);
		}
	}

	const dispose = () => {
		if (!backend.unregister) return;
		for (const name of result.registered) {
			try {
				backend.unregister(name);
			} catch {
				// Withdrawal is best-effort; a host that refuses is not our problem.
			}
		}
	};

	return { result, dispose };
}
