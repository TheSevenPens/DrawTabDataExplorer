// Schema version that this build of the explorer is known to support.
// Bumped intentionally when the dataset's `schemaVersion` field crosses
// a breaking change. Mismatch triggers a compatibility banner in the
// layout (see src/routes/+layout.svelte).
//
// Compared against `version.json`'s top-level `schemaVersion` field,
// which is loaded at app startup by `src/routes/+layout.ts`.
export const SUPPORTED_SCHEMA_MAJOR = 1;
