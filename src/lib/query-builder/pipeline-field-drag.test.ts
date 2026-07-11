import { describe, it, expect, afterEach } from 'vitest';
import {
	setPipelineFieldDragData,
	readPipelineFieldDragData,
	getActivePipelineFieldDrag,
	canAcceptPipelineFieldAt,
	clearPipelineFieldDrag,
	markPipelineCrossDropHandled,
	consumePipelineCrossDropHandled,
	PIPELINE_FIELD_DRAG_MIME,
} from './pipeline-field-drag.js';

function mockDragEvent() {
	const store = new Map<string, string>();
	return {
		store,
		event: {
			dataTransfer: {
				types: [] as string[],
				setData(type: string, value: string) {
					store.set(type, value);
					if (!this.types.includes(type)) this.types.push(type);
				},
				getData(type: string) {
					return store.get(type) ?? '';
				},
				effectAllowed: '',
				dropEffect: '',
			},
		} as unknown as DragEvent,
	};
}

describe('pipeline-field-drag', () => {
	afterEach(() => {
		clearPipelineFieldDrag();
	});

	it('tracks active drag for dragover and round-trips on drop', () => {
		const { event } = mockDragEvent();
		setPipelineFieldDragData(event, 'Brand', 'columns');
		expect(getActivePipelineFieldDrag()).toEqual({ field: 'Brand', source: 'columns' });
		expect(canAcceptPipelineFieldAt('filters')).toBe(true);
		expect(canAcceptPipelineFieldAt('columns')).toBe(false);
		expect(readPipelineFieldDragData(event)).toEqual({ field: 'Brand', source: 'columns' });
	});

	it('reads payload from dataTransfer on drop', () => {
		const { event, store } = mockDragEvent();
		setPipelineFieldDragData(event, 'ModelId', 'filters');
		clearPipelineFieldDrag();
		expect(getActivePipelineFieldDrag()).toBeNull();
		expect(readPipelineFieldDragData(event)).toEqual({ field: 'ModelId', source: 'filters' });
		expect(store.has(PIPELINE_FIELD_DRAG_MIME)).toBe(true);
	});

	it('tracks cross-drop handled flag', () => {
		expect(consumePipelineCrossDropHandled()).toBe(false);
		markPipelineCrossDropHandled();
		expect(consumePipelineCrossDropHandled()).toBe(true);
		expect(consumePipelineCrossDropHandled()).toBe(false);
	});
});
