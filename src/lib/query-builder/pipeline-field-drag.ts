export type PipelineSection = 'filters' | 'columns' | 'sort';

export const PIPELINE_FIELD_DRAG_MIME = 'application/x-drawtab-pipeline-field';

export interface PipelineFieldDragPayload {
	field: string;
	source: PipelineSection;
}

let activeDrag: PipelineFieldDragPayload | null = null;
let crossDropHandled = false;

export function setPipelineFieldDragData(
	e: DragEvent,
	field: string,
	source: PipelineSection,
): void {
	const payload: PipelineFieldDragPayload = { field, source };
	activeDrag = payload;
	if (!e.dataTransfer) return;
	const encoded = JSON.stringify(payload);
	e.dataTransfer.setData(PIPELINE_FIELD_DRAG_MIME, encoded);
	// Fallback — some browsers only expose text/plain during dragover/drop.
	e.dataTransfer.setData('text/plain', encoded);
	e.dataTransfer.effectAllowed = 'copyMove';
}

/** Active drag payload — readable during dragover (getData is not). */
export function getActivePipelineFieldDrag(): PipelineFieldDragPayload | null {
	return activeDrag;
}

export function canAcceptPipelineFieldAt(target: PipelineSection): boolean {
	const payload = activeDrag;
	return payload !== null && payload.source !== target;
}

export function readPipelineFieldDragData(e: DragEvent): PipelineFieldDragPayload | null {
	if (e.dataTransfer) {
		for (const type of [PIPELINE_FIELD_DRAG_MIME, 'text/plain'] as const) {
			const raw = e.dataTransfer.getData(type);
			if (!raw) continue;
			try {
				const parsed = JSON.parse(raw) as PipelineFieldDragPayload;
				if (parsed.field && parsed.source) return parsed;
			} catch {
				/* try next */
			}
		}
	}
	return activeDrag;
}

export function clearPipelineFieldDrag(): void {
	activeDrag = null;
}

export function markPipelineCrossDropHandled(): void {
	crossDropHandled = true;
}

export function consumePipelineCrossDropHandled(): boolean {
	const handled = crossDropHandled;
	crossDropHandled = false;
	return handled;
}
