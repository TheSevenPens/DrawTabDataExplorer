/**
 * Drag-and-drop payloads shared by the Compare add rail and matrix (#373).
 * Every drag also has a menu path, so none of this is load-bearing for
 * keyboard users.
 */

import type { MemberRef } from './model';

/** The DataTransfer type both ends agree on; foreign drags are ignored. */
export const DRAG_MIME = 'application/x-drawtab-compare';

export type DragPayload =
	| { kind: 'candidate'; ref: MemberRef }
	| { kind: 'ref'; ref: MemberRef; from: string }
	| { kind: 'column'; id: string };

/** A column member as the matrix draws it: link target and label. */
export interface MemberHeader {
	id: string;
	label: string;
}
