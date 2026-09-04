import type { PaddingOptions } from 'maplibre-gl';

/** Réserve de la place aux contrôles sans épuiser un petit canvas ou un écran paysage. */
export function routeViewportPadding(width: number, height: number, desktop: boolean): Required<PaddingOptions> {
    const top = desktop ? 96 : 140;
    const bottom = desktop ? 88 : 300;
    // Garder au moins un tiers de la hauteur pour le trajet. Le rapport entre
    // les marges reste stable quand les contrôles occupent plus que ce budget.
    const verticalScale = Math.min(1, (height * 2 / 3) / (top + bottom));
    const side = Math.min(48, width / 4);
    return { top: top * verticalScale, bottom: bottom * verticalScale, left: side, right: side };
}
