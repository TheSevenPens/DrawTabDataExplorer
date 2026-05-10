// Re-export the canonical formatters from data-repo so consumers can
// import them via $lib without reaching into $data.
export {
	tabletFullName,
	tabletBrandAndName,
	tabletNameAndId,
} from '$data/lib/entities/tablet-fields.js';
