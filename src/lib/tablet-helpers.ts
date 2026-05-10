import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
import { tabletIdRedundantInName } from '$data/lib/entities/tablet-fields.js';

/** "Brand Name (Id)", or "Brand Name" when the Id is already in the Name. */
export function tabletFullName(t: Tablet): string {
	return tabletIdRedundantInName(t)
		? `${brandName(t.Model.Brand)} ${t.Model.Name}`
		: `${brandName(t.Model.Brand)} ${t.Model.Name} (${t.Model.Id})`;
}

/** "Name (Id)", or "Name" when the Id is already in the Name. */
export function tabletNameAndId(t: Tablet): string {
	return tabletIdRedundantInName(t) ? t.Model.Name : `${t.Model.Name} (${t.Model.Id})`;
}
