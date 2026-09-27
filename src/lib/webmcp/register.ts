import { createTabletSpecsTool } from './tablet-specs.js';
import { createOpenTabletSpecsTool } from './open-tablet-specs.js';
import { createQueryTabletsTool, createOpenTabletQueryTool } from './query-tablets.js';
import {
	createCompareTabletSizesTool,
	type CompareTabletSizesContext,
} from './compare-tablet-sizes.js';

type ExplorerTool =
	| ReturnType<typeof createTabletSpecsTool>
	| ReturnType<typeof createOpenTabletSpecsTool>
	| ReturnType<typeof createCompareTabletSizesTool>
	| ReturnType<typeof createQueryTabletsTool>
	| ReturnType<typeof createOpenTabletQueryTool>;

// Only the draft surface we use. No polyfill, dependency or global shim:
// browsers without WebMCP keep using the normal Explorer UI.
export interface ModelContext {
	registerTool(tool: ExplorerTool, options: { signal: AbortSignal }): void | Promise<void>;
}

export function registerExplorerTools(
	doc: Document & { modelContext?: ModelContext },
	context: CompareTabletSizesContext,
): () => void {
	const controller = new AbortController();
	async function register(tool: ExplorerTool) {
		try {
			if (typeof doc.modelContext?.registerTool !== 'function') return;
			await doc.modelContext.registerTool(tool, {
				signal: controller.signal,
			});
		} catch (error) {
			// An experimental browser capability must not break page navigation.
			if (!controller.signal.aborted)
				console.warn(`WebMCP ${tool.name} could not be registered.`, error);
		}
	}
	void register(createTabletSpecsTool(context));
	void register(createOpenTabletSpecsTool(context));
	void register(createCompareTabletSizesTool(context));
	void register(createQueryTabletsTool(context));
	void register(createOpenTabletQueryTool(context));
	return () => controller.abort();
}
